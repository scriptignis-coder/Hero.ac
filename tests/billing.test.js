import test from 'node:test'; import assert from 'node:assert/strict'; import crypto from 'node:crypto';
import { addMonths, verifyStripe, PLANS } from '../api/_billing.js';
test('five plans exist',()=>assert.deepEqual(Object.keys(PLANS),['month1','month3','month6','year1','lifetime']));
test('calendar month clamping',()=>assert.equal(addMonths('2026-01-31T00:00:00Z',1).toISOString(),'2026-02-28T00:00:00.000Z'));
test('stripe signature valid and invalid',()=>{const body='{"id":"evt_test"}',t=Math.floor(Date.now()/1000),secret='whsec_test';const sig=crypto.createHmac('sha256',secret).update(`${t}.${body}`).digest('hex');assert.equal(verifyStripe(body,`t=${t},v1=${sig}`,secret),true);assert.equal(verifyStripe(body+'!',`t=${t},v1=${sig}`,secret),false);});
