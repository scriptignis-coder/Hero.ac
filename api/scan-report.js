import { wrap, send, readBody, sb, enc, httpError } from './_lib.js';
import { pcHistory } from './_pchistory.js';
import { gameOf } from './_games.js';

// Receives the finished scan report from the HeRo Scanner (no session — the
// player's PC posts it). Matches the PIN and stores the result on the row.

// Postgres jsonb refuses "\u0000" (and lone surrogates) — strings read from the
// registry / binaries often contain them. Clean every string, cap huge lists.
const BAD = /[\u0000\ud800-\udfff]/g;
function clean(v, depth = 0) {
  if (typeof v === 'string') return v.replace(BAD, '').slice(0, v.startsWith('data:image') ? 4_000_000 : 4000);
  if (Array.isArray(v)) return v.slice(0, 2000).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object' && depth < 8) {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k.replace(BAD, '')] = clean(x, depth + 1);
    return o;
  }
  return v;
}

// keep the stored row a sane size (screenshot + the most useful lists first)
function shrink(r) {
  const cap = { ExecutedPrograms: 400, Mods: 400, Suspicious: 300, Commands: 300, RecentFiles: 150, EventLogEntries: 100,
    NetworkConnections: 150, ScheduledTasks: 150, LoadedDrivers: 200, StartupEntries: 150, ArtifactsCollected: 200 };
  for (const [k, n] of Object.entries(cap)) if (Array.isArray(r[k]) && JSON.stringify(r).length > 4_500_000) r[k] = r[k].slice(0, n);
  if (JSON.stringify(r).length > 6_000_000) delete r.ScreenshotJpegBase64;
  return r;
}

export default wrap(async (req, res) => {
  // the scanner checks the PIN BEFORE scanning:  GET /api/scan-report?pin=ABCD2345
  if (req.method === 'GET') {
    const pin = String(req.query.pin || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const rows = pin ? await sb(`scan_pins?pin=eq.${enc(pin)}&select=used,license_id,game`)
      .catch(() => sb(`scan_pins?pin=eq.${enc(pin)}&select=used,license_id`)) : [];   // before supabase-v30-games.sql
    if (!rows || !rows.length) return send(res, 404, { error: 'unknown pin' });
    if (rows[0].used) return send(res, 410, { error: 'pin already used' });
    if (rows[0].license_id) {
      const licenses=await sb(`scanner_licenses?id=eq.${enc(rows[0].license_id)}&revoked_at=is.null&select=id`);
      if(!licenses?.length) return send(res,403,{error:'license revoked'});
    }
    return send(res, 200, { ok: true, game: gameOf(rows[0].game) });
  }
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const raw = readBody(req);
  if (!raw || typeof raw !== 'object' || !Object.keys(raw).length) throw httpError(400, 'empty or invalid report');
  const report = shrink(clean(raw));
  const pin = String(report.Pin || report.pin || '').trim().toUpperCase();
  if (!pin) throw httpError(400, 'missing pin');

  // used + license_id are needed for the two checks below (they were never read before, so used PINs could be re-sent)
  const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id,used,license_id,game`)
    .catch(() => sb(`scan_pins?pin=eq.${enc(pin)}&select=id,used,license_id`));
  if (!rows || !rows.length) throw httpError(404, `unknown pin ${pin}`);

  if(rows[0].used) throw httpError(410,'pin already used');
  if(rows[0].license_id){
    const licenses=await sb(`scanner_licenses?id=eq.${enc(rows[0].license_id)}&revoked_at=is.null&select=id`);
    if(!licenses?.length) throw httpError(403,'license revoked');
  }
  report.Game = gameOf(rows[0].game);   // the game comes from the PIN, not from the player's PC
  const dets = report.Detections || report.detections || [];
  const verdict = report.Verdict || report.verdict
    || (dets.some((d) => d.Severity === 2 || d.Severity === 'High') ? 'cheating' : dets.length ? 'suspicious' : 'clean');

  // v29: was this PC already checked (here or on another HeRo Shield server)?
  const hist = await pcHistory({ report, pinId: rows[0].id, licenseId: rows[0].license_id, verdict }).catch(() => null);
  if (hist) report.PcHistory = hist;

  await sb(`scan_pins?id=eq.${rows[0].id}&used=eq.false`, {
    method: 'PATCH',
    body: { used: true, result: verdict, report },
  });

  return send(res, 200, { ok: true });
});
