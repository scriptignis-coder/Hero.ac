// FiveM: player join / leave + playtime
import { wrap, send, readBody, requireLicense, sb, str, enc, httpError } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const server = await requireLicense(req);
  const b = readBody(req);
  const identifier = str(b.identifier, 120);
  if (!identifier) throw httpError(400, 'Missing identifier');

  const rows = await sb(`players?server_id=eq.${server.id}&identifier=eq.${enc(identifier)}&select=id,playtime,sessions`);
  const existing = rows && rows[0];
  const now = new Date().toISOString();
  const name = str(b.player, 100);

  if (b.event === 'join') {
    if (existing) {
      await sb(`players?id=eq.${existing.id}`, {
        method: 'PATCH',
        body: { player: name, online: true, last_seen: now, sessions: existing.sessions + 1 },
      });
    } else {
      await sb('players', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { server_id: server.id, identifier, player: name, online: true, sessions: 1, last_seen: now },
      });
    }
  } else if (b.event === 'leave') {
    const add = Math.max(0, Math.min(86400, parseInt(b.playtime, 10) || 0));
    if (existing) {
      await sb(`players?id=eq.${existing.id}`, {
        method: 'PATCH',
        body: { online: false, last_seen: now, playtime: existing.playtime + add },
      });
    }
  } else {
    throw httpError(400, 'Invalid event');
  }
  send(res, 200, { ok: true });
});
