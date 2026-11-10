import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccess, requireAccess, clearAccessCache, setSession } from '../api/_lib.js';

const saved = { ...process.env }; const realFetch = globalThis.fetch;
test.after(() => { process.env = saved; globalThis.fetch = realFetch; clearAccessCache(); });
function setup(rows) {
  Object.assign(process.env, { ADMIN_DISCORD_IDS: '101', HEROSHIELD_IDS: '', HEROCHECK_IDS: '', SESSION_SECRET: 'test-only-secret', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
  clearAccessCache();
  globalThis.fetch = async (url) => {
    const id = /discord_id=eq\.(\d+)/.exec(String(url))?.[1];
    return new Response(JSON.stringify(rows[id] ? [rows[id]] : []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const as = (id, method) => { let cookie = ''; setSession({ setHeader(_k, v) { cookie = v.split(';')[0]; } }, { id, name: 'T' }); return { method, headers: { cookie } }; };

test('Admin (test) sees every tab but cannot change anything', async () => {
  setup({ 404: { viewer: true, admin: false, heroshield: false, herocheck: false } });
  const a = await getAccess({ id: '404' });
  assert.equal(a.viewer, true); assert.equal(a.admin, true); assert.equal(a.herocheck, true);
  assert.equal((await requireAccess(as('404', 'GET'), 'admin')).id, '404');
  for (const m of ['POST', 'PATCH', 'DELETE'])
    await assert.rejects(() => requireAccess(as('404', m), 'herocheck'), (e) => e.status === 403 && /View-only/.test(e.message));
});
test('a real Admin from the database is not view-only', async () => {
  setup({ 505: { viewer: true, admin: true } });
  const a = await getAccess({ id: '505' });
  assert.equal(a.viewer, undefined);
  assert.equal((await requireAccess(as('505', 'POST'), 'herocheck')).id, '505');
});
