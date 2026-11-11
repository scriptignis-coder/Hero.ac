import test from 'node:test';
import assert from 'node:assert/strict';
import { idsFromReport, summarize, pcHistory } from '../api/_pchistory.js';

const rep = (o) => ({ System: { Hwid: 'A1B2-C3D4-E5F6', MachineGuid: '1f2e3d4c-aaaa-bbbb-cccc-0123456789ab', Uuid: '03000200-0400-0500-0006-000700080009', BiosSerial: 'To be filled by O.E.M.', DiskSerials: 'S4EWNX0R123456, 0000_0000_0000_0000', ...o } });

test('junk serials are ignored, real IDs kept', () => {
  const ids = idsFromReport(rep());
  assert.ok(ids.includes('hwid:a1b2-c3d4-e5f6'));
  assert.ok(ids.includes('disk:s4ewnx0r123456'));
  assert.ok(!ids.some((x) => x.startsWith('bios:')), 'O.E.M. placeholder dropped');
  assert.ok(!ids.includes('disk:0000_0000_0000_0000'), 'zero serial dropped');
});

test('summary: earlier cheating scan on another server + HWID changed', () => {
  const now = idsFromReport(rep({ Hwid: 'NEW-SPOOFED-1234' }));
  const before = idsFromReport(rep());
  const s = summarize([
    { ids: before, verdict: 'cheating', detections: 3, license_id: 'L2', scanned_at: '2026-11-01T10:00:00Z' },
    { ids: ['hwid:other-pc-9999'], verdict: 'clean', license_id: 'L1', scanned_at: '2026-10-01T10:00:00Z' },
  ], now, 'L1');
  assert.equal(s.seen, 1); assert.equal(s.cheating, 1); assert.equal(s.otherServers, 1);
  assert.equal(s.hwidChanged, true);
  assert.deepEqual(s.scans[0].matchedBy.sort(), ['Windows Machine ID', 'disk serial', 'motherboard UUID'].sort());
});

test('same PC same HWID on this server: not flagged as spoofed', () => {
  const ids = idsFromReport(rep());
  const s = summarize([{ ids, verdict: 'clean', license_id: 'L1', scanned_at: '2026-11-01T10:00:00Z' }], ids, 'L1');
  assert.equal(s.seen, 1); assert.equal(s.hwidChanged, false); assert.equal(s.scans[0].sameServer, true);
});

test('pcHistory never throws when the table is missing', async () => {
  const realFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'relation "pc_history" does not exist' }), { status: 404, headers: { 'content-type': 'application/json' } });
  const orig = console.error; console.error = () => {};
  try { assert.equal(await pcHistory({ report: rep(), verdict: 'clean' }), null); }
  finally { globalThis.fetch = realFetch; console.error = orig; }
});
