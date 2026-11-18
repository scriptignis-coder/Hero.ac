import { sb, enc } from './_lib.js';

// Abandoned scans, and the blacklist they can lead to.
//
// The abuse: a licence holder points a PIN at their own PC, starts the scan, watches which of
// their cheats light up, and kills the scanner before it uploads. Staff never see a report, and
// the person has learned what the detection catches. Repeat it and they have mapped the product.
//
// The signal is a PIN that was STARTED and never finished. That is not proof by itself — an
// antivirus kills the scanner, a PC loses power, a player closes the window — so nothing here
// acts on a single one. Each abandonment is recorded, and the operator's threshold decides.
//
// Everything in this file fails soft: if the v36 tables are missing, scans and the dashboard
// carry on exactly as before.

// The scanner sends a pulse every 15 seconds while it works (api/scan-heartbeat.js).
// Three missed pulses is a scan that is no longer running: 45 seconds of silence cannot be a
// slow step, because the pulse is on its own timer and does not wait for the scan's work.
// The extra 45 seconds on top is for a laptop that slept, a network that dropped, a PC that
// swapped — real pauses that a working scanner recovers from.
const SILENT_AFTER_SEC = 90;

// A scanner too old to send a pulse at all is still handled: with no pulse ever recorded, the
// start time is used instead, and that one does get the long wait, because for those versions
// silence tells us nothing.
const NO_PULSE_AFTER_MIN = 20;

/** Cache the settings for a minute; they are read on nearly every dashboard load. */
let _set = { at: 0, kill: 1, self: 5 };
export async function abuseSettings() {
  if (Date.now() - _set.at < 60_000) return _set;
  try {
    const rows = await sb(`hs_settings?key=in.(abuse_threshold,self_scan_limit)&select=key,value`);
    const get = (k, d) => {
      const n = parseInt(rows?.find((r) => r.key === k)?.value ?? String(d), 10);
      return Number.isFinite(n) ? n : d;
    };
    _set = { at: Date.now(), kill: get('abuse_threshold', 1), self: get('self_scan_limit', 5) };
  } catch { _set = { at: Date.now(), kill: 1, self: 5 }; }
  return _set;
}
export async function abuseThreshold() { return (await abuseSettings()).kill; }

/**
 * Scans the licence holder ran on their own PC.
 *
 * Separate from the killed-scan count, and allowed a higher limit, because the two are not the
 * same thing. Killing a scan has no honest reason; scanning your own PC does — it is the first
 * thing anyone does after buying, and the obvious way to check the tool still works. One or two
 * is testing. A run of them is somebody learning what the detection catches, on their own
 * machine, where no report ever reaches staff.
 */
export async function selfScanCount(ownerDiscord) {
  try {
    const rows = await sb(`scan_pins?self_scan=eq.true&select=id&limit=200`
      + `&license_id=in.(${(await licensesOf(ownerDiscord)).map(enc).join(',')})`);
    return rows?.length || 0;
  } catch { return 0; }
}

async function licensesOf(ownerDiscord) {
  try {
    const rows = await sb(`scanner_licenses?owner_discord=eq.${enc(String(ownerDiscord))}&select=id`);
    return (rows || []).map((r) => r.id);
  } catch { return []; }
}

/** The active blacklist row for this Discord id, or null. */
export async function blacklistOf(discordId) {
  if (!discordId) return null;
  try {
    const rows = await sb(
      `hs_blacklist?discord_id=eq.${enc(String(discordId))}&lifted_at=is.null&select=reason,detail,created_at,created_by&limit=1`);
    return rows?.[0] || null;
  } catch { return null; }      // table not created yet: nobody is blacklisted
}

/**
 * Look at this owner's PINs, record any scan that was started and never finished, and
 * blacklist the account once the operator's threshold is crossed.
 *
 * Runs when the owner touches their own PINs, so it costs nothing on a quiet account.
 * Returns the blacklist row if one is now in force, otherwise null.
 */
