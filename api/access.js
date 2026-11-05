import { wrap, send, readBody, sb, enc, str, httpError, requireAccess, clearAccessCache, isAdmin, envIds } from './_lib.js';

// Admin only: who can open HeRo Shield (anticheat) and HeRo Check (screenshare).
export default wrap(async (req, res) => {
  await requireAccess(req, 'admin');

  if (req.method === 'GET') {
    const rows = await sb('user_access?select=discord_id,name,avatar,heroshield,herocheck,last_login,created_at&order=last_login.desc.nullslast&limit=500');
    // mark who already has access from Render env, and list env IDs that never logged in
    const env = envIds();
    const list = (rows || []).slice();
    const known = new Set(list.map((r) => String(r.discord_id)));
    for (const id of [...env.admin, ...env.heroshield, ...env.herocheck])
      if (!known.has(id)) { known.add(id); list.push({ discord_id: id, name: null, avatar: null, heroshield: false, herocheck: false, last_login: null }); }
    return send(res, 200, { users: list.map((r) => ({
      ...r,
      admin: isAdmin({ id: r.discord_id }),
      envHeroshield: env.heroshield.includes(String(r.discord_id)),
      envHerocheck: env.herocheck.includes(String(r.discord_id)),
    })) });
  }

  // add or change someone (works even before they ever logged in)
  if (req.method === 'POST' || req.method === 'PATCH') {
    const b = readBody(req);
    const id = str(b.discordId, 40).trim();
    if (!/^\d{5,25}$/.test(id)) throw httpError(400, 'Enter a valid Discord user ID (numbers only)');
    const row = { discord_id: id };
    if (b.heroshield !== undefined) row.heroshield = !!b.heroshield;
    if (b.herocheck !== undefined) row.herocheck = !!b.herocheck;
    if (b.name) row.name = str(b.name, 80);
    await sb('user_access?on_conflict=discord_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: row,
    });
    clearAccessCache(id);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    const id = str(req.query.id, 40);
    await sb(`user_access?discord_id=eq.${enc(id)}`, { method: 'DELETE' });
    clearAccessCache(id);
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
