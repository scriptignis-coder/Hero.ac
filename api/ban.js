// FiveM (x-license header)
import { wrap, send, readBody, requireLicense, sb, str, httpError } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const server = await requireLicense(req);
  const b = readBody(req);
  if (!b.banId) throw httpError(400, 'Missing banId');
  await sb('bans?on_conflict=server_id,ban_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      server_id: server.id,
      ban_id: str(b.banId, 20).toUpperCase(),
      player: str(b.player, 100),
      identifier: str(b.identifier, 120),
      reason: str(b.reason, 60),
      info: str(b.info, 300),
      identifiers: Array.isArray(b.identifiers) ? b.identifiers.slice(0, 20).map((x) => str(x, 120)) : [],
      active: true,
      unban_pending: false,
    },
  });
  send(res, 201, { ok: true });
});
