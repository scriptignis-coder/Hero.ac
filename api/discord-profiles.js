import { wrap, send, httpError, requireAccess, sb, enc } from './_lib.js';

/**
 * v75 — the profile of several Discord accounts at once.
 *
 * The scanner reports every account id this PC has seen. An id on its own tells staff nothing:
 * they cannot picture 1266320489450704917, and pasting each one into Discord by hand is exactly
 * the busywork this product exists to remove. This turns the ids into faces and names.
 *
 * Why a separate endpoint from discord-lookup: that one is the full investigation of ONE
 * account — profile, plus which of your servers it is in, plus a write to the PIN. This is the
 * cheap half, for a list: name and avatar, several ids in one request, nothing written. Asking
 * the full endpoint once per account would be several seconds per face and a write each time.
 *
 * GET /api/discord-profiles?ids=1,2,3   (max 25)
 *   -> { profiles: { "<id>": { id, username, display, avatar, created, found } } }
 *
 * `found: false` means Discord has no such user, which is itself worth seeing: an id in the
 * cache that no longer resolves is usually a deleted account.
 */

const API = 'https://discord.com/api/v10';

// Profiles barely change and staff open the same report repeatedly, so a short memory cache
// keeps a re-opened report instant and keeps us well clear of Discord's rate limits.
const cache = new Map();                 // id -> { at, profile }
const TTL_MS = 10 * 60 * 1000;

async function profile(id, token) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.profile;

  let u = null;
  try {
    const r = await fetch(`${API}/users/${id}`, {
      headers: { Authorization: `Bot ${token}`, 'User-Agent': 'HeRoShield (dashboard, 1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) u = await r.json();
  } catch { /* a timeout is "unknown", never an error the whole list fails on */ }

  // The snowflake carries the creation date in its top 42 bits — no request needed, and it is
  // worth showing: an account made the week of the check is a fact staff should see.
  const created = new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString();

  const p = u
    ? {
        id,
        username: u.username || null,
        // Discord says so itself. A bot is a user object like any other, which is why bot ids
        // out of the desktop cache looked exactly like accounts: ProBot and the server's own
        // verification bot were listed as "accounts used on this PC". They are not accounts,
        // nobody signs into them, and they say nothing about the player. The dashboard drops
        // every row carrying this flag.
        bot: !!(u.bot || u.system),
        display: u.global_name || u.username || null,
        avatar: u.avatar
          ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=96`
          : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`,
        created,
        found: true,
      }
    : { id, username: null, display: null, avatar: null, created, found: false };

  cache.set(id, { at: Date.now(), profile: p });
  return p;
}

export default wrap(async (req, res) => {
  await requireAccess(req, 'herocheck');
  if (req.method !== 'GET') throw httpError(405, 'GET only');

  const ids = [...new Set(String(req.query?.ids || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d{17,20}$/.test(x)))].slice(0, 25);
  if (!ids.length) throw httpError(400, 'No valid Discord IDs');

  const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if (!token) return send(res, 200, { profiles: {}, bot: false });

  // In parallel: 25 ids one after another at ~150 ms each is four seconds of staring at a
  // spinner, and they do not depend on one another.
  const list = await Promise.all(ids.map((id) => profile(id, token)));
  const profiles = {};
  for (const p of list) profiles[p.id] = p;
  send(res, 200, { profiles, bot: true });
});
