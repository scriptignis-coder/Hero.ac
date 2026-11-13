import {wrap,send,readBody,requireUser,getAccess,httpError,sb,enc,audit} from './_lib.js';
export default wrap(async(req,res)=>{
  const user=requireUser(req);const access=await getAccess(user);
  if(!(access.admin||access.heroshield))throw httpError(403,'Staff or Admin required');
  if(access.viewer&&req.method!=='GET')throw httpError(403,'View-only account');
  if(req.method==='GET'){
    const rows=await sb('hs_account_licenses?enterprise=eq.true&select=id,claimed_discord,discord_user_id,seats,expires_at,revoked,enterprise_name&order=created_at.desc&limit=500');
    return send(res,200,{enterprises:(rows||[]).map(r=>({id:r.id,owner:r.claimed_discord||r.discord_user_id,name:r.enterprise_name,seats:r.seats,expires_at:r.expires_at,revoked:r.revoked}))});
  }
  if(req.method!=='POST')throw httpError(405,'Method not allowed');
  const {id,name}=readBody(req);
  if(!/^[0-9a-f-]{36}$/i.test(String(id)))throw httpError(400,'Invalid license ID');
  if(typeof name!=='string'||name.trim().length<2||name.trim().length>80)throw httpError(400,'Name must be 2–80 characters');
  const rows=await sb(`hs_account_licenses?id=eq.${enc(id)}&enterprise=eq.true&select=id,claimed_discord,discord_user_id,enterprise_name`);
  if(!rows?.length)throw httpError(404,'Enterprise not found');
  await sb(`hs_account_licenses?id=eq.${enc(id)}&enterprise=eq.true`,{method:'PATCH',body:{enterprise_name:name.trim()}});
  await audit(user,'enterprise.rename',{target:rows[0].claimed_discord||rows[0].discord_user_id,detail:{license_id:id,old_name:rows[0].enterprise_name||null,new_name:name.trim()}});
  return send(res,200,{ok:true});
});
