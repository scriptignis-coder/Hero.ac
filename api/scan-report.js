import { wrap, send, readBody, sb, enc, httpError } from './_lib.js';

// Receives the finished scan report from the HeRo Scanner (no session — the
// player's PC posts it). Matches the PIN and stores the result on the row.
export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const report = readBody(req);
  const pin = String(report.Pin || report.pin || '').trim();
  if (!pin) throw httpError(400, 'missing pin');

  const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id`);
  if (!rows || !rows.length) throw httpError(404, 'unknown pin');

  const verdict = report.Verdict || report.verdict
    || ((report.Detections || report.detections || []).some(
         (d) => (d.Severity === 2 || d.Severity === 'High')) ? 'cheating' : 'clean');

  await sb(`scan_pins?id=eq.${rows[0].id}`, {
    method: 'PATCH',
    body: { used: true, result: verdict, report },
  });

  return send(res, 200, { ok: true });
});
