import {wrap,send,requireUser,readBody,httpError,sb,enc} from './_lib.js';
import {accountLicense,requireLicense} from './_license.js';
export default wrap(async(req,res)=>{
 const user=requireUser(req);
 if(req.method==='GET'){
   const license=await accountLicense(user);
   if(!license)return send(res,200,{license:null,members:[]});
   const members=license.role==='owner'?await sb(`hs_license_members?license_id=eq.${enc(license.id)}&select=identity,created_at`):[];
   return send(res,200,{license:{id:license.id,plan:license.plan,seats:license.seats,expires_at:license.expires_at,role:license.role},members});
 }
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const {action,identity}=readBody(req);
 if(action==='claim'){
   const {code}=readBody(req);
   if(typeof code!=='string'||!/^HS-[A-F0-9]{32}$/.test(code))throw httpError(400,'Invalid activation code');
   // Atomic claim through a database function; raw codes are never stored.
   const crypto=await import('node:crypto');
   const hash=crypto.createHash('sha256').update(code).digest('hex');
   const key=process.env.SUPABASE_SERVICE_KEY;
   const r=await fetch(`${process.env.SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/rpc/hs_claim_license`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_hash:hash,p_identity:String(user.id)})});
   if(!r.ok)throw httpError(409,'License unavailable, expired or already claimed');
   return send(res,200,{ok:true});
 }
 const license=await requireLicense(user);
 if(license.role!=='owner'||license.plan!=='enterprise')throw httpError(403,'Enterprise owner required');
 if(typeof identity!=='string'||!(/^email:[0-9a-f-]{36}$/.test(identity)||/^\d{17,20}$/.test(identity)))throw httpError(400,'Enter a registered account ID or Discord ID');
 if(identity===String(user.id))throw httpError(400,'Owner is already included');
 if(action==='add'){
   // Atomic seat limit in SQL, prevents concurrent requests bypassing capacity.
   const key=process.env.SUPABASE_SERVICE_KEY;
   const r=await fetch(`${process.env.SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/rpc/hs_add_member`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_license:license.id,p_owner:String(user.id),p_identity:identity})});
   if(!r.ok)throw httpError(409,'No free seats or member already assigned');
 }else if(action==='remove'){
   await sb(`hs_license_members?license_id=eq.${enc(license.id)}&identity=eq.${enc(identity)}`,{method:'DELETE'});
 }else throw httpError(400,'Unknown action');
 return send(res,200,{ok:true});
});
