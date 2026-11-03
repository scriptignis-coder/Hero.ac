
import { wrap, send, sb, enc, httpError, requireUser, requireOwnedServer } from './_lib.js';

const count = async (path) => {
  const rows = await sb(`${path}${path.includes('?') ? '&' : '?'}select=id`);
  return (rows || []).length;
};

const search = (q, cols) => {
  const s = String(q || '').replace(/[,()*%]/g, '').trim().slice(0, 50);
  return s ? `&or=(${cols.map((c) => `${c}.ilike.*${enc(s)}*`).join(',')})` : '';
};

export default wrap(async (req, res) => {
  const user = requireUser(req);
  const server = await requireOwnedServer(user, req.query.server);
  const sid = server.id;
  const type = req.query.type || 'overview';

  if (type === 'overview') {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [detections, bans, players, online, recent, week] = await Promise.all([
      count(`detections?server_id=eq.${sid}`),
      count(`bans?server_id=eq.${sid}&active=eq.true`),
      count(`players?server_id=eq.${sid}`),
      count(`players?server_id=eq.${sid}&online=eq.true`),
      sb(`detections?server_id=eq.${sid}&select=player,reason,action,info,created_at&order=created_at.desc&limit=8`),
      sb(`detections?server_id=eq.${sid}&created_at=gte.${enc(since)}&select=reason,created_at&limit=5000`),
    ]);
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({ day: d.toISOString().slice(0, 10), count: 0 });
    }
    const byReason = {};
    for (const r of week || []) {
      const day = days.find((d) => d.day === r.created_at.slice(0, 10));
      if (day) day.count++;
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    }
    const top = Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, n]) => ({ reason, n }));
    return send(res, 200, {
      server: { id: sid, name: server.name, last_seen: server.last_seen },
      stats: { detections, bans, players, online },
      recent: recent || [],
      days,
      top,
    });
  }

  if (type === 'detections') {
    const rows = await sb(`detections?server_id=eq.${sid}${search(req.query.q, ['player', 'reason', 'identifier'])}&order=created_at.desc&limit=200`);
    return send(res, 200, { rows: rows || [] });
  }

  if (type === 'bans') {
    const rows = await sb(`bans?server_id=eq.${sid}${search(req.query.q, ['player', 'ban_id', 'reason', 'identifier'])}&order=created_at.desc&limit=200`);
    return send(res, 200, { rows: rows || [] });
  }

  if (type === 'logs') {
    const cat = String(req.query.cat || '').replace(/[^A-Za-z]/g, '').slice(0, 20);
    const rows = await sb(`logs?server_id=eq.${sid}${cat ? `&category=eq.${cat}` : ''}${search(req.query.q, ['player', 'title', 'message', 'identifier'])}&order=created_at.desc&limit=300`);
    return send(res, 200, { rows: rows || [] });
  }

  if (type === 'players') {
    const rows = await sb(`players?server_id=eq.${sid}${search(req.query.q, ['player', 'identifier'])}&order=online.desc,last_seen.desc&limit=200`);
    return send(res, 200, { rows: rows || [] });
  }

  throw httpError(400, 'Invalid type');
});
