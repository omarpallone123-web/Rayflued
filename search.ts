// Cloudflare Pages Function: GET /api/search?q=&page=&sort=&since=
interface Env { GITHUB_TOKEN?: string; VERIFIED_OWNERS?: string }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=120" } });

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const page = Math.min(Math.max(parseInt(u.searchParams.get("page") || "1"), 1), 10);
  const sort = ["updated", "stars"].includes(u.searchParams.get("sort") || "") ? u.searchParams.get("sort")! : "";
  const since = parseInt(u.searchParams.get("since") || "0");
  if (!q) return json({ error: "Enter a game or script name." }, 400);
  let gq = `${q} roblox in:name,description,readme`;
  if (since > 0) gq += ` pushed:>${new Date(Date.now() - since * 864e5).toISOString().slice(0, 10)}`;
  const api = `https://api.github.com/search/repositories?q=${encodeURIComponent(gq)}&per_page=20&page=${page}${sort ? `&sort=${sort}&order=desc` : ""}`;
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "exploit-finder" };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  let r: Response;
  try { r = await fetch(api, { headers }); } catch { return json({ error: "Could not reach GitHub." }, 502); }
  if (!r.ok) return json({ error: r.status === 403 || r.status === 429 ? "GitHub rate limit reached. Set GITHUB_TOKEN on the server or retry later." : `GitHub returned ${r.status}.` }, 502);
  const d: any = await r.json();
  const verified = new Set((env.VERIFIED_OWNERS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean));
  const seen = new Set<string>();
  const items = [];
  for (const x of d.items || []) {
    const key = String(x.full_name).toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    items.push({ id: x.id, title: x.name, owner: x.owner.login, description: x.description || "", url: x.html_url, updated: x.pushed_at, stars: x.stargazers_count, source: "GitHub", verified: verified.has(x.owner.login.toLowerCase()) });
  }
  return json({ total: Math.min(d.total_count || 0, 1000), page, items });
};
