import crypto from 'node:crypto';
import {wrap,send,readBody,httpError,sb,audit} from './_lib.js';
export default wrap(async(req,res)=>{
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const provided=String(req.headers.authorization||'');
 const secret=process.env.HS_BOT_LICENSE_SECRET;
 if(!secret)throw httpError(503,'HS_BOT_LICENSE_SECRET is not configured');
 const expected=`Bearer ${secret}`;
 if(provided.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))throw httpError(401,'Unauthorized');
 const {discord_id,unit,duration,enterprise=false}=readBody(req);
 if(!/^\d{17,20}$/.test(String(discord_id)))throw httpError(400,'Invalid Discord user');
 if(!['hours','days','weeks','months','lifetime'].includes(unit))throw httpError(400,'Invalid unit');
 if(typeof enterprise!=='boolean')throw httpError(400,'enterprise must be true or false');
 if(unit!=='lifetime'&&(!Number.isInteger(duration)||duration<1||duration>1000))throw httpError(400,'Invalid duration');
 let expires_at=null;
 if(unit!=='lifetime'){
   const expiry=new Date();
   if(unit==='months')expiry.setUTCMonth(expiry.getUTCMonth()+duration);
   else expiry.setTime(expiry.getTime()+duration*({hours:3600000,days:86400000,weeks:604800000})[unit]);
   if(!Number.isFinite(expiry.getTime())||expiry.getTime()-Date.now()>100*365.25*86400000)throw httpError(400,'Duration too long');
   expires_at=expiry.toISOString();
 }
 const code=`HS-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
 const hash=crypto.createHash('sha256').update(code).digest('hex');
 await sb('hs_account_licenses',{method:'POST',body:{license_key:hash,discord_user_id:String(discord_id),duration_unit:unit,duration_value:unit==='lifetime'?null:duration,expires_at,enterprise,seats:enterprise?10:1,revoked:false},prefer:'return=minimal'});
 await audit(null,'license.create',{target:String(discord_id),detail:{created_by:'HeRoShield Bot',assigned_to:String(discord_id),license_type:enterprise?'Enterprise':'Personal',duration:unit==='lifetime'?'Lifetime':`${duration} ${unit}`,expires_at}});
 return send(res,200,{code,expires_at,seats:enterprise?10:1,enterprise});
});
