import test from 'node:test';
import assert from 'node:assert/strict';
import { humanOn, isHuman, sendChallenge, verifyHuman } from '../api/_human.js';

const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; });
const mkRes = () => { const r = { headers: {}, body: '', code: 0 }; r.writeHead = (c, h) => { r.code = c; Object.assign(r.headers, h); }; r.end = (b) => { r.body = String(b || ''); }; return r; };

test('Turnstile gate: off without keys, challenge page, cookie after a good token, refused on a bad one', async () => {
  delete process.env.TURNSTILE_SITE_KEY; assert.equal(humanOn(), false);
  Object.assign(process.env, { TURNSTILE_SITE_KEY: '0x4AAAAtest', TURNSTILE_SECRET_KEY: 'secret', SESSION_SECRET: 's' });
  assert.equal(humanOn(), true);
  const page = mkRes(); sendChallenge({ headers: { host: 'hero-ac.onrender.com' } }, page);
  assert.equal(page.code, 200); assert.match(page.body, /data-sitekey="0x4AAAAtest"/); assert.match(page.body, /hero-ac\.onrender\.com/);

  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }));
  const bad = mkRes(); await verifyHuman({ headers: {}, socket: {} }, bad, { token: 'x' });
  assert.equal(bad.code, 403); assert.equal(bad.headers['Set-Cookie'], undefined);

  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: 'other', hostname: 'hero-ac.onrender.com' }));
  const wrongAction = mkRes(); await verifyHuman({ headers: { host: 'hero-ac.onrender.com' }, socket: {} }, wrongAction, { 'cf-turnstile-response': 'ok' });
  assert.equal(wrongAction.code, 403);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: 'site_gate', hostname: 'evil.example' }));
  const wrongHost = mkRes(); await verifyHuman({ headers: { host: 'hero-ac.onrender.com' }, socket: {} }, wrongHost, { 'cf-turnstile-response': 'ok' });
  assert.equal(wrongHost.code, 403);
  const tooLong = mkRes(); await verifyHuman({ headers: {}, socket: {} }, tooLong, { 'cf-turnstile-response': 'x'.repeat(2049) });
  assert.equal(tooLong.code, 403);
  globalThis.fetch = async () => { throw new Error('network'); };
  const down = mkRes(); await verifyHuman({ headers: { host: 'hero-ac.onrender.com' }, socket: {} }, down, { 'cf-turnstile-response': 'ok' });
  assert.equal(down.code, 403);   // fail closed
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: 'site_gate', hostname: 'hero-ac.onrender.com' }));
  const good = mkRes(); await verifyHuman({ headers: { 'x-forwarded-proto': 'https', host: 'hero-ac.onrender.com' }, socket: {} }, good, { 'cf-turnstile-response': 'ok' });
  assert.equal(good.code, 200);
  const cookie = good.headers['Set-Cookie'].split(';')[0];
  assert.match(good.headers['Set-Cookie'], /HttpOnly/); assert.match(good.headers['Set-Cookie'], /Secure/);
  assert.equal(isHuman({ headers: { cookie } }), true);
  assert.equal(isHuman({ headers: { cookie: cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) } }), false);   // forged
  assert.equal(isHuman({ headers: { cookie: 'hs_human=1.abc' } }), false);                                       // expired
});
