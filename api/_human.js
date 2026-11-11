// Real bot check with Cloudflare Turnstile (free, works on hero-ac.onrender.com without a domain).
// Turned ON only when TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set in Render → Environment.
// The website pages (/ and /dashboard) ask for the check once; a signed cookie keeps the visitor verified for 12 h.
// /api/* and /dl/* are never challenged — the scanner .exe must always reach them.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOURS = 12;
const SECRET = () => String(process.env.TURNSTILE_SECRET_KEY || '').trim();
export const humanOn = () => !!(String(process.env.TURNSTILE_SITE_KEY || '').trim() && SECRET());
const key = () => process.env.SESSION_SECRET || process.env.TURNSTILE_SECRET_KEY || 'hs';
const sig = (v) => crypto.createHmac('sha256', key()).update('human:' + v).digest('base64url');

export function isHuman(req) {
  const m = /(?:^|;\s*)hs_human=([0-9]+)\.([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const exp = Number(m[1]);
  if (!exp || exp < Date.now()) return false;
  const good = sig(m[1]);
  return good.length === m[2].length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(m[2]));
}

export function sendChallenge(req, res) {
  let html = fs.readFileSync(path.join(ROOT, 'human.html'), 'utf8');
  html = html.replace(/__SITEKEY__/g, String(process.env.TURNSTILE_SITE_KEY).trim().replace(/[^A-Za-z0-9_-]/g, ''))
             .replace(/__HOST__/g, String(req.headers.host || 'hero-ac.onrender.com').replace(/[^A-Za-z0-9.:-]/g, ''));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(html);
}

export async function verifyHuman(req, res, body) {
  const raw = body && (body['cf-turnstile-response'] ?? body.token);
  if (typeof raw !== 'string' || !raw || raw.length > 2048) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, error: 'Missing check.' })); }
  const token = raw;
  // hostnames the token may come from: TURNSTILE_HOSTNAMES (comma list) or the site's own host
  const allowed = String(process.env.TURNSTILE_HOSTNAMES || String(req.headers.host || '').split(':')[0]).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const ip = String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim();
  let ok = false, why = '';
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret: SECRET(), response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const v = r.ok ? await r.json() : {};
    if (!r.ok) why = 'siteverify HTTP ' + r.status;
    else if (v.success !== true) why = (v['error-codes'] || []).join(',') || 'not-success';
    else if (v.action !== 'site_gate') why = 'wrong-action:' + v.action;
    else if (!allowed.includes(String(v.hostname || '').toLowerCase())) why = 'wrong-hostname:' + v.hostname + ' (allowed: ' + allowed.join(',') + ')';
    ok = !why;
  } catch (e) { why = 'network: ' + (e && e.message); }
  if (!ok) {
    console.warn('[turnstile] refused —', why);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Verification failed', code: why }));
  }
  const exp = String(Date.now() + HOURS * 3600e3);
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `hs_human=${exp}.${sig(exp)}; Path=/; Max-Age=${HOURS * 3600}; HttpOnly; SameSite=Lax${secure}` });
  res.end(JSON.stringify({ ok: true }));
}
