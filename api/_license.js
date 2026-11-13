import { sb, enc, httpError } from './_lib.js';
export const active = row => !!row && !row.revoked && (!row.expires_at || Date.parse(row.expires_at)>Date.now());
export async function accountLicense(user) {
 if (!user || !/^\d{17,20}$/.test(String(user.id))) return null;
 const id=String(user.id);
 const mine=await sb(`hs_account_licenses?claimed_discord=eq.${enc(id)}&select=id,enterprise,enterprise_name,seats,expires_at,revoked&limit=1`);
 if(active(mine?.[0]))return {...mine[0],plan:mine[0].enterprise?'enterprise':'personal',role:'owner'};
 const members=await sb(`hs_account_license_members?discord_id=eq.${enc(id)}&select=license_id`);
 for(const m of members||[]){
  const rows=await sb(`hs_account_licenses?id=eq.${enc(m.license_id)}&select=id,enterprise,enterprise_name,seats,expires_at,revoked`);
  if(active(rows?.[0])&&rows[0].enterprise)return {...rows[0],plan:'enterprise',role:'member'};
 }
 return null;
}
export async function requireLicense(user){
 const license=await accountLicense(user);
 if(!license)throw httpError(403,'An active license is required');
 return license;
}
