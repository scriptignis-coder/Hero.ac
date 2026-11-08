
import { wrap, send, sb, enc, httpError, requireAccess, requireOwnedServer } from './_lib.js';

const count = async (path) => {
  const rows = await sb(`${path}${path.includes('?') ? '&' : '?'}select=id`);
  return (rows || []).length;
};

const search = (q, cols) => {
  const s = String(q || '').replace(/[,()*%]/g, '').trim().slice(0, 50);
  return s ? `&or=(${cols.map((c) => `${c}.ilike.*${enc(s)}*`).join(',')})` : '';
};

export default wrap(async (req, res) => {
  // the Discord ID lookup is a screenshare (HeRo Check) page; everything else is anticheat
  const user = await requireAccess(req, req.query.type === 'lookup' ? 'herocheck' : 'heroshield');

  // scanner-only accounts (no FiveM server): look the Discord ID up in the scans of YOUR scanner licenses
  if (req.query.type === 'lookup' && !/^[0-9a-f-]{36}$/i.test(String(req.query.server || ''))) {
    const raw = String(req.query.id || '').replace(/[^0-9]/g, '').slice(0, 25);
    if (!raw) return send(res, 200, { id: '', bans: [], detections: [], scans: [] });
    const lic = await sb(`scanner_licenses?owner_discord=eq.${enc(String(user.id))}&select=id`);
    const ids = (lic || []).map((l) => l.id);
    const scans = ids.length
      ? await sb(`scan_pins?license_id=in.(${ids.map(enc).join(',')})&or=(report->>DiscordId.eq.${enc(raw)},discord_check->user->>id.eq.${enc(raw)})&select=pin,player,result,created_at,discord_check&order=created_at.desc&limit=50`)
      : [];
    return send(res, 200, { id: raw, bans: [], detections: [], scans: scans || [] });
  }
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

  // look a Discord ID up across THIS server's own records (bans, detections, scans)
  if (type === 'lookup') {
    const raw = String(req.query.id || '').replace(/[^0-9]/g, '').slice(0, 25); // numeric Discord ID
    if (!raw) return send(res, 200, { id: '', bans: [], detections: [], scans: [] });
    const disc = enc(`["discord:${raw}"]`);
    const likeId = `*${enc(raw)}*`;
    const [bans, detections, scans] = await Promise.all([
      sb(`bans?server_id=eq.${sid}&or=(identifiers.cs.${disc},identifier.ilike.${likeId})&select=ban_id,player,reason,info,active,created_at&order=created_at.desc&limit=50`),
      sb(`detections?server_id=eq.${sid}&or=(identifiers.cs.${disc},identifier.ilike.${likeId})&select=player,reason,action,info,created_at&order=created_at.desc&limit=50`),
      sb(`scan_pins?server_id=eq.${sid}&or=(report->>DiscordId.eq.${enc(raw)},discord_check->user->>id.eq.${enc(raw)})&select=pin,player,result,created_at,discord_check&order=created_at.desc&limit=50`),
    ]);
    return send(res, 200, { id: raw, bans: bans || [], detections: detections || [], scans: scans || [] });
  }

  throw httpError(400, 'Invalid type');
});
