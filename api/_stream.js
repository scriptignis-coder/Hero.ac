// Live stream relay kept in memory (works on Render / any Node host, not on serverless)
import crypto from 'node:crypto';

const keys = new Map();     // key -> { id, created }
const byId = new Map();     // id -> key
const frames = new Map();   // id -> { buf, ts, n }
const views = new Map();    // id -> last time a dashboard asked for a frame
const subs = new Map();     // id -> Set of viewer sockets (live WebSocket)
const pubs = new Map();     // id -> publisher socket

const idOf = (serverId, identifier) => `${serverId}:${identifier}`;

export function openStream(serverId, identifier) {
  const id = idOf(serverId, identifier);
  let key = byId.get(id);
  if (!key) {
    key = crypto.randomBytes(18).toString('hex');
    byId.set(id, key);
    keys.set(key, { id, created: Date.now() });
  }
  views.set(id, Date.now());
  return key;
}

export function streamId(serverId, identifier) { return idOf(serverId, identifier); }
export function keyInfo(key) { return keys.get(key) || null; }

// ---- WebSocket live viewers ----
export function addViewer(id, ws) {
  if (!subs.has(id)) subs.set(id, new Set());
  subs.get(id).add(ws);
  views.set(id, Date.now());
  const f = frames.get(id);
  if (f && Date.now() - f.ts < 5000) { try { ws.send(f.buf); } catch {} }
}
export function removeViewer(id, ws) {
  const set = subs.get(id);
  if (set) { set.delete(ws); if (!set.size) subs.delete(id); }
}
export function setPublisher(id, ws) {
  const old = pubs.get(id);
  if (old && old !== ws) { try { old.close(); } catch {} }
  pubs.set(id, ws);
}
export function removePublisher(id, ws) { if (pubs.get(id) === ws) pubs.delete(id); }

// returns 'ok', 'stop' or null (bad key)
export function pushFrame(key, buf) {
  const k = keys.get(key);
  if (!k) return null;
  const prev = frames.get(k.id);
  frames.set(k.id, { buf, ts: Date.now(), n: (prev ? prev.n : 0) + 1 });
  const set = subs.get(k.id);
  if (set && set.size) {
    views.set(k.id, Date.now());
    for (const ws of set) {
      if (ws.readyState === 1 && ws.bufferedAmount < 2e6) { try { ws.send(buf); } catch {} }
    }
  }
  const lastView = views.get(k.id) || 0;
  if (Date.now() - lastView > 15000) {
    keys.delete(key);
    byId.delete(k.id);
    return 'stop';
  }
  return 'ok';
}

export function getFrame(serverId, identifier) {
  const id = idOf(serverId, identifier);
  views.set(id, Date.now());
  return frames.get(id) || null;
}

// cleanup old frames every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, f] of frames) if (now - f.ts > 120000) frames.delete(id);
  for (const [key, k] of keys) if (now - k.created > 3600000) { keys.delete(key); byId.delete(k.id); }
}, 60000).unref();

// pull the file bytes out of a multipart/form-data body
export function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return buf.length ? buf : null;
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const start = buf.indexOf(boundary);
  if (start < 0) return null;
  const headEnd = buf.indexOf(Buffer.from('\r\n\r\n'), start);
  if (headEnd < 0) return null;
  const dataStart = headEnd + 4;
  const end = buf.indexOf(boundary, dataStart);
  if (end < 0) return null;
  let data = buf.subarray(dataStart, end - 2);
  // screenshot-basic may send a data URI as text
  const head = data.subarray(0, 30).toString();
  if (head.startsWith('data:image')) {
    const s = data.toString();
    data = Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');
  }
  return data;
}
