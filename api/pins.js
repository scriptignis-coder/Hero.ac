import { lookupScans, lookupBans } from './_pchistory.js';
import crypto from 'node:crypto';
import { wrap, send, requireAccess, getAccess, readBody, sb, enc, str, httpError, audit } from './_lib.js';
import { GAMES, gameOf } from './_games.js';
import {scannerLicensesFor} from './_scanner-account.js';
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPin=()=>Array.from({length:8},()=>ALPHA[crypto.randomInt(ALPHA.length)]).join('');

// No daily PIN quota. Authorization is still checked on every request.
// An active account license is required for non-staff users; expired and
// revoked licenses cannot generate or retrieve new scan PINs.
async function quotaFor() { return { unlimited: true }; }

export default wrap(async(req,res)=>{
 const user=await requireAccess(req,'herocheck'); const owner=String(user.id);
 const access=await getAccess(user);
 const {licenses,account}=await scannerLicensesFor(user);
 const staff=!!(access.admin || access.heroshield);
 const permitted=(account || staff) ? (licenses||[]).filter(l=>!l.revoked_at) : [];
 const owned=new Map(permitted.map(l=>[l.id,l]));
 if(req.method==='GET'){
  const ids=[...owned.keys()];
  // one PIN with its full report (opened when staff click View) — the list below never sends reports
  if(req.query.pin){
   const one=String(req.query.pin).trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
   if(!one||!ids.length) throw httpError(404,'PIN not found');
   const rows=await sb(`scan_pins?pin=eq.${enc(one)}&license_id=in.(${ids.map(enc).join(',')})&select=*&limit=1`);
   if(!rows?.length) throw httpError(404,'PIN not found');
   // player history is read again when the report is opened, so a ban or a scan made AFTER this scan shows too
   const row=rows[0];
   if(row.report&&typeof row.report==='object'){
    const [h,b]=await Promise.all([lookupScans(row.report,row.license_id,row.id).catch(()=>null),lookupBans(row.report).catch(()=>null)]);
    row.report={...row.report,...(h?{PcHistory:h}:{}),...(b?{BanHistory:b}:{})};
   }
   return send(res,200,{pin:{...row,scanner_licenses:{label:owned.get(row.license_id)?.label||'Scanner'}}});
  }
  const quota=await quotaFor(user,access,ids);
  if(!ids.length) return send(res,200,{pins:[],licenses:[],quota});
  // light list: no report (a report can be several MB — sending 200 of them made the PIN tab slow)
  const base=`scan_pins?license_id=in.(${ids.map(enc).join(',')})&order=created_at.desc&limit=200&select=`;
  const pins=await sb(base+'id,pin,player,used,result,game,created_at,license_id')
   .catch(()=>sb(base+'id,pin,player,used,result,created_at,license_id'));   // before supabase-v30-games.sql
  return send(res,200,{pins:(pins||[]).map(p=>({...p,scanner_licenses:{label:owned.get(p.license_id)?.label||'Scanner'}})),licenses:permitted,quota});
 }
 if(req.method==='POST'){
  const b=readBody(req);const license=owned.get(String(b.license_id||''));
  if(!license||license.revoked_at) throw httpError(403,'Active account or scanner license required');
  const quota=await quotaFor(user,access,[...owned.keys()]);
  if(b.game!==undefined && !Object.prototype.hasOwnProperty.call(GAMES,String(b.game).toLowerCase())) throw httpError(400,'Unknown game');
  const game=gameOf(b.game);
  const row={license_id:license.id,pin:newPin(),player:str(b.player,80)||null,game};
  let created;
  try { created=await sb('scan_pins',{method:'POST',body:row,prefer:'return=representation'}); }
  catch(e){
   if(!/game/i.test(e.message)) throw e;
   // before supabase-v30-games.sql: FiveM PINs still work, other games need the column
   if(game!=='fivem') throw httpError(500,'Run supabase-v30-games.sql in Supabase first (adds games to scan PINs)');
   delete row.game; created=await sb('scan_pins',{method:'POST',body:row,prefer:'return=representation'});
  }
  await audit(user,'pin.create',{target:owner,targetName:user.name,detail:{pin:created[0]?.pin,player:row.player,license:license.label,game:GAMES[game]}});
  return send(res,201,{pin:created[0],quota});
 }
 if(req.method==='DELETE'){
  const id=String(req.query.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400,'Invalid PIN ID');
  const rows=await sb(`scan_pins?id=eq.${enc(id)}&select=id,license_id,pin,used`);
  if(!rows?.length||!owned.has(rows[0].license_id)) throw httpError(404,'PIN not found');
  // only a pending PIN can be deleted: a used PIN holds a report (proof)
  if(rows[0].used) throw httpError(409,'This PIN was already used — its report is kept');
  await sb(`scan_pins?id=eq.${enc(id)}&license_id=eq.${enc(rows[0].license_id)}&used=eq.false`,{method:'DELETE'});
  await audit(user,'pin.delete',{target:owner,targetName:user.name,detail:{pin:rows[0].pin}});
  return send(res,200,{ok:true});
 }
 throw httpError(405,'Method not allowed');
});
