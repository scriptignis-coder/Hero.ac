// FiveM (x-license header)
import { wrap, send, readBody, requireLicense, sb, str, httpError } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const server = await requireLicense(req);
  const b = readBody(req);
  await sb('detections', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      server_id: server.id,
      player: str(b.player, 100),
      identifier: str(b.identifier, 120),
      reason: str(b.reason, 60),
      info: str(b.info, 300),
      action: ['ban', 'kick', 'log'].includes(b.action) ? b.action : 'log',
      identifiers: Array.isArray(b.identifiers) ? b.identifiers.slice(0, 20).map((x) => str(x, 120)) : [],
    },
  });
  send(res, 201, { ok: true });
});
