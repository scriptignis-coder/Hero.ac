// Unban from dashboard (session) or FiveM (x-license)
import { wrap, send, readBody, sb, enc, str, httpError, getSession, requireOwnedServer, requireLicense } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const b = readBody(req);
  const banId = str(b.banId, 20).toUpperCase();
  if (!banId) throw httpError(400, 'Missing banId');

  let serverId;
  let fromDashboard = false;
  if (req.headers['x-license']) {
    serverId = (await requireLicense(req)).id;
  } else {
    const user = getSession(req);
    if (!user) throw httpError(401, 'Not logged in');
    serverId = (await requireOwnedServer(user, b.server)).id;
    fromDashboard = true;
  }

  const rows = await sb(`bans?server_id=eq.${serverId}&ban_id=eq.${enc(banId)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { active: false, unban_pending: fromDashboard },
  });
  if (!rows || !rows.length) throw httpError(404, 'Ban not found');
  send(res, 200, { ok: true });
});
