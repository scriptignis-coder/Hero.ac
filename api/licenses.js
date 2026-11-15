import crypto from 'node:crypto';
import {wrap,send,requireUser,readBody,httpError,sb,enc,clearAccessCache,audit} from './_lib.js';
import {accountLicense,requireLicense} from './_license.js';
export default wrap(async(req,res)=>{
 const user=requireUser(req);
 const discord=String(user.id||'');
 if(!/^\d{17,20}$/.test(discord))throw httpError(403,'Discord login required');
 if(req.method==='GET'){
  const license=await accountLicense(user);
  if(!license)return send(res,200,{license:null,members:[]});
  const members=license.role==='owner'&&license.enterprise?await sb(`hs_account_license_members?license_id=eq.${enc(license.id)}&select=discord_id,created_at`):[];
  return send(res,200,{license:{id:license.id,plan:license.plan,enterprise_name:license.enterprise?license.enterprise_name||null:null,seats:license.seats,expires_at:license.expires_at,role:license.role,key_masked:license.role==='owner'?'HS-••••••••••••••••••••••••••••••••':null},members:(members||[]).map(m=>({identity:m.discord_id,created_at:m.created_at}))});
 }
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const {action,identity,code}=readBody(req);
 if(action==='claim'){
  if(typeof code!=='string'||!/^HS-[A-F0-9]{32}$/.test(code))throw httpError(400,'Invalid activation code');
  const hash=crypto.createHash('sha256').update(code).digest('hex');
  try {await sb('rpc/hs_claim_account_license',{method:'POST',body:{p_hash:hash,p_discord:discord}});}
  catch(e){
   // The claim can fail AFTER the database already recorded it — a timeout or a dropped
   // connection on the way back. The user then retries and gets "already redeemed" for a
   // license that is in fact their own. So before reporting anything, look the license up
   // and say what is actually true of it.
   let row=null;
   try{const rows=await sb(`hs_account_licenses?license_key=eq.${enc(hash)}&select=id,claimed_discord,discord_user_id,revoked,expires_at&limit=1`);row=rows&&rows[0];}catch{/* fall through to the generic message */}

   if(row){
    // already claimed by THIS account: the earlier attempt went through. Treat as success.
    if(row.claimed_discord&&String(row.claimed_discord)===discord){
     clearAccessCache(discord);
     return send(res,200,{ok:true,already:true});
    }
    if(row.revoked)throw httpError(409,'This license was revoked. Ask staff for a new one.');
    if(row.expires_at&&new Date(row.expires_at)<new Date())throw httpError(409,`This license expired on ${new Date(row.expires_at).toISOString().slice(0,10)}. Ask staff to renew it.`);
    if(row.claimed_discord)throw httpError(409,'This license is already redeemed by another Discord account. Ask staff to move it.');
    if(row.discord_user_id&&String(row.discord_user_id)!==discord)throw httpError(409,'This license was issued to a different Discord account. Ask staff to reissue it to you.');
    // The row exists, is free, and is yours to take — so the claim function itself failed.
    // Show what the database actually said: this is the only place that knows, and hiding it
    // leaves no way to tell a dropped connection from a function that is missing or renamed.
    console.error('hs_claim_account_license failed',{discord,hash,error:e.message});
    throw httpError(503,`The licence could not be activated. The database said: ${String(e.message||e).slice(0,300)}`);
   }
   if(/unavailable|claimed|recipient|licensed/i.test(e.message))throw httpError(409,'This activation code is not valid for this Discord account.');
   throw e;}
  clearAccessCache(discord);
  await audit(user,'license.claim',{target:discord,detail:{type:'account'}});
  return send(res,200,{ok:true});
 }
 const license=await requireLicense(user);
 if(license.role!=='owner'||!license.enterprise)throw httpError(403,'Enterprise owner required');
 if(typeof identity!=='string'||!/^\d{17,20}$/.test(identity))throw httpError(400,'Enter a Discord User ID');
 if(identity===discord)throw httpError(400,'Owner is already included');
 if(action==='add'){
  try{await sb('rpc/hs_add_account_member',{method:'POST',body:{p_license:license.id,p_owner:discord,p_member:identity}});}
  catch(e){
   if(/seats exhausted|seat/i.test(e.message))throw httpError(409,`All seats are used: this license has ${license.seats} seat(s) and one is yours. Remove a member or get more seats.`);
   if(/already licensed|already|assigned|licensed/i.test(e.message))throw httpError(409,'This Discord account already has its own license or is already in a team. It must be removed from that license first.');
   if(/invalid discord/i.test(e.message))throw httpError(400,'Enter a valid Discord User ID (17–20 digits).');
   if(/not authorized/i.test(e.message))throw httpError(403,'Your license is expired, revoked or not an Enterprise license.');
   throw e;}
 }else if(action==='remove'){
  await sb(`hs_account_license_members?license_id=eq.${enc(license.id)}&discord_id=eq.${enc(identity)}`,{method:'DELETE'});
 }else throw httpError(400,'Unknown action');
 clearAccessCache(identity);
 await audit(user,action==='add'?'enterprise.member_add':'enterprise.member_remove',{target:identity,detail:{license_id:license.id,owner:discord}});
 return send(res,200,{ok:true});
});
