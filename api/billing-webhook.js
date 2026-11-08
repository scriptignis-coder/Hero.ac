import { sb, enc, httpError, wrap, audit } from './_lib.js';
import { PLANS, addMonths, verifyStripe, stripe } from './_billing.js';
export default wrap(async(req,res)=>{
 if(req.method!=='POST') throw httpError(405,'Method not allowed');
 const raw=req.rawBody; if(typeof raw!=='string'||!verifyStripe(raw,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET)) throw httpError(400,'Invalid Stripe signature');
 const event=JSON.parse(raw); if(event.type!=='checkout.session.completed') return res.status(200).json({received:true});
 const session=event.data?.object; if(session?.mode!=='payment'||session?.payment_status!=='paid') return res.status(200).json({received:true});
 const id=String(session.client_reference_id||''); const plan=String(session.metadata?.plan||'');
 if(!/^\d{5,25}$/.test(id)||!Object.hasOwn(PLANS,plan)||session.metadata?.discord_id!==id) throw httpError(400,'Invalid checkout metadata');
 // Verify session directly with Stripe before granting access; never trust browser redirects.
 const verified=await stripe(`checkout/sessions/${encodeURIComponent(session.id)}`,{},'GET');
 if(verified.payment_status!=='paid'||verified.client_reference_id!==id||verified.metadata?.plan!==plan) throw httpError(400,'Unverified checkout');
 const paidId=String(session.payment_intent||session.id);
 const existing=await sb(`billing_payments?stripe_payment_id=eq.${enc(paidId)}&select=stripe_payment_id`);
 if(existing?.length) return res.status(200).json({received:true,duplicate:true});
 const current=await sb(`paid_entitlements?discord_id=eq.${enc(id)}&select=expires_at,lifetime`);
 const old=current?.[0]; const start=old?.expires_at&&Date.parse(old.expires_at)>Date.now()?new Date(old.expires_at):new Date();
 const lifetime=plan==='lifetime'||old?.lifetime===true;
 const expires=lifetime?null:addMonths(start,PLANS[plan]).toISOString();
 await sb('paid_entitlements?on_conflict=discord_id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{discord_id:id,plan:lifetime?'lifetime':plan,lifetime,expires_at:expires,updated_at:new Date().toISOString()}});
 await sb('billing_payments?on_conflict=stripe_payment_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{stripe_payment_id:paidId,discord_id:id,plan,stripe_session_id:session.id}});
 await audit({id,name:null},'plan.purchase',{target:id,detail:{plan,lifetime,expires_at:expires,payment:paidId}});
 return res.status(200).json({received:true});
});
