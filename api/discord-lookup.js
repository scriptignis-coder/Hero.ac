// Discord check WITHOUT the player logging in: staff type (or keep) the player's Discord ID.
// What Discord allows a website to see from an ID alone:
//   • the profile (name, avatar, account creation date) — with your bot
//   • which of the servers YOUR BOT is in he is a member of (+ join date) — with your bot
// Everything else in the Discord tab comes from the PC (Discord / browser cache: servers he is in and left)
// and from his earlier checks. The result is saved on the PIN like a normal Discord check (source: "id").
import { wrap, send, sb, enc, httpError, readBody, requireAccess, getAccess } from './_lib.js';

const API = 'https://discord.com/api/v10';
async function dget(path, token, tries = 0) {
  try {
    const r = await fetch(API + path, { headers: { Authorization: `Bot ${token}`, 'User-Agent': 'HeRoShield (dashboard, 1.0)' }, signal: AbortSignal.timeout(6000) });
    if (r.status === 429 && tries < 3) {
      const j = await r.json().catch(() => ({}));
      await new Promise((s) => setTimeout(s, Math.min(5, j.retry_after || 1) * 1000));
      return dget(path, token, tries + 1);
    }
    return r.ok ? r.json() : null;
  } catch { return null; }
}
const created = (id) => new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString();

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const user = await requireAccess(req, 'herocheck');
  const b = readBody(req);
  const pin = String(b.pin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const id = String(b.id || '').replace(/\D/g, '');
  if (!/^\d{17,20}$/.test(id)) throw httpError(400, 'Enter a valid Discord ID (17–20 digits)');
  const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id,license_id,discord_check`);
  const row = rows && rows[0];
  if (!row) throw httpError(404, 'PIN not found');
  const access = await getAccess(user);
  if (!access.admin) {
    const lic = await sb(`scanner_licenses?id=eq.${enc(row.license_id)}&owner_discord=eq.${enc(String(user.id))}&select=id`);
    if (!lic || !lic.length) throw httpError(403, 'This PIN is not yours');
  }
  // never overwrite a real login check of the player with an ID check
  if (row.discord_check && row.discord_check.source !== 'id' && row.discord_check.user && String(row.discord_check.user.id) === id)
    return send(res, 200, { ok: true, kept: true });

  const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
  const check = { at: new Date().toISOString(), source: 'id', by: String(user.id),
    user: { id, name: null, username: null, avatar: null, created: created(id) }, guilds: [], botServers: 0, bot: !!token };
  if (token) {
    const u = await dget(`/users/${id}`, token);
    if (u) {
      check.user.name = u.global_name || u.username; check.user.username = u.username;
      check.user.avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128` : null;
    }
    const mine = (await dget('/users/@me/guilds?limit=200', token)) || [];
    check.botServers = mine.length;
    const deadline = Date.now() + 20000;
    for (const g of mine.slice(0, 100)) {
      if (Date.now() > deadline) break;
      const m = await dget(`/guilds/${g.id}/members/${id}`, token);
      if (m && m.joined_at) check.guilds.push({ id: g.id, name: g.name, icon: g.icon || null, joined: m.joined_at });
    }
  }
  if (!check.user.name) check.user.name = 'Discord user';
  await sb(`scan_pins?id=eq.${enc(row.id)}`, { method: 'PATCH', body: { discord_check: check } });
  send(res, 200, { ok: true, check });
});
