import crypto from 'node:crypto';
import {wrap,send,readBody,httpError,sb} from './_lib.js';
export default wrap(async(req,res)=>{
 if(req.method!=='POST')throw httpError(405,'Method not allowed');
 const provided=String(req.headers.authorization||'');
 const expected=`Bearer ${process.env.HS_BOT_LICENSE_SECRET||''}`;
 if(!process.env.HS_BOT_LICENSE_SECRET||provided.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))throw httpError(401,'Unauthorized');
 const {discord_id,plan,duration_days,seats}=readBody(req);
 if(!/^\d{17,20}$/.test(String(discord_id))||!['personal','pro','enterprise'].includes(plan)||!Number.isInteger(duration_days)||duration_days<1||duration_days>3650)throw httpError(400,'Invalid license details');
 const count=plan==='enterprise'?Number(seats):1;
 if(!Number.isInteger(count)||count<1||count>500)throw httpError(400,'Invalid seats');
 const code=`HS-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
 const code_hash=crypto.createHash('sha256').update(code).digest('hex');
 const expires_at=new Date(Date.now()+duration_days*86400000).toISOString();
 await sb('hs_licenses',{method:'POST',body:{code_hash,issued_to_discord:String(discord_id),plan,seats:count,expires_at,status:'active'},prefer:'return=minimal'});
 return send(res,200,{code,plan,seats:count,expires_at});
});
