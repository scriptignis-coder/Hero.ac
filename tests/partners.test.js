import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/partners.js';
import { setSession, clearAccessCache } from '../api/_lib.js';

const saved = { ...process.env }, realFetch = globalThis.fetch;
test.after(() => { process.env = saved; globalThis.fetch = realFetch; clearAccessCache(); });
const as = (id, method, body = {}, query = {}) => { let cookie = ''; setSession({ setHeader(_k, v) { cookie = v.split(';')[0]; } }, { id, name: 'T' }); return { method, headers: { cookie }, body, query }; };
const run = async (req) => { const res = { code: 0, data: null, headers: {} }; res.status = (c) => { res.code = c; return res; }; res.json = (d) => { res.data = d; return res; }; res.setHeader = (k, v) => { res.headers[k] = v; }; await handler(req, res); return res; };

test('partners: everyone reads, only Owner/Admin add, staff and Admin (test) are refused', async () => {
  Object.assign(process.env, { ADMIN_DISCORD_IDS: '101', SESSION_SECRET: 'x', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
  clearAccessCache();
  const writes = [];
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('discord.com/api/v10/invites/GOOD')) return new Response(JSON.stringify({ guild: { id: '555555555555555555', name: 'Cool RP', icon: 'abc' }, approximate_member_count: 1234 }));
    if (u.includes('discord.com/api/v10/invites/')) return new Response('{}', { status: 404 });
    if (u.includes('user_access')) { const id = /discord_id=eq\.(\d+)/.exec(u)?.[1]; return new Response(JSON.stringify(id === '202' ? [{ herocheck: true }] : id === '404' ? [{ viewer: true }] : [])); }
    if (u.includes('/partners') && (o.method || 'GET') === 'GET') return new Response(JSON.stringify([{ id: 1, name: 'Cool RP', invite: 'https://discord.gg/GOOD', description: 'desc' }]));
    if (u.includes('/partners') || u.includes('audit_logs')) { writes.push([o.method, u]); return new Response(null, { status: 201 }); }
    return new Response('[]');
  };
  const list = await run({ method: 'GET', headers: {}, query: {} });
  assert.equal(list.code, 200); assert.equal(list.data.partners.length, 1);

  const staff = await run(as('202', 'POST', { invite: 'https://discord.gg/GOOD', description: 'Great server' }));
  assert.equal(staff.code, 403);
  const tester = await run(as('404', 'POST', { invite: 'https://discord.gg/GOOD', description: 'Great server' }));
  assert.equal(tester.code, 403);
  const bad = await run(as('101', 'POST', { invite: 'https://discord.gg/NOPE', description: 'Great server' }));
  assert.equal(bad.code, 400);
  const ok = await run(as('101', 'POST', { invite: 'https://discord.gg/GOOD', description: 'Great server' }));
  assert.equal(ok.code, 200); assert.equal(ok.data.partner.name, 'Cool RP'); assert.equal(ok.data.partner.members, 1234);
  assert.ok(writes.some(([m, u]) => m === 'POST' && u.includes('/partners')));
  const del = await run(as('101', 'DELETE', {}, { id: '1' }));
  assert.equal(del.code, 200);
});
