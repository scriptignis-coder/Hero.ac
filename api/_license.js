import { sb, enc, httpError } from './_lib.js';
export const active = row => !!row && row.status === 'active' && (!row.expires_at || Date.parse(row.expires_at)>Date.now());
export async function accountLicense(user) {
  if (!user) return null;
  const id = String(user.id);
  const mine = await sb(`hs_licenses?owner_identity=eq.${enc(id)}&select=*&order=created_at.desc&limit=1`);
  if (active(mine?.[0])) return { ...mine[0], role:'owner' };
  const memberships = await sb(`hs_license_members?identity=eq.${enc(id)}&select=license_id`);
  for (const m of memberships || []) {
    const rows=await sb(`hs_licenses?id=eq.${enc(m.license_id)}&select=*`);
    if (active(rows?.[0])) return {...rows[0],role:'member'};
  }
  return null;
}
export async function requireLicense(user) {
  const license = await accountLicense(user);
  if (!license) throw httpError(403,'An active license is required');
  return license;
}
