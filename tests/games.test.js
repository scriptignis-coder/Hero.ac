import test from 'node:test';
import assert from 'node:assert/strict';
import { gameOf, GAMES } from '../api/_games.js';
import scanReport from '../api/scan-report.js';
import scannerSigs from '../api/scanner-sigs.js';

const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; });
Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
function call(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; },
      end(b) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
    handler({ method: 'GET', headers: {}, ...req }, res);
  });
}

test('gameOf: unknown → fivem, known kept', () => {
  assert.deepEqual(Object.keys(GAMES), ['fivem', 'redm', 'minecraft', 'roblox']);
  assert.equal(gameOf('Minecraft'), 'minecraft');
  assert.equal(gameOf('valorant'), 'fivem');
  assert.equal(gameOf(undefined), 'fivem');
});

test('scanner PIN check returns the game of the PIN', async () => {
  globalThis.fetch = async (u) => /scan_pins/.test(String(u)) ? json([{ used: false, license_id: null, game: 'roblox' }]) : json([]);
  const r = await call(scanReport, { query: { pin: 'ABCD2345' } });
  assert.equal(r.status, 200); assert.equal(r.body.game, 'roblox');
});

test('PIN check still works before the v30 SQL (no game column) → fivem', async () => {
  globalThis.fetch = async (u) => /select=used,license_id,game/.test(String(u)) ? json({ message: 'column scan_pins.game does not exist' }, 400) : json([{ used: false, license_id: null }]);
  const r = await call(scanReport, { query: { pin: 'ABCD2345' } });
  assert.equal(r.status, 200); assert.equal(r.body.game, 'fivem');
});

test('scanner signatures carry their games', async () => {
  globalThis.fetch = async (u) => {
    u = String(u);
    if (/scan_pins/.test(u)) return json([{ license_id: 'L1' }]);
    if (/scanner_licenses/.test(u)) return json([{ owner_discord: '101' }]);
    return json([{ name: 'Vape', file_names: ['vape.exe'], severity: 'high', games: ['minecraft'] }, { name: 'Spoofer', file_names: ['sp.exe'], severity: 'high', games: [] }]);
  };
  const r = await call(scannerSigs, { query: { pin: 'ABCD2345' } });
  assert.deepEqual(r.body.map((s) => [s.name, s.games]), [['Vape', ['minecraft']], ['Spoofer', []]]);
});

import { setSession } from '../api/_lib.js';
import pinsApi from '../api/pins.js';
test('a used PIN cannot be deleted, a pending one can', async () => {
  Object.assign(process.env, { SESSION_SECRET: 'test-only-secret', ADMIN_DISCORD_IDS: '101' });
  let cookie = ''; setSession({ setHeader(_k, v) { cookie = v.split(';')[0]; } }, { id: '101', name: 'T' });
  const deleted = [];
  const mk = (used) => async (u, o = {}) => {
    u = String(u);
    if (o.method === 'DELETE') { deleted.push(u); return json([]); }
    if (/scanner_licenses/.test(u)) return json([{ id: 'L1', owner_discord: '101', label: 'Main' }]);
    if (/scan_pins\?id=eq/.test(u)) return json([{ id: '11111111-1111-1111-1111-111111111111', license_id: 'L1', pin: 'ABCD2345', used }]);
    return json([]);
  };
  const req = { method: 'DELETE', headers: { cookie }, query: { id: '11111111-1111-1111-1111-111111111111' } };
  globalThis.fetch = mk(true);
  let r = await call(pinsApi, req); assert.equal(r.status, 409); assert.equal(deleted.length, 0);
  globalThis.fetch = mk(false);
  r = await call(pinsApi, req); assert.equal(r.status, 200); assert.ok(deleted.some((u) => /used=eq\.false/.test(u)));
});
