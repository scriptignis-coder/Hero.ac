import { wrap, send, requireUser, requireOwnedServer, readBody, sb, enc, str, httpError } from './_lib.js';
import crypto from 'node:crypto';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPin = () => Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');

// Scan PINs for the screenshare scanner. Scoped to a server the user owns.
export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const server = await requireOwnedServer(user, req.query.server);
    const pins = await sb(`scan_pins?server_id=eq.${server.id}&select=*&order=created_at.desc&limit=100`);
    return send(res, 200, { pins: pins || [] });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    const server = await requireOwnedServer(user, b.server);
    const row = { server_id: server.id, pin: newPin(), player: str(b.player, 80) || null };
    const created = await sb('scan_pins', { method: 'POST', body: row, prefer: 'return=representation' });
    return send(res, 200, { pin: Array.isArray(created) ? created[0] : created });
  }

  if (req.method === 'DELETE') {
    const server = await requireOwnedServer(user, req.query.server);
    await sb(`scan_pins?id=eq.${enc(req.query.id)}&server_id=eq.${server.id}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
