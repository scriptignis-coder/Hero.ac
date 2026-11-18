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

  // ── is this the licence holder scanning their own PC? ──────────────────────────────────
  //
  // This used to be worked out from the finished report. That is too late for the case it is
  // meant to catch: somebody points a PIN at themselves, watches which of their cheats light
  // up at step 1, and kills the scanner. No report is ever uploaded, so the self-scan was
  // never recorded and the kill looked like an ordinary abandoned scan.
  //
  // The scanner now sends who and which machine on its FIRST pulse, which is seconds in. From
  // then on a killed self-scan is a self-scan on record, whether or not a report follows.
  const b = req.body && typeof req.body === 'object' ? req.body : null;
  if (b && (b.discordId || (Array.isArray(b.ids) && b.ids.length))) {
    try {
      const rows = await sb(`scan_pins?pin=eq.${enc(pin)}&select=id,license_id&limit=1`);
      const licId = rows?.[0]?.license_id;
      if (licId) {
        const lic = await sb(`scanner_licenses?id=eq.${enc(licId)}&revoked_at=is.null&select=owner_discord`);
        const owner = lic?.[0]?.owner_discord;
        if (owner) {
          // The scanner sends the raw identifiers; idsFromReport expects them under System,
          // so they are handed over in that shape rather than duplicating its normalising.
          const asReport = { System: {
            Hwid: b.ids?.[0] || null, MachineGuid: b.ids?.[1] || null, Uuid: b.ids?.[2] || null,
            BiosSerial: b.ids?.[3] || null, DiskSerials: b.ids?.[4] || null,
          }, DiscordId: b.discordId || null };
          const discordMatches = !!(b.discordId && String(owner) === String(b.discordId));
          const { isOwnPc, rememberOwnPc } = await import('./_ownpc.js');
          const machineKnown = await isOwnPc(owner, asReport);
          if (discordMatches) await rememberOwnPc(owner, asReport);
          if (discordMatches || machineKnown) {
            await sb(`scan_pins?id=eq.${enc(rows[0].id)}`, {
              method: 'PATCH', prefer: 'return=minimal', body: { self_scan: true },
            });
          }
        }
      }
    } catch { }      // identification is a bonus on this route; the pulse itself already landed
  }

  // the body is deliberately tiny; this runs every 15 seconds
  return send(res, 200, { ok: true });
});
