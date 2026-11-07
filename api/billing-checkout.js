import { getSession, httpError, wrap } from './_lib.js';
import { PLANS, PRICE_KEYS, stripe } from './_billing.js';
export default wrap(async(req,res)=>{
 if(req.method!=='POST') throw httpError(405,'Method not allowed');
 const user=getSession(req); if(!user) throw httpError(401,'Log in with Discord first');
 const plan=String(req.body?.plan||''); if(!Object.hasOwn(PLANS,plan)) throw httpError(400,'Invalid plan');
 const price=process.env[PRICE_KEYS[plan]]; if(!price) throw httpError(503,'This plan has not been priced yet');
 const base=process.env.PUBLIC_SITE_URL; if(!base||!/^https:\/\/[^/]+/.test(base)) throw httpError(503,'PUBLIC_SITE_URL is not configured');
 const result=await stripe('checkout/sessions',{
 'mode':'payment','line_items[0][price]':price,'line_items[0][quantity]':'1',
 'client_reference_id':String(user.id),'metadata[discord_id]':String(user.id),'metadata[plan]':plan,
 'success_url':`${base.replace(/\/$/,'')}/?payment=success#pricing`,
 'cancel_url':`${base.replace(/\/$/,'')}/?payment=cancel#pricing`,
 });
 if(!result.url) throw httpError(502,'Checkout unavailable');
 res.status(200).json({url:result.url});
});
