// GET (dashboard): proof of a ban | POST (FiveM, x-license): save proof links
import {
  wrap, send, readBody, sb, enc, httpError, requireUser, requireOwnedServer, requireLicense,
  storageList, publicUrl,
} from './_lib.js';

const cleanId = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 20);
const urls = (list, max) => (Array.isArray(list) ? list : [])
  .filter((u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u)).slice(0, max);

export default wrap(async (req, res) => {
  if (req.method === 'POST') {
    const server = await requireLicense(req);
    const b = readBody(req);
    const banId = cleanId(b.banId);
    if (!banId) throw httpError(400, 'Missing banId');
    await sb('bans?on_conflict=server_id,ban_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { server_id: server.id, ban_id: banId, proof: { shots: urls(b.shots, 10), replay: urls(b.replay, 120), interval: Math.max(1, Math.min(60, Number(b.interval) || 8)) } },
    });
    return send(res, 200, { ok: true });
  }

  const user = requireUser(req);
  const server = await requireOwnedServer(user, req.query.server);
  const banId = cleanId(req.query.banId);
  if (!banId) throw httpError(400, 'Missing banId');

  const rows = await sb(`bans?server_id=eq.${server.id}&ban_id=eq.${enc(banId)}&select=proof`);
  const proof = (rows && rows[0] && rows[0].proof) || {};
  let shots = urls(proof.shots, 10);
  let replay = urls(proof.replay, 120);
  const interval = Number(proof.interval) || 8;

  // older bans: read the storage folder
  if (!shots.length && !replay.length) {
    const prefix = `${server.id}/bans/${banId}`;
    const names = await storageList(prefix);
    shots = names.filter((n) => /^(0|p\d+)\.jpg$/.test(n)).sort().map((n) => publicUrl(`${prefix}/${n}`));
    replay = names.filter((n) => /^r\d+\.jpg$/.test(n)).sort().map((n) => publicUrl(`${prefix}/${n}`));
  }
  send(res, 200, { shots, replay, interval });
});
