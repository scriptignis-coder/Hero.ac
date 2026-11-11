import crypto from 'node:crypto';
import { wrap, send, requireAccess, getAccess, readBody, sb, enc, str, httpError, audit } from './_lib.js';
import { GAMES, gameOf } from './_games.js';
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPin=()=>Array.from({length:8},()=>ALPHA[crypto.randomInt(ALPHA.length)]).join('');

// Clients (everyone who is not Admin) can create PIN_DAILY_LIMIT PINs per calendar day (default 1),
// counted in PIN_LIMIT_TZ (default Africa/Tunis). Deleting a PIN does not give the PIN back.
const DAILY = () => Math.max(0, parseInt(process.env.PIN_DAILY_LIMIT || '1', 10) || 0);
const TZ = () => process.env.PIN_LIMIT_TZ || 'Africa/Tunis';
export function dayStart(now = new Date(), tz = TZ()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const g = (t) => +((parts.find((p) => p.type === t) || {}).value || 0);
  return new Date(now.getTime() - ((g('hour') * 3600 + g('minute') * 60 + g('second')) * 1000 + now.getMilliseconds()));
}

async function quotaFor(user, access, licenseIds) {
  if (access.admin) return { unlimited: true };
  const limit = DAILY();
  const since = dayStart();
  const sinceIso = enc(since.toISOString());
  let byLog = 0, byPins = 0;
  try { byLog = ((await sb(`audit_logs?actor_discord=eq.${enc(String(user.id))}&action=eq.pin.create&created_at=gte.${sinceIso}&select=id`)) || []).length; } catch { }
  if (licenseIds.length)
    byPins = ((await sb(`scan_pins?license_id=in.(${licenseIds.map(enc).join(',')})&created_at=gte.${sinceIso}&select=id`)) || []).length;
  const used = Math.max(byLog, byPins);
  return { unlimited: false, limit, used, left: Math.max(0, limit - used), resetAt: new Date(since.getTime() + 86400e3).toISOString() };
}

export default wrap(async(req,res)=>{
 const user=await requireAccess(req,'herocheck'); const owner=String(user.id);
 const access=await getAccess(user);
 const licenses=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=id,label,license_key,revoked_at,created_at`);
 const owned=new Map((licenses||[]).map(l=>[l.id,l]));
 if(req.method==='GET'){
  const ids=[...owned.keys()];
  // one PIN with its full report (opened when staff click View) — the list below never sends reports
  if(req.query.pin){
   const one=String(req.query.pin).trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
   if(!one||!ids.length) throw httpError(404,'PIN not found');
   const rows=await sb(`scan_pins?pin=eq.${enc(one)}&license_id=in.(${ids.map(enc).join(',')})&select=*&limit=1`);
   if(!rows?.length) throw httpError(404,'PIN not found');
   return send(res,200,{pin:{...rows[0],scanner_licenses:{label:owned.get(rows[0].license_id)?.label||'Scanner'}}});
  }
  const quota=await quotaFor(user,access,ids);
  if(!ids.length) return send(res,200,{pins:[],licenses:[],quota});
  // light list: no report (a report can be several MB — sending 200 of them made the PIN tab slow)
  const base=`scan_pins?license_id=in.(${ids.map(enc).join(',')})&order=created_at.desc&limit=200&select=`;
  const pins=await sb(base+'id,pin,player,used,result,game,created_at,license_id')
   .catch(()=>sb(base+'id,pin,player,used,result,created_at,license_id'));   // before supabase-v30-games.sql
  return send(res,200,{pins:(pins||[]).map(p=>({...p,scanner_licenses:{label:owned.get(p.license_id)?.label||'Scanner'}})),licenses:licenses||[],quota});
 }
 if(req.method==='POST'){
  const b=readBody(req);const license=owned.get(String(b.license_id||''));
  if(!license||license.revoked_at) throw httpError(403,'Active scanner license required');
  const quota=await quotaFor(user,access,[...owned.keys()]);
  if(!quota.unlimited && quota.left<=0){
   const at=new Date(quota.resetAt).toLocaleTimeString('en-GB',{timeZone:TZ(),hour:'2-digit',minute:'2-digit'});
   throw httpError(429,`Daily limit reached: ${quota.limit} PIN per day. You can create a new PIN after ${at} (${TZ()} time).`);
  }
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
  return send(res,201,{pin:created[0],quota:quota.unlimited?quota:{...quota,used:quota.used+1,left:Math.max(0,quota.left-1)}});
 }
 if(req.method==='DELETE'){
  const id=String(req.query.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400,'Invalid PIN ID');
  const rows=await sb(`scan_pins?id=eq.${enc(id)}&select=id,license_id,pin`);
  if(!rows?.length||!owned.has(rows[0].license_id)) throw httpError(404,'PIN not found');
  await sb(`scan_pins?id=eq.${enc(id)}&license_id=eq.${enc(rows[0].license_id)}`,{method:'DELETE'});
  await audit(user,'pin.delete',{target:owner,targetName:user.name,detail:{pin:rows[0].pin}});
  return send(res,200,{ok:true});
 }
 throw httpError(405,'Method not allowed');
});