export async function sweepAbandoned({ ownerDiscord, licenseIds }) {
  if (!ownerDiscord || !licenseIds?.length) return null;
  const silent = new Date(Date.now() - SILENT_AFTER_SEC * 1000).toISOString();
  const old = new Date(Date.now() - NO_PULSE_AFTER_MIN * 60_000).toISOString();

  let started;
  try {
    started = await sb(`scan_pins?license_id=in.(${licenseIds.map(enc).join(',')})`
      + `&used=eq.false&abandoned_at=is.null&started_at=not.is.null`
      + `&select=id,pin,player,license_id,started_at,starts,beat_at,self_scan&limit=80`);
  } catch { return null; }      // before v36: nothing to do
  // Not `return null` on an empty list: a licence holder can cross the self-scan limit without
  // ever killing a scan, and that check lives further down.
  started = started || [];

  // A scan is abandoned when its pulse has stopped. One that never had a pulse (an older
  // scanner) falls back to the long wait, because for those silence proves nothing.
  const stale = started.filter((p) => p.beat_at ? p.beat_at < silent : p.started_at < old);
  // NOTE: no early return here. An account can cross the self-scan limit without ever killing
  // a scan, and returning early on an empty `stale` list skipped that check completely.

  // mark them first, so a second request cannot count the same scan twice
  const now = new Date().toISOString();
  for (const p of stale) {
    try {
      const marked = await sb(
        `scan_pins?id=eq.${enc(p.id)}&abandoned_at=is.null`,
        { method: 'PATCH', body: { abandoned_at: now }, prefer: 'return=representation' });
      if (!marked?.length) continue;                 // another request got there first
      await sb('hs_abandoned_scans', { method: 'POST', prefer: 'return=minimal', body: {
        pin_id: p.id, pin: p.pin, license_id: p.license_id, owner_discord: String(ownerDiscord),
        player: p.player || null, starts: p.starts || 1, started_at: p.started_at,
        self_scan: !!p.self_scan,
      }});
    } catch { }
  }

  const cfg = await abuseSettings();

  let killed = 0;
  try {
    const rows = await sb(
      `hs_abandoned_scans?owner_discord=eq.${enc(String(ownerDiscord))}&select=id&limit=200`);
    killed = rows?.length || 0;
  } catch { return null; }

  const selfs = cfg.self > 0 ? await selfScanCount(ownerDiscord) : 0;

  // Either count on its own is enough. They are kept apart rather than added together because
  // they mean different things and deserve different limits.
  const byKill = cfg.kill > 0 && killed >= cfg.kill;
  const bySelf = cfg.self > 0 && selfs >= cfg.self;
  if (!byKill && !bySelf) return null;
  const total = killed;

  // already blacklisted (or an admin lifted it — a lifted row is left alone)
  const existing = await blacklistOf(ownerDiscord);
  if (existing) return existing;
  try {
    const lifted = await sb(
      `hs_blacklist?discord_id=eq.${enc(String(ownerDiscord))}&select=lifted_at&limit=1`);
    if (lifted?.length) return null;                 // lifted by an admin: do not re-apply by itself
  } catch { }

  const nScan = (n) => `${n} scan${n === 1 ? ' was' : 's were'}`;
  const reason = byKill && bySelf
    ? `${nScan(killed)} started on this account's PINs and never finished, and ${nScan(selfs)} run on the licence holder's own PC.`
    : byKill
      ? `${nScan(killed)} started on this account's PINs and never finished.`
      : `${nScan(selfs)} run on the licence holder's own PC rather than on a player's.`;
  const row = {
    discord_id: String(ownerDiscord), created_by: 'system', reason,
    detail: { abandoned: killed, self_scans: selfs, kill_limit: cfg.kill, self_limit: cfg.self,
              last_pins: stale.map((p) => p.pin).slice(0, 5) },
  };
  try { await sb('hs_blacklist', { method: 'POST', prefer: 'return=minimal', body: row }); }
  catch { return null; }
  return row;
}
