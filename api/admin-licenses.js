import { wrap, send, readBody, sb, enc, httpError, requireAccess, audit, clearAccessCache } from './_lib.js';
export default wrap(async (req, res) => {
  const me = await requireAccess(req, 'admin');

  // GET  → list all licenses + members
  if (req.method === 'GET') {
    // Columns must match the real table (MIGRATION-ACCOUNT-LICENSES-V7 / FIX-LICENSE-DATABASE-V13):
    // there is NO "plan" column here — "plan" lives on hs_licenses. Enterprise vs Personal is the
    // "enterprise" boolean.
    const rows = await sb('hs_account_licenses?select=id,license_key,discord_user_id,claimed_discord,duration_unit,duration_value,expires_at,revoked,enterprise,enterprise_name,seats,redeemed_at,created_at&order=created_at.desc&limit=200');
    // fetch members for each license.
    // hs_account_license_members has only (license_id, discord_id, created_at) and a COMPOSITE
    // primary key — no "id" column, so members are identified by license_id + discord_id.
    const ids = (rows || []).map(r => r.id).filter(Boolean);
    let members = [];
    if (ids.length) {
      members = await sb(`hs_account_license_members?license_id=in.(${ids.join(',')})&select=license_id,discord_id,created_at`) || [];
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
    const { action, license_id, discord_id } = readBody(req);

    // Everyone whose access depends on this license. Access is cached per Discord id, so
    // without clearing it a revoked owner keeps working and an unrevoked one stays locked
    // out until the cache happens to expire — which looks random from the outside.
    const touched = async (id) => {
      const rows = await sb(`hs_account_licenses?id=eq.${enc(id)}&select=claimed_discord,discord_user_id`);
      const members = await sb(`hs_account_license_members?license_id=eq.${enc(id)}&select=discord_id`) || [];
      const ids = new Set();
      for (const r of rows || []) { if (r.claimed_discord) ids.add(String(r.claimed_discord)); if (r.discord_user_id) ids.add(String(r.discord_user_id)); }
      for (const m of members) if (m.discord_id) ids.add(String(m.discord_id));
      return [...ids];
    };

    if (action === 'revoke' || action === 'unrevoke') {
      if (!license_id) throw httpError(400, 'license_id required');
      const ids = await touched(license_id);
      await sb(`hs_account_licenses?id=eq.${enc(license_id)}`, { method: 'PATCH', body: { revoked: action === 'revoke' }, prefer: 'return=minimal' });
      for (const id of ids) clearAccessCache(id);
      await audit(me.id, `license.${action}`, { target: String(license_id), detail: { affected: ids } });
      return send(res, 200, { ok: true, affected: ids.length });
    }

    // Permanent delete. The members rows go first, so no row is left pointing at a license
    // that no longer exists.
    if (action === 'delete') {
      if (!license_id) throw httpError(400, 'license_id required');
      const ids = await touched(license_id);
      await sb(`hs_account_license_members?license_id=eq.${enc(license_id)}`, { method: 'DELETE', prefer: 'return=minimal' });
      await sb(`hs_account_licenses?id=eq.${enc(license_id)}`, { method: 'DELETE', prefer: 'return=minimal' });
      for (const id of ids) clearAccessCache(id);
      await audit(me.id, 'license.delete', { target: String(license_id), detail: { affected: ids } });
      return send(res, 200, { ok: true, affected: ids.length });
    }

    if (action === 'remove_member') {
      // composite key: both parts are required, there is no single member id
      if (!license_id || !discord_id) throw httpError(400, 'license_id and discord_id required');
      await sb(`hs_account_license_members?license_id=eq.${enc(license_id)}&discord_id=eq.${enc(discord_id)}`,
               { method: 'DELETE', prefer: 'return=minimal' });
      clearAccessCache(String(discord_id));
      await audit(me.id, 'license.remove_member', { target: `${license_id}/${discord_id}` });
      return send(res, 200, { ok: true });
    }

    throw httpError(400, 'Unknown action');
  }

  throw httpError(405, 'Method not allowed');
});
