// Dashboard: send a command to the FiveM server (screenshot / kick / ban)
import { wrap, send, readBody, sb, str, httpError, requireUser, requireOwnedServer, publicUrl } from './_lib.js';

const TYPES = ['screenshot', 'kick', 'ban', 'stream'];
const safe = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const user = requireUser(req);
  const b = readBody(req);
  const server = await requireOwnedServer(user, b.server);
  if (!TYPES.includes(b.type)) throw httpError(400, 'Invalid command');
  const target = str(b.identifier, 120);
  if (!target) throw httpError(400, 'Missing player');

  await sb('commands', {
    method: 'POST',
    prefer: 'return=minimal',
    body: { server_id: server.id, type: b.type, target, reason: str(b.reason, 60) || null },
  });
  send(res, 201, { ok: true, liveUrl: publicUrl(`${server.id}/live/${safe(target)}.jpg`) });
});
