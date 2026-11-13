import { wrap, send, sb, enc, httpError, requireUser, getAccess } from './_lib.js';

// Admin only: the activity log (permissions given / removed, licenses, PINs, purchases).
// GET /api/audit-logs?action=permission&q=1234&limit=300
export default wrap(async (req, res) => {
  await requireUser, getAccess(req, 'admin');
  if (req.method !== 'GET') throw httpError(405, 'Method not allowed');
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '300', 10) || 300));
  const parts = [`select=*`, `order=created_at.desc`, `limit=${limit}`];
  const action = String(req.query.action || '').replace(/[^a-z.]/g, '').slice(0, 40);
  if (action) parts.push(`action=like.${enc(action + '*')}`);
  const q = String(req.query.q || '').replace(/[,()*%]/g, '').trim().slice(0, 50);
  if (q) parts.push(`or=(actor_discord.ilike.*${enc(q)}*,target_discord.ilike.*${enc(q)}*,actor_name.ilike.*${enc(q)}*,target_name.ilike.*${enc(q)}*)`);
  let rows;
  try { rows = await sb(`audit_logs?${parts.join('&')}`); }
  catch (e) {
    if (/audit_logs|schema cache|does not exist/i.test(e.message)) throw httpError(500, 'The activity log table is missing: run supabase-v19-permissions-logs.sql in Supabase → SQL Editor');
    throw e;
  }
  return send(res, 200, { logs: rows || [] });
});
