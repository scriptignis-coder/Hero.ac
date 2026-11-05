// Dashboard: latest live screenshot of a player
import { wrap, send, sb, enc, str, httpError, requireUser, requireOwnedServer } from './_lib.js';

export default wrap(async (req, res) => {
  const user = requireUser(req);
  const server = await requireOwnedServer(user, req.query.server);
  const identifier = str(req.query.identifier, 120);
  if (!identifier) throw httpError(400, 'Missing player');
  const rows = await sb(`players?server_id=eq.${server.id}&identifier=eq.${enc(identifier)}&select=live_url,live_at,live_size`);
  const r = (rows && rows[0]) || {};
  send(res, 200, { url: r.live_url || null, at: r.live_at || null, size: r.live_size || 0 });
});
