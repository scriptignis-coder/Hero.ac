import { wrap, send, readBody, requireUser, getAccess, httpError, sb, enc, audit } from './_lib.js';

/**
 * Every account license, for the dashboard's License list tab.
 *
 * license-admin.js is the bot's door: it mints a license and is authenticated with the bot
 * secret. This is the staff door: it lists what exists and lets staff revoke or restore one.
 * They are deliberately separate, so the secret that can CREATE a license never has to be
 * known by the dashboard, and a staff session can never mint one.
 *
 * The license key itself is never returned. Only its SHA-256 lives in the table, and even that
 * stays here: staff need to know who holds a license and until when, not what to type in.
 */
export default wrap(async (req, res) => {
  const user = requireUser(req);
  const access = await getAccess(user);
  if (!(access.admin || access.heroshield)) throw httpError(403, 'Staff or Admin required');
  if (access.viewer && req.method !== 'GET') throw httpError(403, 'View-only account');

  if (req.method === 'GET') {
    const rows = await sb('hs_account_licenses'
      + '?select=id,discord_user_id,claimed_discord,enterprise,enterprise_name,seats,duration_unit,duration_value,expires_at,revoked,created_at'
      + '&order=created_at.desc&limit=1000');
    const now = Date.now();
    return send(res, 200, {
      licenses: (rows || []).map((r) => ({
        id: r.id,
        owner: r.claimed_discord || r.discord_user_id,
        issued_to: r.discord_user_id,
        claimed: !!r.claimed_discord,
        type: r.enterprise ? 'Enterprise' : 'Personal',
        name: r.enterprise_name || null,
        seats: r.seats || 1,
        duration: r.duration_unit === 'lifetime' || !r.duration_unit
          ? 'Lifetime' : `${r.duration_value} ${r.duration_unit}`,
        expires_at: r.expires_at,
        // Worked out here rather than in the page: "expired" has to mean the same thing to
        // the list, to the filter and to the scanner, and that is only true with one source.
        state: r.revoked ? 'revoked'
          : (r.expires_at && Date.parse(r.expires_at) < now) ? 'expired'
          : r.claimed_discord ? 'active' : 'unclaimed',
        created_at: r.created_at,
      })),
    });
  }

  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');

  const { id, action } = readBody(req);
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw httpError(400, 'Invalid license ID');
  if (!['revoke', 'restore', 'delete'].includes(action)) throw httpError(400, 'Invalid action');
  if (action === 'delete' && !access.admin) throw httpError(403, 'Admin required to delete licenses');

  const rows = await sb(`hs_account_licenses?id=eq.${enc(id)}&select=id,discord_user_id,claimed_discord,revoked`);
  if (!rows?.length) throw httpError(404, 'License not found');

  if (action === 'delete') {
    // Remove membership links first so no orphaned enterprise membership records remain.
    await sb(`hs_account_license_members?license_id=eq.${enc(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    await sb(`hs_account_licenses?id=eq.${enc(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    await audit(user, 'license.delete', { target: rows[0].claimed_discord || rows[0].discord_user_id, detail: { license_id: id } });
    return send(res, 200, { ok: true, deleted: true });
  }
  const revoked = action === 'revoke';
  await sb(`hs_account_licenses?id=eq.${enc(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { revoked } });
  await audit(user, revoked ? 'license.revoke' : 'license.restore', {
    target: rows[0].claimed_discord || rows[0].discord_user_id,
    detail: { license_id: id },
  });
  return send(res, 200, { ok: true, revoked });
});
