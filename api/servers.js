
import { wrap, send, readBody, sb, enc, str, httpError, requireUser, requireOwnedServer, newLicense } from './_lib.js';

export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const rows = await sb(`servers?owner_discord=eq.${enc(user.id)}&select=id,name,license,last_seen,created_at&order=created_at.asc`);
    return send(res, 200, { servers: rows || [] });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    const name = str(b.name, 50).trim();
    if (name.length < 2) throw httpError(400, 'Name too short');
    const count = await sb(`servers?owner_discord=eq.${enc(user.id)}&select=id`);
    if ((count || []).length >= 5) throw httpError(400, 'Max 5 servers per account');
    const rows = await sb('servers', {
      method: 'POST',
      prefer: 'return=representation',
      body: { owner_discord: user.id, name, license: newLicense() },
    });
    return send(res, 201, { server: rows[0] });
  }

  if (req.method === 'PATCH') {
    const b = readBody(req);
    const server = await requireOwnedServer(user, b.id);
    const rows = await sb(`servers?id=eq.${server.id}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { license: newLicense() },
    });
    return send(res, 200, { server: rows[0] });
  }

  if (req.method === 'DELETE') {
    const server = await requireOwnedServer(user, req.query.id);
    await sb(`servers?id=eq.${server.id}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
