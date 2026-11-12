import crypto from 'node:crypto';
import {wrap,send,readBody,httpError,sb} from './_lib.js';
export default wrap(async(req,res)=>{
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const provided=String(req.headers.authorization||'');
 const secret=process.env.HS_BOT_LICENSE_SECRET;
 if(!secret)throw httpError(503,'Bot license secret not configured on website');
 const expected=`Bearer ${secret}`;
 if(provided.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))throw httpError(401,'Unauthorized');
 const {discord_id,unit,duration}=readBody(req);
 if(!/^\d{17,20}$/.test(String(discord_id)))throw httpError(400,'Invalid Discord user');
 const multipliers={hours:3600000,days:86400000,weeks:604800000};
 if(!['hours','days','weeks','months','lifetime'].includes(unit))throw httpError(400,'Invalid unit');
 if(unit!=='lifetime'&&(!Number.isInteger(duration)||duration<1||duration>10000))throw httpError(400,'Invalid duration');
 let expires_at=null;
 if(unit!=='lifetime'){
   const expiry=new Date();
   if(unit==='months')expiry.setUTCMonth(expiry.getUTCMonth()+duration);
   else expiry.setTime(expiry.getTime()+duration*multipliers[unit]);
   if(!Number.isFinite(expiry.getTime())||expiry.getTime()-Date.now()>100*365.25*86400000)throw httpError(400,'Duration too long');
   expires_at=expiry.toISOString();
 }
 const code=`HS-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
 const code_hash=crypto.createHash('sha256').update(code).digest('hex');
 await sb('hs_licenses',{method:'POST',body:{code_hash,issued_to_discord:String(discord_id),plan:'personal',seats:1,expires_at,status:'active'},prefer:'return=minimal'});
 return send(res,200,{code,expires_at,seats:1});
});
