// Per-player scanner download:  GET /dl/ABCD2345
// Streams the scanner .exe named "HeRoShield-ABCD2345.exe" with "HEROPIN:ABCD2345|API:<this site>"
// appended at the end, so the player just runs it — no PIN to type.
// The .exe comes from SCANNER_EXE_URL (default: the GitHub release) and is cached on disk for 30 min.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { sb, enc } from './_lib.js';

const SRC = () => process.env.SCANNER_EXE_URL
  || 'https://github.com/scriptignis-coder/SouthSide/releases/download/v1.0/HeRoShield.exe';
const CACHE = path.join(os.tmpdir(), 'heroshield-scanner.exe');
const MAX_AGE = 30 * 60 * 1000;
let inflight = null;

async function getExe() {
  try {
    const st = fs.statSync(CACHE);
    if (Date.now() - st.mtimeMs < MAX_AGE && st.size > 100000) return st.size;
  } catch {}
  if (!inflight) {
    inflight = (async () => {
      const r = await fetch(SRC(), { redirect: 'follow', headers: { 'User-Agent': 'HeRoShield-site' } });
      if (!r.ok || !r.body) throw new Error(`scanner download failed (${r.status})`);
      const tmp = CACHE + '.' + process.pid + '.part';
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
      if (fs.statSync(tmp).size < 100000) throw new Error('scanner file too small — check SCANNER_EXE_URL');
      fs.renameSync(tmp, CACHE);
      return fs.statSync(CACHE).size;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

const page = (res, code, title, text) => {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HeRo Shield</title>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070809;color:#e8ecff;font:15px Inter,system-ui,sans-serif;padding:20px">
  <div style="max-width:420px;text-align:center;background:#0e1219;border:1px solid rgba(125,180,255,.14);border-radius:18px;padding:30px">
  <div style="font-weight:700;font-size:18px;margin-bottom:14px">HeRo <span style="color:#7dd3fc">Shield</span></div>
  <h2 style="margin:0 0 10px">${title}</h2><p style="color:#8a93a8;line-height:1.6;margin:0">${text}</p></div></body>`);
};

export async function handleDownload(req, res, rawPin) {
  const pin = String(rawPin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  let row;
  try {
    const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id,used`);
    row = rows && rows[0];
  } catch (e) {
    console.error('download lookup', e.message);
    return page(res, 500, 'Server error', 'Try again in a minute.');
  }
  if (!row) return page(res, 404, 'Invalid link', 'This download link does not exist. Ask staff for a new one.');
  if (row.used) return page(res, 410, 'Check already done', 'This PIN was already used. Ask staff for a new link.');

  let size;
  try { size = await getExe(); } catch (e) {
    console.error('scanner download', e.message);
    return page(res, 502, 'Scanner not available', 'Staff: upload HeRoShield.exe to your GitHub release (or set SCANNER_EXE_URL in Render).');
  }

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const tail = Buffer.from(`\nHEROPIN:${pin}|API:${proto}://${host}\n`, 'ascii');
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="HeRoShield-${pin}.exe"`,
    'Content-Length': size + tail.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  const rs = fs.createReadStream(CACHE);
  rs.on('error', () => res.destroy());
  rs.pipe(res, { end: false });
  rs.on('end', () => res.end(tail));
}
