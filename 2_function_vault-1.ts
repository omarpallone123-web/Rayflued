// Supabase Edge Function named: vault
// Dashboard -> Edge Functions -> open "vault" -> replace the code with this -> Deploy.
// IMPORTANT: "Verify JWT" must be OFF for this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DENIED = "You are not authorized. You can't do anything anymore.";
const MAX_FAILS = 5;
const BLOCK_MINUTES = 15;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const BUCKET = "vault";

const base = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};
const text = (s: string, status = 200) =>
  new Response(s, { status, headers: { ...base, "Content-Type": "text/plain; charset=utf-8" } });
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...base, "Content-Type": "application/json" } });
const deny = () => text(DENIED, 403);

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Returns "admin", "viewer" or null (wrong password / blocked)
async function authenticate(password: string, ip: string): Promise<"admin" | "viewer" | null> {
  const { data: f } = await db.from("vault_fails").select("*").eq("ip", ip).maybeSingle();
  if (f?.blocked_until && new Date(f.blocked_until) > new Date()) return null;

  const { data: cfg } = await db.from("vault_config").select("viewer_hash, admin_hash").eq("id", 1).single();
  if (!cfg) return null;

  const h = await sha256Hex(password);
  let role: "admin" | "viewer" | null = null;
  if (safeEqual(h, cfg.admin_hash.toLowerCase())) role = "admin";
  else if (safeEqual(h, cfg.viewer_hash.toLowerCase())) role = "viewer";

  if (!role) {
    const fails = (f?.fails ?? 0) + 1;
    const blocked = fails >= MAX_FAILS;
    await db.from("vault_fails").upsert({
      ip,
      fails: blocked ? 0 : fails,
      blocked_until: blocked ? new Date(Date.now() + BLOCK_MINUTES * 60000).toISOString() : null,
    });
    return null;
  }
  await db.from("vault_fails").delete().eq("ip", ip);
  return role;
}

async function listFiles() {
  const { data } = await db.storage.from(BUCKET).list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
  return (data ?? []).map((x) => x.name).filter((n) => NAME_RE.test(n));
}

async function serveFile(name: string) {
  if (!NAME_RE.test(name)) return text("Invalid file name", 400);
  const { data, error } = await db.storage.from(BUCKET).download(name);
  if (error || !data) return text("File not found", 404);
  return text(await data.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: base });
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  // GET ?key=PASSWORD&file=name  (used by loadstring)
  if (req.method === "GET") {
    const u = new URL(req.url);
    const role = await authenticate(u.searchParams.get("key") ?? "", ip);
    if (!role) return deny();
    const file = u.searchParams.get("file");
    if (!file) return text((await listFiles()).join("\n"));
    return await serveFile(file);
  }

  if (req.method !== "POST") return text("Not found", 404);

  // Upload (multipart): admin only
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    const role = await authenticate(String(form.get("password") ?? ""), ip);
    if (role !== "admin") return deny();
    const name = String(form.get("name") ?? "");
    const file = form.get("file");
    if (!NAME_RE.test(name)) return text("Invalid file name (use letters, numbers, . _ -)", 400);
    if (!(file instanceof File)) return text("No file", 400);
    const { error } = await db.storage.from(BUCKET).upload(name, file, { upsert: true, contentType: "text/plain" });
    if (error) return text("Upload failed: " + error.message, 500);
    return json({ ok: true });
  }

  // JSON actions: list / get / delete
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const role = await authenticate(String(body.password ?? ""), ip);
  if (!role) return deny();

  if (body.action === "list") return json({ role, files: await listFiles() });
  if (body.action === "get") return await serveFile(String(body.file ?? ""));
  if (body.action === "delete") {
    if (role !== "admin") return deny();
    const name = String(body.file ?? "");
    if (!NAME_RE.test(name)) return text("Invalid file name", 400);
    await db.storage.from(BUCKET).remove([name]);
    return json({ ok: true });
  }
  return text("Unknown action", 400);
});
