import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAccess, clearAccessCache, setSession } from '../api/_lib.js';

const saved = { ...process.env }; const realFetch = globalThis.fetch;
test.after(() => { process.env = saved; globalThis.fetch = realFetch; clearAccessCache(); });
function setup(rows) {
  Object.assign(process.env, { ADMIN_DISCORD_IDS: '101', HEROSHIELD_IDS: '', HEROCHECK_IDS: '', SESSION_SECRET: 'test-only-secret', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
  clearAccessCache();
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/paid_entitlements|staff\?/.test(u)) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    const id = /discord_id=eq\.(\d+)/.exec(u)?.[1];
    return new Response(JSON.stringify(rows[id] ? [rows[id]] : []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const as = (id) => { let cookie = ''; setSession({ setHeader(_k, v) { cookie = v.split(';')[0]; } }, { id, name: 'T' }); return { method: 'GET', headers: { cookie } }; };

test('Staff role (given by an admin) opens the anticheat tabs without a paid plan', async () => {
  setup({ 606: { heroshield: true, herocheck: true } });
  assert.equal((await requireAccess(as('606'), 'heroshield')).id, '606');
  assert.equal((await requireAccess(as('606'), 'herocheck')).id, '606');
});
test('Scanner role cannot open the Staff (anticheat) tabs', async () => {
  setup({ 707: { heroshield: false, herocheck: true } });
  assert.equal((await requireAccess(as('707'), 'herocheck')).id, '707');
  await assert.rejects(() => requireAccess(as('707'), 'heroshield'), (e) => e.status === 403);
});
