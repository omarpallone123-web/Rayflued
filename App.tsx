import { useEffect, useMemo, useState, ReactNode } from "react";

type Item = { id: number; title: string; owner: string; description: string; url: string; updated: string; stars: number; source: string; verified: boolean };
type Res = { total: number; page: number; items: Item[] };
type Scan = { file: string | null; flags: string[]; safe: boolean; code?: string; reason?: string; error?: string };

const GAMES = ["Blade Ball", "Blox Fruits", "Arsenal", "Pet Simulator", "Adopt Me", "Brookhaven", "Doors", "Murder Mystery 2"];
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string) || "";
const ADS = (import.meta.env.VITE_ADSENSE_CLIENT as string) || "";

function useLS<T>(k: string, d: T): [T, (v: T) => void] {
  const [v, s] = useState<T>(() => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } });
  return [v, (n) => { setV(n); try { localStorage.setItem(k, JSON.stringify(n)); } catch { /* storage unavailable */ } }] as any;
  function setV(n: T) { s(n); }
}
const cache = new Map<string, Item>();
const key = (i: Item) => `${i.owner}/${i.title}`;
async function api<T>(p: string): Promise<T> {
  const r = await fetch(p); const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any).error || `Request failed (${r.status})`);
  return j as T;
}
const ago = (d: string) => { const n = Math.floor((Date.now() - +new Date(d)) / 864e5); return n < 1 ? "today" : n < 30 ? `${n}d ago` : n < 365 ? `${Math.floor(n / 30)}mo ago` : `${Math.floor(n / 365)}y ago`; };

