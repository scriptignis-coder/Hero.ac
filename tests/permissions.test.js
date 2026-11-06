import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccess, requireAccess, clearAccessCache } from '../api/_lib.js';

const saved = Object.fromEntries(['ADMIN_DISCORD_IDS','HEROSHIELD_IDS','HEROCHECK_IDS','SESSION_SECRET'].map(k=>[k,process.env[k]]));
function configure(admin='',shield='',check='') {
  process.env.ADMIN_DISCORD_IDS=admin; process.env.HEROSHIELD_IDS=shield; process.env.HEROCHECK_IDS=check;
  process.env.SESSION_SECRET='test-only-secret'; clearAccessCache();
}
test.after(()=>{ for(const [k,v] of Object.entries(saved)){ if(v===undefined)delete process.env[k]; else process.env[k]=v;} clearAccessCache(); });
test('permissions fail closed with no configured IDs',async()=>{
  configure(); assert.deepEqual(await getAccess({id:'101'}),{heroshield:false,herocheck:false,admin:false});
});
test('admin has both products and Access page',async()=>{
  configure('101'); assert.deepEqual(await getAccess({id:'101'}),{heroshield:true,herocheck:true,admin:true});
});
test('product roles stay separated',async()=>{
  configure('101','202','303');
  assert.deepEqual(await getAccess({id:'202'}),{heroshield:true,herocheck:false,admin:false});
  assert.deepEqual(await getAccess({id:'303'}),{heroshield:false,herocheck:true,admin:false});
});
test('unauthenticated access is denied',async()=>{
  configure('101');
  await assert.rejects(()=>requireAccess({headers:{}},'admin'),e=>e.status===401);
});
