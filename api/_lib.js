
import crypto from 'node:crypto';

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable: ${k}`);
  return v;
};


export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const key = env('SUPABASE_SERVICE_KEY').trim();
  const base = env('SUPABASE_URL').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  let r;
  try {
    r = await fetch(`${base}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    console.error('Supabase fetch failed:', e);
    throw httpError(502, 'Database unreachable: check SUPABASE_URL (https://xxxx.supabase.co)');
  }

  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    console.error('Supabase error', r.status, text);
    const msg = (data && (data.message || data.hint)) || String(text).slice(0, 150);
    let hint = '';
    if (r.status === 401 || r.status === 403 || /permission|JWT|Invalid API key/i.test(msg)) {
      hint = ' -> use the service_role key in SUPABASE_SERVICE_KEY';
    } else if (/does not exist|schema cache|relation/i.test(msg)) {
      hint = ' -> run supabase.sql in the Supabase SQL Editor';
    }
    throw httpError(502, `Database error: ${msg}${hint}`);
  }
  return data;
}

export const enc = encodeURIComponent;

// ---------- Supabase Storage (bucket "proofs") ----------
const storageBase = () => env('SUPABASE_URL').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

export function publicUrl(path) {
  return `${storageBase()}/storage/v1/object/public/proofs/${path}`;
}

export async function storageUpload(path, buffer, contentType = 'image/jpeg') {
  const key = env('SUPABASE_SERVICE_KEY').trim();
  const r = await fetch(`${storageBase()}/storage/v1/object/proofs/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
    body: buffer,
  });
  if (!r.ok) {
    const text = await r.text();
    console.error('Storage error', r.status, text);
    throw httpError(502, `Storage error: ${text.slice(0, 120)} -> run supabase.sql (creates the "proofs" bucket)`);
  }
  return publicUrl(path);
}

export async function storageRemove(paths) {
  if (!paths.length) return;
  const key = env('SUPABASE_SERVICE_KEY').trim();
  await fetch(`${storageBase()}/storage/v1/object/proofs`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}

export async function storageList(prefix) {
  const key = env('SUPABASE_SERVICE_KEY').trim();
  const r = await fetch(`${storageBase()}/storage/v1/object/list/proofs`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 200, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!r.ok) return [];
  const rows = await r.json();
  return (rows || []).filter((o) => o.name && o.id).map((o) => o.name);
}


const COOKIE = 'hs_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', env('SESSION_SECRET')).update(data).digest('base64url');

export function setSession(res, user) {
  const payload = b64(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const value = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function getSession(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!user.exp || user.exp < Date.now() / 1000) return null;
    return user;
  } catch {
    return null;
  }
}


export const send = (res, status, data) => res.status(status).json(data);

export function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (!e.expose) console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: e.expose ? e.message : 'Server error' });
    }
  };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

// ---------- Auth ----------
export function requireUser(req) {
  const u = getSession(req);
  if (!u) throw httpError(401, 'Not logged in');
  return u;
}


export async function requireLicense(req) {
  const license = String(req.headers['x-license'] || '').trim();
  if (!license) throw httpError(401, 'Missing license');
  const rows = await sb(`servers?license=eq.${enc(license)}&select=id,name`);
  if (!rows || !rows.length) throw httpError(401, 'Invalid license');
  const server = rows[0];
  // update last_seen (no wait)
  sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { last_seen: new Date().toISOString() } }).catch(() => {});
  return server;
}


export async function requireOwnedServer(user, serverId) {
  if (!serverId || !/^[0-9a-f-]{36}$/i.test(serverId)) throw httpError(400, 'Invalid server');
  const rows = await sb(`servers?id=eq.${enc(serverId)}&owner_discord=eq.${enc(user.id)}&select=*`);
  if (!rows || !rows.length) throw httpError(404, 'Server not found');
  return rows[0];
}

export function newLicense() {
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HS-${part()}-${part()}-${part()}-${part()}`;
}

export const str = (v, max = 200) => String(v ?? '').slice(0, max);

// ---------- access / permissions (set in the Render environment) ----------
// HEROSHIELD_IDS = Discord IDs (comma) allowed the full HeRo Shield anticheat dashboard
// HEROCHECK_IDS  = Discord IDs (comma) allowed the HeRo Check (screenshare) dashboard
// ADMIN_IDS      = Discord IDs that get both
// Optional role-based: DISCORD_GUILD_ID + HEROSHIELD_ROLE_ID / HEROCHECK_ROLE_ID (+ DISCORD_BOT_TOKEN)
// If NONE of these are set, everyone gets both (nothing breaks).
const ids = (k) => String(process.env[k] || '').split(',').map((s) => s.trim()).filter(Boolean);
const _accessCache = new Map();

export async function getAccess(user) {
  const configured = ['HEROSHIELD_IDS', 'HEROCHECK_IDS', 'ADMIN_IDS', 'HEROSHIELD_ROLE_ID', 'HEROCHECK_ROLE_ID']
    .some((k) => process.env[k]);
  if (!configured) return { heroshield: true, herocheck: true };

  const hit = _accessCache.get(user.id);
  if (hit && Date.now() - hit.t < 60000) return hit.a;

  const admin = ids('ADMIN_IDS').includes(user.id);
  const a = {
    heroshield: admin || ids('HEROSHIELD_IDS').includes(user.id),
    herocheck: admin || ids('HEROCHECK_IDS').includes(user.id),
  };

  const guild = process.env.DISCORD_GUILD_ID, bot = process.env.DISCORD_BOT_TOKEN;
  if (guild && bot && (!a.heroshield || !a.herocheck)) {
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${user.id}`,
        { headers: { Authorization: `Bot ${bot}` } });
      if (r.ok) {
        const roles = (await r.json()).roles || [];
        if (process.env.HEROSHIELD_ROLE_ID && roles.includes(process.env.HEROSHIELD_ROLE_ID)) a.heroshield = true;
        if (process.env.HEROCHECK_ROLE_ID && roles.includes(process.env.HEROCHECK_ROLE_ID)) a.herocheck = true;
      }
    } catch {}
  }
  _accessCache.set(user.id, { t: Date.now(), a });
  return a;
}

// throws 403 unless the user has at least one of the given products
export async function requireAccess(user, ...products) {
  const a = await getAccess(user);
  if (!products.some((p) => a[p])) throw httpError(403, 'No access — ask the owner for the ' + products.join(' / ') + ' role');
  return a;
}
