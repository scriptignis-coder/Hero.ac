import { wrap, send, readBody, sb, enc, httpError, requireAccess, audit } from './_lib.js';
export default wrap(async (req, res) => {
  const me = await requireAccess(req, 'admin');

  // GET  → list all licenses + members
  if (req.method === 'GET') {
    const rows = await sb('hs_account_licenses?select=id,license_key,discord_user_id,duration_unit,duration_value,expires_at,revoked,enterprise,seats,plan,created_at&order=created_at.desc&limit=200');
    // fetch members for each license
    const ids = (rows || []).map(r => r.id).filter(Boolean);
    let members = [];
    if (ids.length) {
      members = await sb(`hs_account_license_members?license_id=in.(${ids.join(',')})&select=id,license_id,discord_user_id,claimed_discord,role,joined_at`) || [];
    }
    const byLic = {};
    for (const m of members) { (byLic[m.license_id] ||= []).push(m); }
    const list = (rows || []).map(r => ({
      ...r,
      license_key: r.license_key ? `…${r.license_key.slice(-8)}` : null,   // don't expose full hash
      members: byLic[r.id] || [],
    }));
    return send(res, 200, list);
  }

  // POST → actions: revoke, unrevoke, remove_member
  if (req.method === 'POST') {
    const { action, license_id, member_id } = readBody(req);

    if (action === 'revoke' || action === 'unrevoke') {
      if (!license_id) throw httpError(400, 'license_id required');
      await sb(`hs_account_licenses?id=eq.${enc(license_id)}`, { method: 'PATCH', body: { revoked: action === 'revoke' }, prefer: 'return=minimal' });
      await audit(me.id, `license.${action}`, { target: String(license_id) });
      return send(res, 200, { ok: true });
    }

    if (action === 'remove_member') {
      if (!member_id) throw httpError(400, 'member_id required');
      await sb(`hs_account_license_members?id=eq.${enc(member_id)}`, { method: 'DELETE', prefer: 'return=minimal' });
      await audit(me.id, 'license.remove_member', { target: String(member_id) });
      return send(res, 200, { ok: true });
    }

    throw httpError(400, 'Unknown action');
  }

  throw httpError(405, 'Method not allowed');
});
