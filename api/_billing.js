import crypto from 'node:crypto';
import { sb, enc, httpError } from './_lib.js';
export const PLANS = Object.freeze({month1:1,month3:3,month6:6,year1:12,lifetime:0});
export const PRICE_KEYS = Object.freeze({month1:'STRIPE_PRICE_1_MONTH',month3:'STRIPE_PRICE_3_MONTH',month6:'STRIPE_PRICE_6_MONTH',year1:'STRIPE_PRICE_1_YEAR',lifetime:'STRIPE_PRICE_LIFETIME'});
export function addMonths(date, months) { const d = new Date(date); const day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months); const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d; }
export async function paidStatus(discordId) {
  const rows=await sb(`paid_entitlements?discord_id=eq.${enc(discordId)}&select=expires_at,lifetime,plan`);
  const row=rows?.[0];
  return { active: !!row && (row.lifetime===true || (!!row.expires_at && Date.parse(row.expires_at)>Date.now())), plan:row?.plan||null, expires_at:row?.expires_at||null, lifetime:!!row?.lifetime };
}
export async function stripe(path, body, method='POST') {
  if (!process.env.STRIPE_SECRET_KEY) throw httpError(503,'Stripe is not configured');
  const r=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:method==='GET'?undefined:new URLSearchParams(body)});
  const result=await r.json(); if(!r.ok) { console.error('Stripe:',result.error?.message); throw httpError(502,'Payment provider error'); } return result;
}
export function verifyStripe(raw, header, secret) {
  if(!secret || !header) return false;
  const parts=Object.fromEntries(header.split(',').map(x=>x.split('=',2)));
  if(!/^\d+$/.test(parts.t||'') || Math.abs(Date.now()/1000-Number(parts.t))>300) return false;
  const digest=crypto.createHmac('sha256',secret).update(`${parts.t}.${raw}`).digest('hex');
  return header.split(',').filter(x=>x.startsWith('v1=')).some(x=>{const s=x.slice(3);return /^[0-9a-f]{64}$/.test(s)&&crypto.timingSafeEqual(Buffer.from(s,'hex'),Buffer.from(digest,'hex'));});
}
