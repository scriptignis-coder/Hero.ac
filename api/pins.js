import crypto from 'node:crypto';
import { wrap, send, requireAccess, readBody, sb, enc, str, httpError } from './_lib.js';
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPin=()=>Array.from({length:8},()=>ALPHA[crypto.randomInt(ALPHA.length)]).join('');
export default wrap(async(req,res)=>{
 const user=await requireAccess(req,'herocheck'); const owner=String(user.id);
 const licenses=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=id,label,license_key,revoked_at,created_at`);
 const owned=new Map((licenses||[]).map(l=>[l.id,l]));
 if(req.method==='GET'){
  const ids=[...owned.keys()];
  if(!ids.length) return send(res,200,{pins:[],licenses:[]});
  const pins=await sb(`scan_pins?license_id=in.(${ids.map(enc).join(',')})&select=*&order=created_at.desc&limit=200`);
  return send(res,200,{pins:(pins||[]).map(p=>({...p,scanner_licenses:{label:owned.get(p.license_id)?.label||'Scanner'}})),licenses:licenses||[]});
 }
 if(req.method==='POST'){
  const b=readBody(req);const license=owned.get(String(b.license_id||''));
  if(!license||license.revoked_at) throw httpError(403,'Active scanner license required');
  const row={license_id:license.id,pin:newPin(),player:str(b.player,80)||null};
  const created=await sb('scan_pins',{method:'POST',body:row,prefer:'return=representation'});
  return send(res,201,{pin:created[0]});
 }
 if(req.method==='DELETE'){
  const id=String(req.query.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400,'Invalid PIN ID');
  const rows=await sb(`scan_pins?id=eq.${enc(id)}&select=id,license_id`);
  if(!rows?.length||!owned.has(rows[0].license_id)) throw httpError(404,'PIN not found');
  await sb(`scan_pins?id=eq.${enc(id)}&license_id=eq.${enc(rows[0].license_id)}`,{method:'DELETE'});
  return send(res,200,{ok:true});
 }
 throw httpError(405,'Method not allowed');
});
