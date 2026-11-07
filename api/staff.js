import { wrap, send, requireAccess, readBody, sb, enc, str, httpError, clearAccessCache } from './_lib.js';

// Staff team for the account. Owner-scoped.
export default wrap(async (req, res) => {
  const user = await requireAccess(req, 'admin');

  if (req.method === 'GET') {
    const rows = await sb(`staff?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.asc`);
    return send(res, 200, { staff: rows || [] });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.name) throw httpError(400, 'name required');
    const did = str(b.discordId, 40).trim();
    if (!/^\d{15,22}$/.test(did)) throw httpError(400, 'A valid Discord user ID is required');
    const hs = b.heroshield !== false;
    const hc = b.herocheck !== false;
    if (!hs && !hc) throw httpError(400, 'Choose at least one staff permission');
    const row = {
      owner_discord: user.id,
      name: str(b.name, 80),
      discord_id: did,
      role: b.role === 'admin' ? 'admin' : 'staff',
    };
    // Grant permissions first; an API failure must not silently create an unusable staff member.
    await sb('user_access?on_conflict=discord_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { discord_id: did, name: row.name, heroshield: hs, herocheck: hc } });
    const created = await sb('staff', { method: 'POST', body: row, prefer: 'return=representation' });
    clearAccessCache(did);
    return send(res, 200, { member: Array.isArray(created) ? created[0] : created, access: { heroshield: hs, herocheck: hc } });
  }

  if (req.method === 'DELETE') {
    const existing = await sb(`staff?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}&select=discord_id`);
    await sb(`staff?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
    // Do not silently revoke permissions assigned separately via the Access page.
    if (existing?.[0]?.discord_id) clearAccessCache(existing[0].discord_id);
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
