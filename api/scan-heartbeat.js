import { wrap, send, sb, enc, httpError } from './_lib.js';

// The scanner's pulse.
//
// Without this, a killed scan is only noticed when somebody eventually looks and sees a PIN
// that started and never finished — twenty minutes later at best. That is long enough for
// someone to start a scan, read the screen, kill it, and move on to the next cheat.
//
// So the scanner says "still here" every 15 seconds while it works. When the pulse stops and
// no report arrives, the scan was killed, and that is known within about a minute and a half.
//
// No session: the scanner has a PIN, not a login — exactly like scan-report.js. The PIN is the
// credential, and all this can do is write a timestamp on a PIN that already exists.
export default wrap(async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') throw httpError(405, 'POST only');

  const pin = String(req.query.pin || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!pin) throw httpError(400, 'pin required');

  try {
    await sb(`scan_pins?pin=eq.${enc(pin)}&used=eq.false`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { beat_at: new Date().toISOString() },
    });
  } catch { }          // before the v36 migration: the scan is unaffected

  // the body is deliberately tiny; this runs every 15 seconds
  return send(res, 200, { ok: true });
});
