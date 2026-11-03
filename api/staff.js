import { wrap, send, requireUser, readBody, sb, enc, str, httpError } from './_lib.js';

// Staff team for the account. Owner-scoped.
export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const rows = await sb(`staff?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.asc`);
    return send(res, 200, { staff: rows || [] });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.name) throw httpError(400, 'name required');
    const row = {
      owner_discord: user.id,
      name: str(b.name, 80),
      discord_id: str(b.discordId, 40) || null,
      role: b.role === 'admin' ? 'admin' : 'staff',
    };
    const created = await sb('staff', { method: 'POST', body: row, prefer: 'return=representation' });
    return send(res, 200, { member: Array.isArray(created) ? created[0] : created });
  }

  if (req.method === 'DELETE') {
    await sb(`staff?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
