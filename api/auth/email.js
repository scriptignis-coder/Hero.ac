import { wrap, send, readBody, httpError, setSession } from '../_lib.js';
const base = () => String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
export default wrap(async (req,res)=>{
  if(req.method!=='POST') throw httpError(405,'Method not allowed');
  const {action,email,password}=readBody(req);
  if(!['register','login'].includes(action)||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<8||password.length>128) throw httpError(400,'Valid email and password (8-128 characters) required');
  const key=process.env.SUPABASE_ANON_KEY;
  if(!key) throw httpError(503,'Email authentication is not configured');
  const endpoint=action==='register'?'signup':'token?grant_type=password';
  const r=await fetch(`${base()}/auth/v1/${endpoint}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return send(res,400,{error:action==='login'?'Invalid credentials or unconfirmed email':(data.msg||data.error_description||'Registration failed')});
  if(!data.access_token) return send(res,200,{confirmation_required:true});
  // Verify token with Supabase Auth before issuing our own signed session.
  const check=await fetch(`${base()}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${data.access_token}`}});
  if(!check.ok) throw httpError(401,'Could not verify account');
  const user=await check.json();
  if(!user.id||!user.email_confirmed_at) return send(res,200,{confirmation_required:true});
  setSession(res,{id:`email:${user.id}`,name:user.email,auth:'email'});
  return send(res,200,{ok:true});
});