function useHash() { const [h, s] = useState(location.hash.slice(1) || "/"); useEffect(() => { const f = () => s(location.hash.slice(1) || "/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); return h; }

function Lua({ code }: { code: string }) {
  const re = /(--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(local|function|end|if|then|else|elseif|for|while|do|return|in|and|or|not|nil|true|false|repeat|until)\b|\b(\d+\.?\d*)\b/g;
  const out: ReactNode[] = []; let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(code))) { if (m.index > last) out.push(code.slice(last, m.index)); out.push(<span key={m.index} className={m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "n"}>{m[0]}</span>); last = re.lastIndex; }
  out.push(code.slice(last)); return <pre><code>{out}</code></pre>;
}

function Badge({ v }: { v: boolean }) { return <span className={`tag ${v ? "v" : "u"}`}>{v ? "Verified source" : "Unverified"}</span>; }
function Card({ i, onFav, fav }: { i: Item; onFav: () => void; fav: boolean }) {
  cache.set(key(i), i);
  return <div className="card" onClick={() => (location.hash = `/s/${key(i)}`)}>
    <div className="row sp"><h3>{i.title}</h3><button className="btn ghost" aria-label="Toggle favorite" onClick={(e) => { e.stopPropagation(); onFav(); }}>{fav ? "★" : "☆"}</button></div>
    <div className="mu">{i.description || "No description."}</div>
    <div className="row" style={{ marginTop: 8 }}><Badge v={i.verified} /><span className="tag">{i.source}</span><span className="tag">{i.owner}</span><span className="tag">★ {i.stars}</span><span className="tag">updated {ago(i.updated)}</span></div>
  </div>;
}
function AdSlot() { if (!ADS) return null; return <div className="card mu" data-ad-client={ADS} style={{ marginTop: 20, textAlign: "center" }}>Ad area (AdSense loads here once approved)</div>; }

function Search({ q0, favs, toggle, addRecent, bump }: { q0: string; favs: Item[]; toggle: (i: Item) => void; addRecent: (q: string) => void; bump: (n: number) => void }) {
  const [q, setQ] = useState(q0), [run, setRun] = useState(q0), [page, setPage] = useState(1), [sort, setSort] = useState(""), [since, setSince] = useState("0");
  const [src, setSrc] = useState("all"), [verOnly, setVerOnly] = useState(false);
  const [res, setRes] = useState<Res | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setQ(q0); setRun(q0); setPage(1); }, [q0]);
  useEffect(() => { if (!run) return; let dead = false; setBusy(true); setErr("");
    api<Res>(`/api/search?q=${encodeURIComponent(run)}&page=${page}&sort=${sort}&since=${since}`).then((r) => { if (!dead) { setRes(r); bump(r.items.length); } }).catch((e) => !dead && setErr(e.message)).finally(() => !dead && setBusy(false));
    return () => { dead = true; }; }, [run, page, sort, since]);
  const shown = useMemo(() => (res?.items || []).filter((i) => (src === "all" || i.source === src) && (!verOnly || i.verified)), [res, src, verOnly]);
  return <>
    <form className="sb" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { setRun(q.trim()); setPage(1); addRecent(q.trim()); } }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Roblox games or scripts..." aria-label="Search" /><button className="btn">Search</button></form>
    <div className="row" style={{ margin: "14px 0" }}>
      <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort"><option value="">Best match</option><option value="updated">Recently updated</option><option value="stars">Most stars</option></select>
      <select value={since} onChange={(e) => { setSince(e.target.value); setPage(1); }} aria-label="Updated"><option value="0">Any time</option><option value="30">Last 30 days</option><option value="180">Last 6 months</option><option value="365">Last year</option></select>
      <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Source"><option value="all">All sources</option><option>GitHub</option></select>
      <label className="row mu"><input type="checkbox" checked={verOnly} onChange={(e) => setVerOnly(e.target.checked)} />Verified only</label></div>
    {err && <div className="card err">{err}</div>}
    {busy && <div className="res">{[0, 1, 2].map((n) => <div key={n} className="sk" />)}</div>}
    {!busy && !err && run && res && shown.length === 0 && <div className="card">No public results for “{run}”. Try the game name alone, or relax the filters.</div>}
    {!busy && !run && <div className="card mu">Type a game name to search public GitHub repositories.</div>}
    {!busy && <div className="res">{shown.map((i) => <Card key={i.id} i={i} fav={favs.some((f) => f.id === i.id)} onFav={() => toggle(i)} />)}</div>}
    {res && res.total > 20 && <div className="row sp" style={{ marginTop: 14 }}><button className="btn ghost" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous</button><span className="mu">Page {page} · {res.total} repos</span><button className="btn ghost" disabled={page * 20 >= res.total || page >= 10 || busy} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>;
}

function Detail({ id, favs, toggle }: { id: string; favs: Item[]; toggle: (i: Item) => void }) {
  const i = cache.get(id) || favs.find((f) => key(f) === id);
  const [scan, setScan] = useState<Scan | null>(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  if (!i) return <div className="card">This script is no longer in memory. <a href="#/finder">Search again</a>.</div>;
  const run = () => { setBusy(true); api<Scan>(`/api/inspect?owner=${encodeURIComponent(i.owner)}&repo=${encodeURIComponent(i.title)}`).then(setScan).catch((e) => setScan({ file: null, flags: [], safe: false, error: e.message })).finally(() => setBusy(false)); };
  return <div className="prose">
    <h2 style={{ marginTop: 0 }}>{i.title}</h2>
    <div className="row"><Badge v={i.verified} /><span className="tag">Author: {i.owner}</span><span className="tag">Source: {i.source}</span><span className="tag">Updated {new Date(i.updated).toLocaleDateString()}</span></div>
    <p>{i.description || "No description provided."}</p>
    <div className="card warn">Treat every external script as untrusted. Nothing here is executed by this site, and using scripts may break a game’s rules. Review the source yourself.</div>
    <div className="row" style={{ margin: "14px 0" }}><a className="btn" href={i.url} target="_blank" rel="noopener noreferrer nofollow">Open original source</a><button className="btn ghost" onClick={() => toggle(i)}>{favs.some((f) => f.id === i.id) ? "Remove favorite" : "Add favorite"}</button>
      <a className="btn ghost" href={`mailto:${CONTACT}?subject=${encodeURIComponent("Report: " + i.url)}`}>Report suspicious content</a></div>
    <h2>Safe preview</h2>
    {!scan && <button className="btn" onClick={run} disabled={busy}>{busy ? "Scanning…" : "Scan and preview first Lua file"}</button>}
    {scan?.error && <div className="card err">{scan.error}</div>}
    {scan && !scan.error && <>
      {scan.flags.map((f) => <div key={f} className="card warn" style={{ marginBottom: 8 }}>⚠ {f}</div>)}
      {scan.code ? <><div className="row sp" style={{ marginBottom: 8 }}><span className="mu">{scan.file} · passed automated scan (not a guarantee)</span>{!scan.flags.length && <button className="btn ghost" onClick={() => { navigator.clipboard.writeText(scan.code!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>}</div><Lua code={scan.code} /></> : <div className="card err">{scan.reason}</div>}
    </>}
  </div>;
}

function Page({ t, children }: { t: string; children: ReactNode }) { return <div className="prose"><h2 style={{ marginTop: 0 }}>{t}</h2>{children}</div>; }

export default function App() {
  const h = useHash(); const [open, setOpen] = useState(false);
  const [favs, setFavs] = useLS<Item[]>("ef:favs", []), [recent, setRecent] = useLS<string[]>("ef:recent", []), [count, setCount] = useLS<number>("ef:seen", 0), [searches, setSearches] = useLS<number>("ef:n", 0);
  const [q, setQ] = useState(""); const [latest, setLatest] = useState<Item[]>([]); const [lerr, setLerr] = useState("");
  const toggle = (i: Item) => setFavs(favs.some((f) => f.id === i.id) ? favs.filter((f) => f.id !== i.id) : [i, ...favs]);
  const addRecent = (s: string) => { setRecent([s, ...recent.filter((r) => r !== s)].slice(0, 20)); setSearches(searches + 1); };
  const go = (s: string) => { setQ(s); location.hash = "/finder"; if (s) addRecent(s); };
  useEffect(() => { if (h === "/") api<Res>("/api/search?q=script&sort=updated").then((r) => setLatest(r.items.slice(0, 5))).catch((e) => setLerr(e.message)); setOpen(false); }, [h]);
  const nav: [string, string][] = [["/", "Home"], ["/finder", "Script Finder"], ["/games", "Game Explorer"], ["/sources", "Sources"], ["/favorites", "Favorites"], ["/recent", "Recent Searches"], ["/settings", "Settings"], ["/about", "About"]];
  let body: ReactNode;
  if (h === "/") body = <>
    <div className="hero"><h1>EXPLOIT <b>FINDER</b></h1><p>Search public Roblox scripts. Every result links to its original source.</p>
      <form className="sb" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Roblox games or scripts..." aria-label="Search" /><button className="btn">Search</button></form>
      <div className="chips">{GAMES.slice(0, 5).map((g) => <button key={g} className="chip" onClick={() => go(g)}>{g}</button>)}</div></div>
    <h2>Your activity</h2><div className="grid"><div className="card stat"><b>{searches}</b>searches run</div><div className="card stat"><b>{count}</b>results loaded</div><div className="card stat"><b>{favs.length}</b>favorites</div></div>
    <h2>Popular games</h2><div className="grid">{GAMES.map((g) => <button key={g} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go(g)}>{g}</button>)}</div>
    <h2>Recently updated on GitHub</h2>{lerr ? <div className="card err">{lerr}</div> : latest.length ? <div className="res">{latest.map((i) => <Card key={i.id} i={i} fav={favs.some((f) => f.id === i.id)} onFav={() => toggle(i)} />)}</div> : <div className="sk" />}
    <h2>Your recent searches</h2>{recent.length ? <div className="chips" style={{ justifyContent: "flex-start" }}>{recent.slice(0, 8).map((r) => <button key={r} className="chip" onClick={() => go(r)}>{r}</button>)}</div> : <div className="mu">Nothing yet.</div>}<AdSlot /></>;
  else if (h === "/finder") body = <Search q0={q} favs={favs} toggle={toggle} addRecent={addRecent} bump={(n) => setCount(count + n)} />;
  else if (h === "/games") body = <Page t="Game Explorer"><div className="grid">{GAMES.map((g) => <button key={g} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go(g)}><h3>{g}</h3><span className="mu">Search public repositories</span></button>)}</div></Page>;
  else if (h === "/sources") body = <Page t="Sources"><div className="card"><div className="row sp"><h3>GitHub</h3><span className="tag v">Active</span></div><p className="mu">Public repositories via the GitHub Search API, queried from the server. Owners listed in the VERIFIED_OWNERS setting are marked “Verified source”; everything else is “Unverified”.</p></div><p className="mu">More providers can be added in functions/api/search.ts.</p></Page>;
  else if (h === "/favorites") body = <Page t="Favorites">{favs.length ? <div className="res">{favs.map((i) => <Card key={i.id} i={i} fav onFav={() => toggle(i)} />)}</div> : <div className="card">No favorites yet. Tap ☆ on any result.</div>}</Page>;
  else if (h === "/recent") body = <Page t="Recent Searches">{recent.length ? <><div className="chips" style={{ justifyContent: "flex-start" }}>{recent.map((r) => <button key={r} className="chip" onClick={() => go(r)}>{r}</button>)}</div><button className="btn ghost" onClick={() => setRecent([])}>Clear history</button></> : <div className="card">No searches yet.</div>}</Page>;
  else if (h === "/settings") body = <Page t="Settings"><p className="mu">Data is stored only in this browser.</p><div className="row"><button className="btn ghost" onClick={() => setRecent([])}>Clear history</button><button className="btn ghost" onClick={() => setFavs([])}>Clear favorites</button><button className="btn ghost" onClick={() => { setCount(0); setSearches(0); }}>Reset activity</button></div></Page>;
  else if (h === "/about") body = <Page t="About"><p>EXPLOIT FINDER is a search engine for publicly available Roblox scripts, built for research and education. It never invents results, never executes code, and hides code that matches high-risk patterns such as webhooks, cookie access or heavy obfuscation.</p><p>An automated scan is not a security review. Always read code yourself.</p><p><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <a href="#/contact">Contact</a></p></Page>;
  else if (h === "/privacy") body = <Page t="Privacy Policy"><p>Searches are sent to our server and forwarded to GitHub. Favorites and history stay in your browser’s local storage. If advertising is enabled, Google AdSense may use cookies; you can manage this through Google’s ad settings and any consent banner we show.</p></Page>;
  else if (h === "/terms") body = <Page t="Terms of Service"><p>Results come from third parties and are provided as-is, without warranty. We do not host or endorse listed scripts. You are responsible for following the law, Roblox’s Terms of Use and each repository’s license. Do not use this site to distribute malware or steal accounts.</p></Page>;
  else if (h === "/contact") body = <Page t="Contact">{CONTACT ? <p>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for takedowns and abuse reports.</p> : <div className="card warn">Set VITE_CONTACT_EMAIL at build time to show a contact address.</div>}</Page>;
  else if (h.startsWith("/s/")) body = <Detail id={decodeURIComponent(h.slice(3))} favs={favs} toggle={toggle} />;
  else body = <div className="card">Page not found.</div>;
  return <div className="shell">
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <aside className={`side ${open ? "open" : ""}`}><div className="brand">EXPLOIT <b>FINDER</b></div><nav className="nav">{nav.map(([p, l]) => <a key={p} href={`#${p}`} className={h === p ? "on" : ""}>{l}</a>)}</nav></aside>
    <div style={{ flex: 1, minWidth: 0 }}><div className="top"><button className="btn ghost" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button><b>EXPLOIT FINDER</b></div><main className="main">{body}<p className="mu" style={{ marginTop: 40, fontSize: 13 }}><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <a href="#/contact">Contact</a></p></main></div>
  </div>;
}
