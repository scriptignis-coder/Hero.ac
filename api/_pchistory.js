// Player history across every HeRo Shield server (v29, v35).
// 1. Earlier scans of the same PC — recognised by its hardware IDs (HWID, Machine ID, UUID, BIOS, disks),
//    so a spoofer that changes only the HWID is still recognised ("HWID changed" is a red flag).
//    Each scan shows the server that ran it, when, the game, the verdict and its main detections.
// 2. FiveM bans on HeRo Shield servers — matched by the Discord ID and the Steam IDs found on the PC,
//    with the server name and the ban reason.
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
  const out = new Map();
  const add = (kind, v) => { const n = norm(v); if (n && !out.has(`${kind}:${n}`)) out.set(`${kind}:${n}`, kind); };
  add('hwid', S.Hwid);
  add('guid', S.MachineGuid);
  add('uuid', S.Uuid);
  add('bios', S.BiosSerial);
  for (const d of String(S.DiskSerials || '').split(/[,;|\n]+/)) add('disk', d);
  return [...out.keys()].slice(0, 16);
}

/** FiveM identifiers of the player found on the PC: discord:<id> and steam:<hex> (from Steam ID 64). */
export function playerIdsFromReport(report) {
  const out = new Set();
  const d = String((report && report.DiscordId) || '').trim();
  if (/^\d{15,22}$/.test(d)) out.add('discord:' + d);
  for (const s of (report && report.SteamAccounts) || []) {
    const m = /(7656\d{13})/.exec(String(s));
    if (m) out.add('steam:' + BigInt(m[1]).toString(16));
  }
  return [...out].slice(0, 12);
}

const KIND_NAME = { hwid: 'HWID', guid: 'Windows Machine ID', uuid: 'motherboard UUID', bios: 'BIOS serial', disk: 'disk serial' };

/** Summary shown in the report. rows = other pc_history rows (newest first). */
export function summarize(rows, myIds, licenseId) {
  const mine = new Set(myIds);
  const list = (rows || []).map((r) => {
    const shared = (r.ids || []).filter((x) => mine.has(x));
    return {
      at: r.scanned_at, verdict: r.verdict || 'unknown', detections: r.detections || 0,
      server: r.server_name || (r.license_id && String(r.license_id) === String(licenseId) ? 'This server' : 'A HeRo Shield server'),
      game: r.game || 'fivem', top: Array.isArray(r.top) ? r.top.slice(0, 5) : [],
      sameServer: !!(licenseId && r.license_id && String(r.license_id) === String(licenseId)),
      matchedBy: [...new Set(shared.map((x) => KIND_NAME[x.split(':')[0]] || x.split(':')[0]))],
      hwidSame: shared.some((x) => x.startsWith('hwid:')),
    };
  }).filter((x) => x.matchedBy.length);
  const count = (v) => list.filter((x) => x.verdict === v).length;
  const otherServers = list.filter((x) => !x.sameServer).length;
  const hwidChanged = list.some((x) => !x.hwidSame && x.matchedBy.length >= 2 && myIds.some((i) => i.startsWith('hwid:')));
  return {
    seen: list.length, cheating: count('cheating'), suspicious: count('suspicious'), clean: count('clean'),
    otherServers, hwidChanged,
    first: list.length ? list[list.length - 1].at : null, last: list.length ? list[0].at : null,
    scans: list.slice(0, 25),
  };
}

/** Earlier scans of this PC (all servers), without the scan of `excludePinId`. */
export async function lookupScans(report, licenseId, excludePinId) {
  const ids = idsFromReport(report);
  if (!ids.length) return null;
  const set = '{' + ids.map((x) => '"' + x.replace(/["\\{}]/g, '') + '"').join(',') + '}';
  const base = `pc_history?ids=ov.${enc(set)}&order=scanned_at.desc&limit=100&select=`;
  const rows = await sb(base + 'ids,verdict,detections,license_id,scanned_at,pin_id,server_name,top,game')
    .catch(() => sb(base + 'ids,verdict,detections,license_id,scanned_at,pin_id'));   // before supabase-v35
  return summarize((rows || []).filter((r) => !excludePinId || String(r.pin_id) !== String(excludePinId)), ids, licenseId);
}

/** FiveM bans of this player on every HeRo Shield server (by Discord / Steam ID), newest first. */
export async function lookupBans(report) {
  const pids = playerIdsFromReport(report);
  if (!pids.length) return null;
  const q = (s) => `"${s.replace(/["\\]/g, '')}"`;
  const or = [...pids.map((p) => `identifier.eq.${q(p)}`), ...pids.map((p) => `identifiers.cs.[${q(p)}]`)].join(',');
  const rows = await sb(`bans?or=(${enc(or)})&select=ban_id,player,reason,active,identifier,identifiers,created_at,servers(name)&order=created_at.desc&limit=50`);
  const bans = (rows || []).map((b) => {
    const all = new Set([b.identifier, ...(Array.isArray(b.identifiers) ? b.identifiers : [])].map(String));
    const by = pids.filter((p) => all.has(p)).map((p) => (p.startsWith('discord:') ? 'Discord ID' : 'Steam account'));
    return { server: b.servers?.name || 'A HeRo Shield server', reason: b.reason || 'No reason given', player: b.player || '', at: b.created_at, active: !!b.active, banId: b.ban_id, matchedBy: [...new Set(by)] };
  });
  const cheat = /cheat|aim|esp|inject|menu|mod ?menu|executor|lua|trigger|spoof|hack|noclip|godmode|teleport|exploit|macro|recoil|wallhack|silent/i;
  return {
    count: bans.length, active: bans.filter((b) => b.active).length,
    servers: [...new Set(bans.map((b) => b.server))].length,
    cheating: bans.filter((b) => cheat.test(b.reason)).length,
    lookedUp: pids.map((p) => (p.startsWith('discord:') ? 'Discord ID' : 'Steam account')),
    bans: bans.slice(0, 25),
  };
}

/** On a new report: look up the history, then record this scan. Never throws. */
export async function pcHistory({ report, pinId, licenseId, verdict }) {
  const ids = idsFromReport(report);
  if (!ids.length) return null;
  let summary = null, serverName = null;
  try { serverName = licenseId ? (await sb(`scanner_licenses?id=eq.${enc(licenseId)}&select=label&limit=1`))?.[0]?.label || null : null; } catch { }
  try { summary = await lookupScans(report, licenseId, pinId); }
  catch (e) { console.error('pc history lookup failed (run supabase-v29-pc-history.sql):', e.message); }
  const dets = report.Detections || [];
  const top = [...new Set(dets.map((d) => String(d.Signature || d.File || '').slice(0, 80)).filter(Boolean))].slice(0, 5);
  const row = { ids, pin_id: pinId || null, license_id: licenseId || null, verdict: verdict || null, detections: dets.length, scanned_at: new Date().toISOString() };
  try { await sb('pc_history', { method: 'POST', prefer: 'return=minimal', body: { ...row, server_name: serverName, top, game: String(report.Game || 'fivem').toLowerCase() } }); }
  catch (e) {
    try { await sb('pc_history', { method: 'POST', prefer: 'return=minimal', body: row }); }    // before supabase-v35
    catch (e2) { console.error('pc history save failed (run supabase-v29-pc-history.sql):', e2.message); }
  }
  return summary;
}
