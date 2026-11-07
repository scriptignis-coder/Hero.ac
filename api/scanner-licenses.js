import crypto from 'node:crypto';
import { wrap, send, requireAccess, sb, enc, readBody, httpError, str } from './_lib.js';
export default wrap(async (req,res)=>{
  const user=await requireAccess(req,'herocheck');
  const owner=String(user.id);
  if(req.method==='GET'){
    const licenses=await sb(`scanner_licenses?owner_discord=eq.${enc(owner)}&select=*&order=created_at.desc&limit=100`);
    return send(res,200,{licenses:licenses||[]});
  }
  if(req.method==='POST'){
    const body=readBody(req); const label=str(body.label||'My Scanner License',80).trim();
    if(!label) throw httpError(400,'License name required');
    const license_key='HSC-'+crypto.randomBytes(20).toString('hex').toUpperCase();
    const rows=await sb('scanner_licenses',{method:'POST',body:{owner_discord:owner,label,license_key},prefer:'return=representation'});
    return send(res,201,{license:rows[0]});
  }
  if(req.method==='DELETE'){
    const body=readBody(req); const id=String(body.id||'');
    if(!/^[0-9a-f-]{36}$/i.test(id)) throw httpError(400,'Invalid license');
    const rows=await sb(`scanner_licenses?id=eq.${enc(id)}&owner_discord=eq.${enc(owner)}&revoked_at=is.null&select=id`);
    if(!rows?.length) throw httpError(404,'License not found');
    await sb(`scanner_licenses?id=eq.${enc(id)}&owner_discord=eq.${enc(owner)}`,{method:'PATCH',body:{revoked_at:new Date().toISOString()}});
    return send(res,200,{ok:true});
  }
  throw httpError(405,'Method not allowed');
});
