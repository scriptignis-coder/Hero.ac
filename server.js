// Node server for Render (or any host). Serves the site + runs the api/ files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const BLOCKED = ['human.html', 'api', 'node_modules', '.env', 'server.js', 'package.json', 'package-lock.json', '.git', '.github', 'scanner', 'vercel.json', 'tests', 'backup-before-v19', 'UPLOAD-TO-GITHUB', 'database'];
// never serve database scripts, notes or env files
const BLOCKED_EXT = /\.(sql|md|env|example|cs|csproj|bat|yml|yaml|log)$/i;

const handlers = new Map();
async function getHandler(route) {
  if (handlers.has(route)) return handlers.get(route);
  const file = path.join(ROOT, 'api', `${route}.js`);
  if (!file.startsWith(path.join(ROOT, 'api')) || route.split('/').some((p) => p.startsWith('_')) || !fs.existsSync(file)) {
    handlers.set(route, null);
    return null;
  }
  const mod = await import(pathToFileURL(file).href);
  handlers.set(route, mod.default);
  return mod.default;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let big = false;
    // scan reports can be a few MB (screenshot + lists) — allow 30 MB, answer 413 instead of cutting the connection
    req.on('data', (c) => { if (big) return; data += c; if (data.length > 30e6) { big = true; data = ''; } });
    req.on('end', () => {
      if (big) return resolve({ __tooLarge: true });
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve(data); }
    });
    req.on('error', () => resolve({}));
  });
}

// Make Node's res look like Vercel's (status / json)
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

// v36: fast static files — compressed once (brotli / gzip) and kept in memory, ETag + browser cache.
// HTML is revalidated every time (304 when unchanged), /assets are cached by the browser for a day.
const COMPRESS = /\.(html|js|css|json|svg|txt|xml|map)$/i;
const fileCache = new Map();   // file -> { mtime, etag, raw, br, gz }
function cached(file, st) {
  let c = fileCache.get(file);
  if (c && c.mtime === st.mtimeMs && c.size === st.size) return c;
  const raw = fs.readFileSync(file);
  c = { mtime: st.mtimeMs, size: st.size, etag: `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`, raw };
  if (COMPRESS.test(file) && raw.length > 1024) {
    c.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
    c.gz = zlib.gzipSync(raw, { level: 8 });
  }
  if (raw.length < 8 * 1024 * 1024) fileCache.set(file, c);
  return c;
}
function serveFile(res, file, req) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Not found');
    }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
    if (st.size > 16 * 1024 * 1024) { res.setHeader('Content-Length', st.size); return fs.createReadStream(file).pipe(res); }
    let c;
    try { c = cached(file, st); } catch { res.statusCode = 500; return res.end(); }
    res.setHeader('ETag', c.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    // pictures / fonts: cached a day · html / js / css: re-checked each visit (a cheap 304) so a new deploy shows at once
    res.setHeader('Cache-Control', /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|mp4|webm)$/.test(ext) ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache');
    if (req && req.headers['if-none-match'] === c.etag) { res.statusCode = 304; return res.end(); }
    const ae = String((req && req.headers['accept-encoding']) || '');
    let body = c.raw;
    if (c.br && /\bbr\b/.test(ae)) { body = c.br; res.setHeader('Content-Encoding', 'br'); }
    else if (c.gz && /\bgzip\b/.test(ae)) { body = c.gz; res.setHeader('Content-Encoding', 'gzip'); }
    res.setHeader('Content-Length', body.length);
    if (req && req.method === 'HEAD') return res.end();
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    // live stream upload from players (raw image, handled before JSON parsing)
    // tiny keep-alive endpoint (UptimeRobot / cron-job.org ping it so Render free never sleeps)
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      return res.end('ok');
    }
    if (pathname === '/api/stream/upload' && req.method === 'POST') {
      const { pushFrame, parseMultipart } = await import(pathToFileURL(path.join(ROOT, 'api', '_stream.js')).href);
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 4e6) { res.statusCode = 413; return res.end('stop'); }
        chunks.push(c);
      }
      const img = parseMultipart(Buffer.concat(chunks), req.headers['content-type']);
      const result = img && img.length ? pushFrame(url.searchParams.get('k') || '', img) : null;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.statusCode = result ? 200 : 403;
      return res.end(result || 'stop');
    }
    if (pathname === '/api/stream/upload' && req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' });
      return res.end();
    }

    // per-player scanner download (PIN baked into the .exe)
    const dl = /^\/dl\/([A-Za-z0-9]{4,12})\/?$/.exec(pathname);
    if (dl && req.method === 'GET') {
      const { handleDownload } = await import(pathToFileURL(path.join(ROOT, 'api', '_download.js')).href);
      return await handleDownload(req, res, dl[1]);
    }

    if (pathname === '/api/billing-webhook' && req.method === 'POST') {
      const chunks=[]; let size=0;
      for await (const chunk of req) { size+=chunk.length; if(size>1024*1024){res.statusCode=413;return res.end('Too large');} chunks.push(chunk); }
      req.rawBody=Buffer.concat(chunks).toString('utf8'); req.body={};
      const handler=await getHandler('billing-webhook'); wrapRes(res); return await handler(req,res);
    }
    // Turnstile check (must run before the generic /api/ router)
    if (pathname === '/api/human' && req.method === 'POST') {
      const { verifyHuman } = await import(pathToFileURL(path.join(ROOT, 'api', '_human.js')).href);
      return await verifyHuman(req, res, await readBody(req));
    }
    if (pathname.startsWith('/api/')) {
      const handler = await getHandler(pathname.slice(5).replace(/\/$/, ''));
      wrapRes(res);
      if (!handler) return res.status(404).json({ error: 'Not found' });
      req.query = Object.fromEntries(url.searchParams);
      req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      if (req.body && req.body.__tooLarge) return res.status(413).json({ error: 'Request too large' });
      return await handler(req, res);
    }

    // real Cloudflare Turnstile check before the website pages (only when the keys are set on Render)
    if (req.method === 'GET' && ['/', '/index.html', '/dashboard', '/dashboard.html'].includes(pathname)) {
      const H = await import(pathToFileURL(path.join(ROOT, 'api', '_human.js')).href);
      if (H.humanOn() && !H.isHuman(req)) return H.sendChallenge(req, res);
    }

    if (pathname === '/') pathname = '/index.html';
    const first = pathname.split('/')[1];
    if (BLOCKED.includes(first) || first.startsWith('.') || BLOCKED_EXT.test(pathname)) { res.statusCode = 404; return res.end('Not found'); }

    let file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
    if (!path.extname(file)) file += '.html'; // /dashboard -> dashboard.html
    serveFile(res, file, req);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.end('Server error'); }
  }
});

