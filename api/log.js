// FiveM: batch of server logs (x-license header)
import { wrap, send, readBody, requireLicense, sb, str, httpError } from './_lib.js';

const CATS = ['Startup', 'ResourceStart', 'ResourceStop', 'Join', 'Leave', 'Death', 'Revive', 'Weapon', 'Explosion', 'Admin'];

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const server = await requireLicense(req);
  const list = Array.isArray(readBody(req).logs) ? readBody(req).logs.slice(0, 50) : [];
  const rows = list
    .filter((l) => l && CATS.includes(l.category))
    .map((l) => ({
      server_id: server.id,
      category: l.category,
      title: str(l.title, 80),
      message: str(l.message, 400),
      player: str(l.player, 100),
      identifier: str(l.identifier, 120),
    }));
  if (rows.length) await sb('logs', { method: 'POST', prefer: 'return=minimal', body: rows });

  // keep 30 days of logs
  if (Math.random() < 0.02) {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    sb(`logs?server_id=eq.${server.id}&created_at=lt.${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => {});
  }
  send(res, 201, { ok: true, saved: rows.length });
});
