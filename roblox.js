// Proxy lato server per le API pubbliche di Roblox (Vercel Serverless Function)
const ALLOWED = ['users', 'friends', 'thumbnails', 'groups', 'badges'];

module.exports = async (req, res) => {
  try {
    const target = new URL(String(req.query.url || ''));
    const sub = target.hostname.replace(/\.roblox\.com$/, '');
    if (target.protocol !== 'https:' || !target.hostname.endsWith('.roblox.com') || !ALLOWED.includes(sub)) {
      res.status(400).json({ error: 'URL non consentito' });
      return;
    }
    const r = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30');
    res.status(r.status).send(body);
  } catch (e) {
    res.status(500).json({ error: 'Errore proxy' });
  }
};
