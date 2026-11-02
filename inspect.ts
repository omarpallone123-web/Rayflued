// GET /api/inspect?owner=&repo= — fetches ONE small Lua file as text and scans it. Never executes anything.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const RULES: [string, RegExp, boolean][] = [
  ["Discord webhook (possible data exfiltration)", /discord(app)?\.com\/api\/webhooks/i, true],
  ["Roblox cookie / session access", /ROBLOSECURITY|\.roblosecurity/i, true],
  ["Credential or token keywords", /(password|passwd|auth_?token|api_?key)\s*[=:]/i, true],
  ["Heavy escape-sequence obfuscation", /(\\\d{2,3}){40,}/, true],
  ["Obfuscator signature", /(IronBrew|Luraph|Moonsec)/i, true],
  ["Loads remote code (loadstring + HTTP)", /loadstring\s*\(\s*(game:)?HttpGet|loadstring\s*\(\s*game/i, false],
];
export const onRequestGet = async ({ request, env }: { request: Request; env: { GITHUB_TOKEN?: string } }) => {
  const u = new URL(request.url); const owner = u.searchParams.get("owner") || ""; const repo = u.searchParams.get("repo") || "";
  const ok = /^[A-Za-z0-9-_.]{1,100}$/;
  if (!ok.test(owner) || !ok.test(repo)) return json({ error: "Invalid repository." }, 400);
  const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "exploit-finder" };
  if (env.GITHUB_TOKEN) h.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const l = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers: h });
  if (!l.ok) return json({ error: `GitHub returned ${l.status}.` }, 502);
  const files: any[] = await l.json();
  const f = Array.isArray(files) ? files.find((x) => /\.(lua|luau)$/i.test(x.name) && x.size <= 100000 && x.download_url?.startsWith("https://raw.githubusercontent.com/")) : null;
  if (!f) return json({ file: null, flags: [], safe: false, reason: "No small .lua file in the repository root. Review the source on GitHub." });
  const code = (await (await fetch(f.download_url)).text()).slice(0, 100000);
  const hits = RULES.filter(([, re]) => re.test(code));
  const blocked = hits.some(([, , hard]) => hard);
  return json({ file: f.name, flags: hits.map(([n]) => n), safe: !blocked, code: blocked ? undefined : code, reason: blocked ? "Code hidden: it matched high-risk patterns." : undefined });
};