// ===== Live video over WebSocket =====
// /ws/pub?k=KEY                      <- player game (NUI) sends JPEG frames
// /ws/view?server=ID&identifier=LIC  -> dashboard receives frames instantly
let WebSocketServer = null;
try { ({ WebSocketServer } = await import('ws')); } catch { console.warn('ws not installed: live video uses HTTP fallback'); }

if (WebSocketServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 3e6, perMessageDeflate: false });
  const stream = await import(pathToFileURL(path.join(ROOT, 'api', '_stream.js')).href);
  const lib = await import(pathToFileURL(path.join(ROOT, 'api', '_lib.js')).href);

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/ws/pub') {
        const info = stream.keyInfo(url.searchParams.get('k') || '');
        if (!info) return socket.destroy();
        const key = url.searchParams.get('k');
        return wss.handleUpgrade(req, socket, head, (ws) => {
          stream.setPublisher(info.id, ws);
          ws.on('message', (data, isBinary) => {
            if (!isBinary) return;
            const r = stream.pushFrame(key, Buffer.from(data));
            if (r !== 'ok') { try { ws.send('stop'); ws.close(); } catch {} }
          });
          ws.on('close', () => stream.removePublisher(info.id, ws));
        });
      }
      if (url.pathname === '/ws/view') {
        const user = lib.getSession(req);
        if (!user) return socket.destroy();
        if (!(await lib.getAccess(user)).heroshield) return socket.destroy();
        const srv = await lib.requireOwnedServer(user, url.searchParams.get('server'));
        const id = stream.streamId(srv.id, String(url.searchParams.get('identifier') || '').slice(0, 120));
        return wss.handleUpgrade(req, socket, head, (ws) => {
          stream.addViewer(id, ws);
          ws.on('close', () => stream.removeViewer(id, ws));
        });
      }
    } catch (e) {
      console.error('ws upgrade', e.message);
    }
    socket.destroy();
  });
}

server.listen(PORT, () => console.log(`HeRo Shield running on port ${PORT}`));
