// PC history across every HeRo Shield server (v29).
// When a scan report arrives, the PC's hardware identifiers are compared with every earlier scan:
// if this PC was already checked (here or on a partner server), the report says so — and how it went.
// Matching uses several IDs, so a spoofer that changes only the HWID is still recognised
// (and "HWID changed" is itself shown as a red flag).
// Other servers' names are never shown: only the date, the verdict and "this server" / "another server".
import { sb, enc } from './_lib.js';

const JUNK = /^(tobefilledbyoem|defaultstring|systemserialnumber|none|null|unknown|notapplicable|na|0+|f+|1234567890|0123456789|chassisserialnumber|baseboardserialnumber|serial|oem|empty|notspecified)$/i;

function norm(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (s.length < 6) return null;
  const bare = s.replace(/[-:{}._/]/g, '');
  if (!bare || JUNK.test(bare) || /^0+$/.test(bare) || /^f+$/.test(bare)) return null;
  return s.slice(0, 120);
}

/** Identifiers of a PC from a scan report, as "kind:value" strings. */
export function idsFromReport(report) {
  const S = (report && (report.System || report.system)) || {};
  const out = new Map();   // value -> kind (first kind wins)
  const add = (kind, v) => { const n = norm(v); if (n && !out.has(`${kind}:${n}`)) out.set(`${kind}:${n}`, kind); };
  add('hwid', S.Hwid);
  add('guid', S.MachineGuid);
  add('uuid', S.Uuid);
  add('bios', S.BiosSerial);
  for (const d of String(S.DiskSerials || '').split(/[,;|\n]+/)) add('disk', d);
  return [...out.keys()].slice(0, 16);
}

const KIND_NAME = { hwid: 'HWID', guid: 'Windows Machine ID', uuid: 'motherboard UUID', bios: 'BIOS serial', disk: 'disk serial' };

/** Summary shown in the report. rows = earlier pc_history rows (newest first). */
export function summarize(rows, myIds, licenseId) {
  const mine = new Set(myIds);
  const list = (rows || []).map((r) => {
    const shared = (r.ids || []).filter((x) => mine.has(x));
    return {
      at: r.scanned_at, verdict: r.verdict || 'unknown', detections: r.detections || 0,
      sameServer: !!(licenseId && r.license_id && String(r.license_id) === String(licenseId)),
      matchedBy: [...new Set(shared.map((x) => KIND_NAME[x.split(':')[0]] || x.split(':')[0]))],
      hwidSame: shared.some((x) => x.startsWith('hwid:')),
    };
  }).filter((x) => x.matchedBy.length);
  const count = (v) => list.filter((x) => x.verdict === v).length;
  const otherServers = list.filter((x) => !x.sameServer).length;
  // same PC (several other IDs match) but a different HWID = the HWID was changed between the scans
  const hwidChanged = list.some((x) => !x.hwidSame && x.matchedBy.length >= 2 && myIds.some((i) => i.startsWith('hwid:')));
  return {
    seen: list.length, cheating: count('cheating'), suspicious: count('suspicious'), clean: count('clean'),
    otherServers, hwidChanged,
    first: list.length ? list[list.length - 1].at : null, last: list.length ? list[0].at : null,
    scans: list.slice(0, 25),
  };
}

/** Looks up earlier scans of this PC, then records this one. Never throws (missing table = no history). */
export async function pcHistory({ report, pinId, licenseId, verdict }) {
  const ids = idsFromReport(report);
  if (!ids.length) return null;
  let summary = null;
  try {
    const set = '{' + ids.map((x) => '"' + x.replace(/["\\{}]/g, '') + '"').join(',') + '}';
    const rows = await sb(`pc_history?ids=ov.${enc(set)}&select=ids,verdict,detections,license_id,scanned_at&order=scanned_at.desc&limit=100`);
    summary = summarize(rows, ids, licenseId);
  } catch (e) {
    console.error('pc history lookup failed (run supabase-v29-pc-history.sql):', e.message);
  }
  try {
    const dets = report.Detections || [];
    await sb('pc_history', {
      method: 'POST', prefer: 'return=minimal',
      body: { ids, pin_id: pinId || null, license_id: licenseId || null, verdict: verdict || null,
              detections: dets.length, scanned_at: new Date().toISOString() },
    });
  } catch (e) {
    console.error('pc history save failed (run supabase-v29-pc-history.sql):', e.message);
  }
  return summary;
}
