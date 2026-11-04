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
    const mk = (x) => ({
      owner_discord: user.id,
      name: str(x.name, 80),
      file_names: toList(x.fileNames).map((s) => s.toLowerCase()),
      features: toList(x.features),
      domains: toList(x.domains).map((s) => s.toLowerCase()),
      hashes: toList(x.hashes).map((s) => s.toLowerCase()).filter((h) => h.length >= 32),
      severity: ['high', 'medium', 'low'].includes(x.severity) ? x.severity : 'high',
    });

    // bulk import: { bulk: [ {name, fileNames, domains, hashes, features, severity}, ... ] }
    if (Array.isArray(b.bulk)) {
      const rows = b.bulk
        .filter((x) => x && x.name && (toList(x.fileNames).length || toList(x.domains).length || toList(x.hashes).length))
        .slice(0, 500)
        .map(mk);
      if (!rows.length) throw httpError(400, 'No valid rows — each needs a name and at least one file name, domain or hash');
      await sb('signatures', { method: 'POST', body: rows, prefer: 'return=minimal' });
      return send(res, 200, { ok: true, added: rows.length });
    }

    if (!b.name || (!b.fileNames && !b.domains && !b.hashes))
      throw httpError(400, 'name and at least one of fileNames / domains / hashes required');
    const created = await sb('signatures', { method: 'POST', body: mk(b), prefer: 'return=representation' });
    return send(res, 200, { signature: Array.isArray(created) ? created[0] : created });
  }

  if (req.method === 'DELETE') {
    await sb(`signatures?id=eq.${enc(req.query.id)}&owner_discord=eq.${enc(user.id)}`, { method: 'DELETE' });
    return send(res, 200, { ok: true });
  }

  throw httpError(405, 'Method not allowed');
});
