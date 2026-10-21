import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {adminAuthConfig,createConfiguredAdminAuthentication} from '../backend/admin-auth.mjs';
import {createRosterServer} from '../backend/server.mjs';

const valid={ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIREBASE_PROJECT_ID:'demo-abc-attendance',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',ABC_ADMIN_UIDS:'["fictional-admin"]'};
test('Admin configuration requires explicit local demo mode and a server UID allowlist',()=>{
  assert.deepEqual(adminAuthConfig(valid),{projectId:'demo-abc-attendance',host:'127.0.0.1:9099',uids:['fictional-admin']});
  assert.deepEqual(adminAuthConfig({...valid,ABC_ADMIN_UIDS:'[]'}).uids,[]);
  for(const change of [
    {ABC_ADMIN_AUTH_MODE:undefined},{ABC_ADMIN_AUTH_MODE:'production'},{ABC_FIREBASE_PROJECT_ID:undefined},{ABC_FIREBASE_PROJECT_ID:'real-project'},
    {FIREBASE_AUTH_EMULATOR_HOST:undefined},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},{FIREBASE_AUTH_EMULATOR_HOST:'192.168.1.1:9099'},
    {FIREBASE_AUTH_EMULATOR_HOST:'http://127.0.0.1:9099'},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:0'},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:65536'},
    {FIREBASE_AUTH_EMULATOR_HOST:'identitytoolkit.googleapis.com:443'},{ABC_ADMIN_UIDS:undefined},{ABC_ADMIN_UIDS:'null'},
    {ABC_ADMIN_UIDS:'["*"]'},{ABC_ADMIN_UIDS:'["a","a"]'},{ABC_ADMIN_UIDS:'{"admin":true}'},
    {GOOGLE_APPLICATION_CREDENTIALS:'forbidden.json'},{FIREBASE_TOKEN:'fictional'},{NODE_ENV:'production'},{GCLOUD_PROJECT:'real-project'},{GOOGLE_CLOUD_PROJECT:'real-project'}
  ])assert.throws(()=>adminAuthConfig({...valid,...change}));
});

test('Unconfigured admin boundary fails closed while unknown administrative actions remain unavailable',async t=>{
  const server=createRosterServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/api/admin/session','/api/admin/devices','/api/admin']){
    const response=await fetch(base+route,{headers:{Authorization:'Bearer ABC2026','X-Admin':'true',Cookie:'adminUnlocked=true'}});
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const previous={...process.env};
  try{
    delete process.env.ABC_ADMIN_AUTH_MODE;delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    assert.equal(await createConfiguredAdminAuthentication(),undefined);
    process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
    await assert.rejects(createConfiguredAdminAuthentication());
    process.env.ABC_ADMIN_AUTH_MODE='firebase-auth-emulator';delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    await assert.rejects(createConfiguredAdminAuthentication());
  }finally{
    for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
    Object.assign(process.env,previous);
  }
});
