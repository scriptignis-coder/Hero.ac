import { wrap, send, requireUser, readBody, sb, enc, str, httpError } from './_lib.js';

const toList = (v) => Array.isArray(v)
  ? v.map((x) => str(x, 120)).filter(Boolean)
  : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

// Cheat signatures the scanner matches. Owner-scoped (apply to all the owner's servers).
export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const rows = await sb(`signatures?owner_discord=eq.${enc(user.id)}&select=*&order=created_at.asc`);
    return send(res, 200, { signatures: rows || [] });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.name || !b.fileNames) throw httpError(400, 'name and fileNames required');
    const row = {
      owner_discord: user.id,
      name: str(b.name, 80),
      file_names: toList(b.fileNames).map((s) => s.toLowerCase()),
      features: toList(b.features),
      severity: ['high', 'medium', 'low'].includes(b.severity) ? b.severity : 'high',
    };
    const created = await sb('signatures', { method: 'POST', body: row, prefer: 'return=representation' });
    return send(res, 200, { signature: Array.isArray(created) ? created[0] : created });
  }

  if (req.method === 'DELETE') {
    await sb(`signatures?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
