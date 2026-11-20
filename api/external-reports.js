import { wrap, send, httpError, requireAccess, getSession, sb, enc } from './_lib.js';

// External verdicts are staff-submitted records, NEVER represented as scanner-verified evidence.
export default wrap(async (req, res) => {
  await requireAccess(req, 'herocheck');
  if (req.method === 'GET') {
    const id = String(req.query?.discord_id || '').trim();
    if (!/^\d{15,22}$/.test(id)) throw httpError(400, 'Valid Discord ID required');
    const rows = await sb(`hs_external_reports?discord_id=eq.${enc(id)}&select=id,source,verdict,notes,evidence_url,scanned_at,created_at&order=scanned_at.desc&limit=30`);
    return send(res, 200, { reports: rows || [], verified: false });
  }
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const access = await requireAccess(req, 'admin');
  const u = getSession(req);
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const id = String(b.discord_id || '').trim();
  const source = String(b.source || '').trim();
  const verdict = String(b.verdict || '').toLowerCase();
  const notes = String(b.notes || '').trim();
  const url = String(b.evidence_url || '').trim();
  if (!/^\d{15,22}$/.test(id)) throw httpError(400, 'Valid Discord ID required');
  if (!/^[a-zA-Z0-9 ._-]{2,60}$/.test(source)) throw httpError(400, 'Invalid scanner source');
  if (!['cheating','suspicious','clean','unknown'].includes(verdict)) throw httpError(400, 'Invalid verdict');
  if (notes.length > 2000) throw httpError(400, 'Notes too long');
  if (url && (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 1000)) throw httpError(400, 'Evidence URL must be HTTPS');
  const when = b.scanned_at ? new Date(b.scanned_at) : new Date();
  if (Number.isNaN(+when) || +when > Date.now() + 86400000) throw httpError(400, 'Invalid scan date');
  const rows = await sb('hs_external_reports', {method:'POST',prefer:'return=representation',body:{discord_id:id,source,verdict,notes:notes||null,evidence_url:url||null,scanned_at:when.toISOString(),created_by:String(u.id)}});
  send(res, 201, { report: rows?.[0] || null, verified: false });
});
