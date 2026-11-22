/**
 * v82 — the cheat servers every operator gets without adding them.
 *
 * ── WHY THIS IS A LIST OF INVITES AND NOT A LIST OF IDS ─────────────────────────────────────
 * A guild ID is what the matching needs, and an ID would be faster. But an ID written into
 * source by hand cannot be checked by anyone reading it: 555000111222333444 either is that
 * cheat shop or is some innocent server, and nothing on the page says which. An invite can be
 * opened. Anyone reviewing this file can click a link and see the server it points at, and the
 * ID underneath comes from Discord rather than from somebody's memory.
 *
 * So the invites are the source of truth and the IDs are derived. The derivation is Discord's
 * own public invite endpoint — no bot, no token, no account:
 *
 *     GET https://discord.com/api/v10/invites/{code}
 *
 * ── HOW IT BEHAVES WHEN IT GOES WRONG ───────────────────────────────────────────────────────
 * Invites die. A shop gets banned, the owner rotates the link, Discord rate-limits us. Every
 * one of those ends the same way: that entry resolves to nothing and is simply absent from the
 * matching set. It never guesses an ID, never falls back to matching by name, and never makes
 * the rest of the list fail. A smaller list is a correct answer; a wrong ID is not.
 *
 * Resolution happens once per process and is then held for a day, so a dashboard that is open
 * all day costs twelve requests to Discord in total.
 */

/**
 * The shipped list. Each entry is an invite the operator did not have to find.
 * Adding one is one line; nothing else in the system needs to change.
 */
export const BUILTIN_INVITES = [
  'tzproject',
  'susano',
  'ge34A2vx5G',
  'heBYXySk7Y',
  '333store',
  'fastshop',
  '420service',
  'bBd7s5y',
  'vence',
  'ASQJtfDe5',
  'H5rk6hZyMd',
  'lmarket1',
];

const DAY_MS = 24 * 60 * 60 * 1000;
let cache = { at: 0, servers: null, inflight: null };

async function resolveOne(code) {
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, {
      headers: { 'User-Agent': 'HeRoShield (dashboard, 1.0)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.guild || !j.guild.id) return null;
    return {
      guild_id: String(j.guild.id),
      name: j.guild.name || null,
      icon: j.guild.icon || null,
      invite: `https://discord.gg/${code}`,
      builtin: true,
    };
  } catch { return null; }      // dead invite, rate limit, no network: this entry is absent
}

/**
 * The built-in servers, as far as they could be resolved.
 * Never throws: the caller merges whatever comes back, including an empty list.
 */
export async function builtinCheatServers() {
  if (cache.servers && Date.now() - cache.at < DAY_MS) return cache.servers;
  // Several dashboard tabs can ask at the same moment; one resolution serves them all.
  if (cache.inflight) return cache.inflight;

  cache.inflight = (async () => {
    const out = (await Promise.all(BUILTIN_INVITES.map(resolveOne))).filter(Boolean);
    // Two invites can point at the same server.
    const seen = new Set();
    const servers = out.filter((s) => (seen.has(s.guild_id) ? false : (seen.add(s.guild_id), true)));
    // Only a result worth keeping resets the clock. If every invite failed — which is what a
    // rate limit looks like — we retry sooner rather than serving an empty list for a day.
    if (servers.length) cache = { at: Date.now(), servers, inflight: null };
    else cache = { at: Date.now() - (DAY_MS - 5 * 60 * 1000), servers, inflight: null };
    return servers;
  })();

  try { return await cache.inflight; } finally { cache.inflight = null; }
}
