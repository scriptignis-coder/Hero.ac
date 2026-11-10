import { wrap, send, sb, enc, requireAccess } from './_lib.js';

// Name + logo of Discord servers that a report only knows by their ID (servers the player LEFT)
// or by an invite code. Sources, in order:
//   1) earlier checks on this site — a player who connected Discord sent that server's name + icon
//   2) Discord's public invite API (for invite codes)
//   3) the server's public widget (if the server enabled it)
//   4) the server preview with the bot (if DISCORD_BOT_TOKEN is set — works for discoverable servers / servers the bot is in)
// Results are cached in memory for 12 hours.
const API = 'https://discord.com/api/v10';
const UA = { 'User-Agent': 'HeRoShield (dashboard, 1.0)' };
const cache = new Map();   // key → { at, v }
const TTL = 12 * 3600e3;
const hit = (k) => { const c = cache.get(k); return c && Date.now() - c.at < TTL ? c : null; };

async function getJson(url, headers = UA) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

async function fromChecks(id) {
  try {
    const rows = await sb(`scan_pins?discord_check->guilds=cs.${enc(JSON.stringify([{ id }]))}&select=discord_check&order=created_at.desc&limit=1`);
    const g = rows && rows[0] && ((rows[0].discord_check || {}).guilds || []).find((x) => String(x.id) === id);
    return g && g.name ? { id, name: g.name, icon: g.icon || null, from: 'earlier check' } : null;
  } catch { return null; }
}

async function byId(id) {
  const c = hit(id); if (c) return c.v;
  let v = await fromChecks(id);
  if (!v) {
    const w = await getJson(`https://discord.com/api/guilds/${id}/widget.json`);
    if (w && w.name) {
      v = { id, name: w.name, icon: null, from: 'widget' };
      const code = /\/invite\/([A-Za-z0-9-]+)/.exec(w.instant_invite || '');
      if (code) { const inv = await getJson(`${API}/invites/${code[1]}`); if (inv && inv.guild && inv.guild.icon) v.icon = inv.guild.icon; }
    }
  }
  const bot = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if ((!v || !v.icon) && bot) {
    const p = await getJson(`${API}/guilds/${id}/preview`, { ...UA, Authorization: `Bot ${bot}` });
    if (p && p.name) v = { id, name: p.name, icon: p.icon || (v && v.icon) || null, from: 'preview' };
  }
  cache.set(id, { at: Date.now(), v: v || null });
  return v || null;
}

async function byInvite(code) {
  const k = 'inv:' + code; const c = hit(k); if (c) return c.v;
  const j = await getJson(`${API}/invites/${encodeURIComponent(code)}`);
  const v = j && j.guild ? { id: String(j.guild.id), name: j.guild.name || null, icon: j.guild.icon || null, from: 'invite' } : null;
  cache.set(k, { at: Date.now(), v });
  return v;
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export default wrap(async (req, res) => {
  await requireAccess(req, 'herocheck');
  const ids = [...new Set(String(req.query.ids || '').split(',').filter((x) => /^\d{17,20}$/.test(x)))].slice(0, 60);
  const invs = [...new Set(String(req.query.inv || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z0-9-]{2,32}$/.test(x)))].slice(0, 30);
  const info = {};
  const deadline = Date.now() + 9000;
  await pool(ids, 5, async (id) => { if (Date.now() < deadline) { const v = await byId(id); if (v) info[id] = v; } });
  await pool(invs, 5, async (c) => { if (Date.now() < deadline) { const v = await byInvite(c); if (v) info['inv:' + c] = v; } });
  send(res, 200, { info });
});
