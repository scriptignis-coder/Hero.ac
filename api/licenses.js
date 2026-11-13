import crypto from 'node:crypto';
import {wrap,send,requireUser,readBody,httpError,sb,enc} from './_lib.js';
import {accountLicense,requireLicense} from './_license.js';
export default wrap(async(req,res)=>{
 const user=requireUser(req);
 const discord=String(user.id||'');
 if(!/^\d{17,20}$/.test(discord))throw httpError(403,'Discord login required');
 if(req.method==='GET'){
  const license=await accountLicense(user);
  if(!license)return send(res,200,{license:null,members:[]});
  const members=license.role==='owner'&&license.enterprise?await sb(`hs_account_license_members?license_id=eq.${enc(license.id)}&select=discord_id,created_at`):[];
  return send(res,200,{license:{id:license.id,plan:license.plan,seats:license.seats,expires_at:license.expires_at,role:license.role},members:(members||[]).map(m=>({identity:m.discord_id,created_at:m.created_at}))});
 }
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const {action,identity,code}=readBody(req);
 if(action==='claim'){
  if(typeof code!=='string'||!/^HS-[A-F0-9]{32}$/.test(code))throw httpError(400,'Invalid activation code');
  const hash=crypto.createHash('sha256').update(code).digest('hex');
  try {await sb('rpc/hs_claim_account_license',{method:'POST',body:{p_hash:hash,p_discord:discord}});}
  catch(e){if(/unavailable|claimed|recipient|licensed/i.test(e.message))throw httpError(409,'License already redeemed, unavailable or not issued to this Discord account');throw e;}
  return send(res,200,{ok:true});
 }
 const license=await requireLicense(user);
 if(license.role!=='owner'||!license.enterprise)throw httpError(403,'Enterprise owner required');
 if(typeof identity!=='string'||!/^\d{17,20}$/.test(identity))throw httpError(400,'Enter a Discord User ID');
 if(identity===discord)throw httpError(400,'Owner is already included');
 if(action==='add'){
  try{await sb('rpc/hs_add_account_member',{method:'POST',body:{p_license:license.id,p_owner:discord,p_member:identity}});}
  catch(e){if(/seat|assigned|member|licensed|already/i.test(e.message))throw httpError(409,'No free seats or member already assigned');throw e;}
 }else if(action==='remove'){
  await sb(`hs_account_license_members?license_id=eq.${enc(license.id)}&discord_id=eq.${enc(identity)}`,{method:'DELETE'});
 }else throw httpError(400,'Unknown action');
 return send(res,200,{ok:true});
});
