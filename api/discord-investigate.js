// Discord server membership check (legit, bot-based).
// Uses YOUR bot token: it lists the servers the bot is in, and checks whether the
// given user ID is a member of each — returning join date + role count.
// It can ONLY see servers your bot has been added to (never someone's full server
// list, which would require their token). Add the bot to the cheat/community servers
// you want to monitor, then set DISCORD_BOT_TOKEN.
import { wrap, send, httpError, requireAccess } from './_lib.js';

const API = 'https://discord.com/api/v10';

async function dget(path, token, tries = 0) {
  const r = await fetch(API + path, { headers: { Authorization: `Bot ${token}` } });
  if (r.status === 429 && tries < 3) {
    const j = await r.json().catch(() => ({}));
    await new Promise((s) => setTimeout(s, Math.min(5, (j.retry_after || 1)) * 1000));
    return dget(path, token, tries + 1);
  }
  if (!r.ok) return null;
  return r.json();
}

export default wrap(async (req, res) => {
  await requireAccess(req, 'herocheck');
  const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if (!token) throw httpError(400, 'No bot configured. Create a Discord bot, add it to the servers you want to monitor, and set DISCORD_BOT_TOKEN.');
  const id = String(req.query.id || '').replace(/[^0-9]/g, '').slice(0, 25);
  if (!id) throw httpError(400, 'Enter a Discord user ID');

  const guilds = (await dget('/users/@me/guilds', token)) || [];
  const found = [];
  let checked = 0;
  for (const gu of guilds.slice(0, 80)) {
    checked++;
    const mem = await dget(`/guilds/${gu.id}/members/${id}`, token);
    if (mem && mem.joined_at) {
      found.push({ server: gu.name, id: gu.id, joined: mem.joined_at, roles: (mem.roles || []).length });
    }
  }
  found.sort((a, b) => new Date(a.joined) - new Date(b.joined));
  send(res, 200, { id, checked, servers: guilds.length, found });
});
