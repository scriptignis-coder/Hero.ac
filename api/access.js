import { wrap, send, readBody, sb, enc, str, httpError, requireAccess, clearAccessCache, isAdmin, envIds, requireUser, expiryFrom, durationText, audit } from './_lib.js';

// Admin only: who can open HeRo Shield (anticheat) and HeRo Check (screenshare), and for how long.
export default wrap(async (req, res) => {
  const me = await requireAccess(req, 'admin');

  if (req.method === 'GET') {
    const rows = await sb('user_access?select=discord_id,name,avatar,admin,heroshield,herocheck,expires_at,granted_by,granted_at,last_login,created_at&order=last_login.desc.nullslast&limit=500');
    // mark who already has access from Render env, and list env IDs that never logged in
    const env = envIds();
    const list = (rows || []).slice();
    const known = new Set(list.map((r) => String(r.discord_id)));
    for (const id of [...env.admin, ...env.heroshield, ...env.herocheck])
      if (!known.has(id)) { known.add(id); list.push({ discord_id: id, name: null, avatar: null, heroshield: false, herocheck: false, last_login: null }); }
    const now = Date.now();
    return send(res, 200, { users: list.map((r) => ({
      ...r,
      admin: isAdmin({ id: r.discord_id }) || !!r.admin,
      owner: isAdmin({ id: r.discord_id }),
      expired: !!(r.expires_at && Date.parse(r.expires_at) <= now),
      envHeroshield: env.heroshield.includes(String(r.discord_id)),
      envHerocheck: env.herocheck.includes(String(r.discord_id)),
    })) });
  }

  // add or change someone (works even before they ever logged in)
  // body: { discordId, herocheck?, heroshield?, admin?, duration?: { amount, unit: hour|day|week|month|year|lifetime } }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const b = readBody(req);
    const id = str(b.discordId, 40).trim();
    if (!/^\d{5,25}$/.test(id)) throw httpError(400, 'Enter a valid Discord user ID (numbers only)');
    const before = (await sb(`user_access?discord_id=eq.${enc(id)}&select=name,admin,heroshield,herocheck,expires_at`))?.[0] || {};
    // an expired grant counts as nothing (so giving it again is logged as a new grant)
    if (before.expires_at && Date.parse(before.expires_at) <= Date.now()) { before.admin = before.heroshield = before.herocheck = false; }
    const row = { discord_id: id };
    if (b.admin !== undefined) {
      if (!isAdmin(requireUser(req))) throw httpError(403, 'Only the environment owner can grant or revoke Admin');
      if (isAdmin({ id })) throw httpError(403, 'Environment owner role cannot be modified');
      row.admin = !!b.admin;
    }
    if (b.heroshield !== undefined) row.heroshield = !!b.heroshield;
    if (b.herocheck !== undefined) row.herocheck = !!b.herocheck;
    if (b.name) row.name = str(b.name, 80);

    const after = { ...before, ...row };
    const hasAny = !!(after.admin || after.heroshield || after.herocheck);
    let durText = null;
    if (b.duration && hasAny) {
      row.expires_at = expiryFrom(b.duration.amount, b.duration.unit);
      durText = durationText(b.duration.amount, b.duration.unit);
    }
    if (!hasAny) row.expires_at = null;                 // nothing left to expire
    const wasExpired = !!(before.expires_at && Date.parse(before.expires_at) <= Date.now());
    const newlyGiven = ['admin', 'heroshield', 'herocheck'].some((k) => row[k] && !before[k]);
    if (hasAny && (b.duration || newlyGiven)) { row.granted_by = String(me.id); row.granted_at = new Date().toISOString(); }
    if (hasAny && newlyGiven && !b.duration && wasExpired) { row.expires_at = null; durText = 'lifetime'; }   // re-given without a time = lifetime

    await sb('user_access?on_conflict=discord_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: row,
    });
    clearAccessCache(id);

    // activity log: what changed
    const names = { admin: 'Admin', heroshield: 'HeRo Shield', herocheck: 'HeRo Check' };
    const given = [], removed = [];
    for (const k of ['admin', 'heroshield', 'herocheck']) {
      if (row[k] === undefined) continue;
      if (row[k] && !before[k]) given.push(names[k]);
      if (!row[k] && before[k]) removed.push(names[k]);
    }
    const expires = row.expires_at !== undefined ? row.expires_at : before.expires_at || null;
    if (given.length || (durText && hasAny))
      await audit(me, 'permission.grant', { target: id, targetName: row.name || before.name, detail: {
        permissions: (given.length ? given : ['admin', 'heroshield', 'herocheck'].filter((k) => after[k]).map((k) => names[k])),
        duration: durText || (before.expires_at ? 'unchanged' : 'lifetime'), expires_at: expires,
      } });
    if (removed.length)
      await audit(me, 'permission.revoke', { target: id, targetName: row.name || before.name, detail: { permissions: removed } });
    return send(res, 200, { ok: true, expires_at: expires });
  }

  if (req.method === 'DELETE') {
    const id = str(req.query.id, 40);
    if (isAdmin({ id })) throw httpError(403, 'Cannot remove environment owner');
    const target = await sb(`user_access?discord_id=eq.${enc(id)}&select=admin,name,heroshield,herocheck`);
    if (target?.[0]?.admin && !isAdmin(requireUser(req))) throw httpError(403, 'Only the environment owner can remove Admin');
    await sb(`user_access?discord_id=eq.${enc(id)}`, { method: 'DELETE' });
    clearAccessCache(id);
    await audit(me, 'permission.remove', { target: id, targetName: target?.[0]?.name, detail: { had: ['admin', 'heroshield', 'herocheck'].filter((k) => target?.[0]?.[k]).map((k) => ({ admin: 'Admin', heroshield: 'HeRo Shield', herocheck: 'HeRo Check' }[k])) } });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
