import crypto from 'node:crypto';
import {sb,enc} from './_lib.js';
import {accountLicense} from './_license.js';

// Scanner PIN records use the existing scanner_licenses foreign key.
// Provision one internal scanner license per licensed Discord account, never
// let clients create a scanner license or impersonate another account.
export async function scannerLicensesFor(user) {
  const owner=String(user.id);
  let rows=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=*&order=created_at.desc&limit=100`);
  const license=await accountLicense(user);
  if (!license) return {licenses:rows||[],account:null};
  const valid=(rows||[]).find(r=>!r.revoked_at);
  if (!valid) {
    // Conflict handling: retry read after concurrent requests. A database
    // unique constraint on owner_discord is recommended for stronger races.
    try {
      const key='HSC-'+crypto.randomBytes(20).toString('hex').toUpperCase();
      await sb('scanner_licenses',{method:'POST',body:{owner_discord:owner,label:'HeRoShield Account License',license_key:key},prefer:'return=minimal'});
    } catch(e) {
      rows=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=*&order=created_at.desc&limit=100`);
      if(!(rows||[]).some(r=>!r.revoked_at)) throw e;
    }
    rows=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=*&order=created_at.desc&limit=100`);
  }
  return {licenses:rows||[],account:license};
}
