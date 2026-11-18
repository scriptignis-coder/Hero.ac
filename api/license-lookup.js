import { wrap, send, requireUser, getAccess, httpError, sb, enc } from './_lib.js';

// Staff-only, exact Discord ID lookup. Never expose license keys or hashes.
export default wrap(async (req, res) => {
  if (req.method !== 'GET') throw httpError(405, 'Method not allowed');
  const user = requireUser(req);
  const access = await getAccess(user);
  if (!(access.admin || access.heroshield)) throw httpError(403, 'Staff or Admin required');
  const id = String(req.query?.discord_id || '').trim();
  if (!/^\d{17,20}$/.test(id)) throw httpError(400, 'Enter a valid Discord user ID (17–20 digits)');
  const fields = 'id,discord_user_id,claimed_discord,enterprise,enterprise_name,seats,expires_at,revoked,created_at';
  const [issued, claimed, memberships] = await Promise.all([
    sb(`hs_account_licenses?discord_user_id=eq.${enc(id)}&select=${fields}&limit=100`),
    sb(`hs_account_licenses?claimed_discord=eq.${enc(id)}&select=${fields}&limit=100`),
    sb(`hs_account_license_members?discord_id=eq.${enc(id)}&select=license_id&limit=100`)
  ]);
  const byId = new Map();
  for (const row of [...(issued || []), ...(claimed || [])]) byId.set(String(row.id), row);
  const memberIds = new Set((memberships || []).map(x => String(x.license_id)));
  for (const memberId of memberIds) {
    if (byId.has(memberId)) continue;
    const rows = await sb(`hs_account_licenses?id=eq.${enc(memberId)}&select=${fields}&limit=1`);
    if (rows?.[0]?.enterprise) byId.set(memberId, rows[0]);
  }
  const now = Date.now();
  const licenses = [...byId.values()].map(row => {
    const expired = !!row.expires_at && Date.parse(row.expires_at) <= now;
    const state = row.revoked ? 'revoked' : expired ? 'expired' : row.claimed_discord ? 'active' : 'unclaimed';
    const relation = memberIds.has(String(row.id)) ? 'enterprise member' : String(row.claimed_discord || '') === id ? 'owner' : 'issued to';
    return { id: row.id, state, relation, type: row.enterprise ? 'Enterprise' : 'Personal',
      name: row.enterprise_name || null, expires_at: row.expires_at || null,
      issued_to: row.discord_user_id, claimed: !!row.claimed_discord };
  });
  return send(res, 200, { discord_id: id, has_active_license: licenses.some(x => x.state === 'active' && x.relation !== 'issued to'), licenses });
});
