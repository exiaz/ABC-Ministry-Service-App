import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import net from 'node:net';
import {randomUUID,randomBytes} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {createPrototypeServer} from '../../server.mjs';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
async function listen(server,port=0){server.listen(port,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function stop(server){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
async function wait(page,phase){await page.waitForFunction(p=>document.querySelector('#pairing-root')?.dataset.phase===p,phase);}

test('Mentor pairing UI with real Chrome, IndexedDB and local Auth/Firestore',{timeout:120000},async t=>{
  const adapters=await emulatorFixture({source:fictionalRosterData()});
  const previous=process.env.ABC_ADMIN_UIDS,uid='fictional-ui-'+randomUUID();process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  const app=initializeApp({projectId:adapters.config.projectId},'mentor-ui-'+randomUUID()),auth=getAuth(app);
  const email=uid+'@example.invalid',password=randomBytes(32).toString('base64url');await auth.createUser({uid,email,password});
  const adminAuthentication=await createLocalAdminAuthentication(),token=await adminAuthentication.signIn({email,password});
  await adapters.root.collection('adminPairingPermissions').doc(uid).set({active:true,grants:[scope]});
  const reserve=net.createServer();await listen(reserve);const frontPort=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const origin='http://127.0.0.1:'+frontPort,api=createRosterServer({...adapters,adminAuthentication,mentorOrigin:origin}),apiOrigin=await listen(api);
  const frontend=createPrototypeServer({mentorMode:true,apiOrigin});await listen(frontend,frontPort);
  const legacy=createPrototypeServer(),legacyOrigin=await listen(legacy);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(async()=>{await browser.close();await stop(frontend);await stop(legacy);await stop(api);await adminAuthentication.close();await auth.deleteUser(uid);await deleteApp(app);await adapters.close();if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),page=await context.newPage();
  const errors=[],requests=[],logs=[];page.on('pageerror',error=>errors.push(error.name));page.on('console',message=>logs.push(message.text()));page.on('request',req=>requests.push(new URL(req.url()).pathname));
  const issue=async(options={})=>{
    const response=await fetch(apiOrigin+'/api/admin/pairing-codes',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({grants:[scope],...options})});assert.equal(response.status,201);return response.json();
  };
  const activate=async code=>{await page.locator('#pairing-code').fill(code);await page.locator('#pairing-form button[type=submit]').click();};
  await page.goto(origin);await wait(page,'inactive');
  await mkdir('screenshots',{recursive:true});await page.screenshot({path:'screenshots/mentor-roster-activation.png',fullPage:true});
  await t.test('Unauthenticated flags cannot unlock the shell; invalid/expired codes are explained',async()=>{
    await page.evaluate(()=>localStorage.setItem('authorized','true'));await page.reload();await wait(page,'inactive');assert.equal(await page.locator('.school-card').count(),0);
    await activate('ABC2026');await wait(page,'invalid');assert.match(await page.locator('#pairing-message').innerText(),/Kode tidak valid/);assert.equal(await page.locator('#pairing-code').inputValue(),'');
    const expired=await issue({codeTtlMs:1000});await new Promise(resolve=>setTimeout(resolve,1100));await activate(expired.code);await wait(page,'invalid');
  });
  let pairedCode,deviceId;
  await t.test('Pairing progress, authorized API roster and key/credential storage survive reload',async()=>{
    await page.evaluate(()=>{window.pairingPhases=[];new MutationObserver(()=>window.pairingPhases.push(document.querySelector('#pairing-root').dataset.phase)).observe(document.querySelector('#pairing-root'),{attributes:true,attributeFilter:['data-phase']});});
    pairedCode=await issue();await activate(pairedCode.code);await wait(page,'active');
    assert.equal(await page.evaluate(()=>window.pairingPhases?.includes('pairing')),true);
    deviceId=(await adapters.root.collection('devices').get()).docs[0].id;
    await page.waitForSelector('.school-card');assert.equal(await page.locator('.school-card').count(),1);assert.equal(await page.locator('[data-action=admin]:visible').count(),0);
    await page.locator('[data-action=select-school][data-id=s1]').click();assert.equal(await page.locator('#service-date-trigger').count(),1);assert.equal(await page.locator('#modal[open]').count(),0);
    await page.locator('[data-action=calendar-toggle]').click();assert.equal(await page.locator('#service-calendar').count(),1);
    await page.locator('[data-action=calendar-date]:not([disabled])').first().click();await page.locator('[data-action=continue-date]').click();
    if(await page.locator('#modal[open]').count())await page.locator('#modal button[type=submit]').click();
    assert.equal(await page.locator('.group-card').count(),1);assert.match(await page.locator('.group-card h3').innerText(),/Hosea Fiktif/);assert.match(await page.locator('.mentor-subtitle').innerText(),/Kak Riwayat Fiktif/);
    await page.locator('[data-action=select-group][data-id=g1]').click();await page.waitForSelector('.student-row');assert.equal(await page.locator('.student-row').count(),1);
    assert.match(await page.locator('.student-name').innerText(),/Siswa Fiktif Snapshot/);assert.equal(await page.locator('[data-action=present], [data-action=finalize], [data-action=add-provisional]').count(),0);
    const security=await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('abc-mentor-device-v1',1);r.onsuccess=()=>resolve(r.result);});
      const record=await new Promise(resolve=>{const r=db.transaction('device').objectStore('device').get('current');r.onsuccess=()=>resolve(r.result);});db.close();
      let exportBlocked=false;try{await crypto.subtle.exportKey('pkcs8',record.privateKey);}catch{exportBlocked=true;}
      return {exportBlocked,privateExtractable:record.privateKey.extractable,aesExtractable:record.wrappingKey.extractable,hasPlaintext:'credential' in record,hasCipher:record.cipher instanceof ArrayBuffer,local:JSON.stringify(localStorage)};
    });
    assert.equal(security.exportBlocked,true);assert.equal(security.privateExtractable,false);assert.equal(security.aesExtractable,false);assert.equal(security.hasPlaintext,false);assert.equal(security.hasCipher,true);assert.equal(security.local.includes(pairedCode.code),false);assert.equal(security.local.includes('privateKey'),false);
    await page.screenshot({path:'screenshots/mentor-roster-mobile.png',fullPage:true});
    await page.reload();await wait(page,'active');await page.waitForSelector('.school-card');assert.equal(await page.locator('.school-card').count(),1);
    await context.setOffline(true);await wait(page,'unavailable');assert.equal(await page.locator('.school-card').count(),0);
    await context.setOffline(false);await wait(page,'active');await page.waitForSelector('.school-card');
    assert.equal(requests.includes('/api/roster'),true);assert.equal(requests.some(p=>p.startsWith('/api/admin')),false);
    await page.setViewportSize({width:1365,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'screenshots/mentor-roster-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
  });
  await t.test('School/group/session scopes and private fields are enforced by the API, with no insecure failure fallback',async()=>{
    const result=await page.evaluate(async({api,scope})=>{
      const {createPairingClient}=await import('/pairing-client.js');const client=createPairingClient(api,()=>{});await client.restore();
      const denied=[];
      for(const change of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'demo-pakel-2026-10-23'}]){try{await client.readRoster({...scope,...change});denied.push(false);}catch(e){denied.push(e.status===403);}}
      const value=await client.readRoster(scope);
      return {denied,keys:Object.keys(value.students[0]).sort(),private:JSON.stringify(value).includes('FIKTIF_PRIVAT')};
    },{api:apiOrigin,scope});
    assert.deepEqual(result.denied,[true,true,true]);assert.deepEqual(result.keys,['id','name','schoolClass']);assert.equal(result.private,false);
    await page.evaluate(()=>localStorage.setItem('abc-school-prototype-v1',JSON.stringify({version:1,authorized:true,students:[{id:'fake',name:'FALLBACK_LOKAL_DILARANG'}],sessions:[],schools:[],groups:[],provisionals:[]})));
    await page.locator('[data-action=select-school][data-id=s1]').click();await page.locator('[data-action=continue-date]').click();
    await page.route('**/api/roster?**',route=>route.fulfill({status:500,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',body:'{"error":"Gagal uji fiktif"}'}));
    await page.locator('[data-action=select-group][data-id=g1]').click();await page.waitForSelector('#secure-mentor[data-state=roster-error]');
    assert.equal(await page.locator('.student-row').count(),0);assert.doesNotMatch(await page.locator('#app').innerText(),/FALLBACK_LOKAL_DILARANG|Siswa Fiktif Snapshot/);
    await page.unroute('**/api/roster?**');await page.route('**/api/roster?**',route=>route.abort('failed'));
    await page.locator('[data-action=secure-retry]').click();await page.waitForSelector('#secure-mentor[data-state=roster-error]');assert.equal(await page.locator('.student-row').count(),0);
    await page.unroute('**/api/roster?**');await page.locator('[data-action=secure-retry]').click();await page.waitForSelector('.student-row');
    await page.route('**/api/roster-context',route=>route.fulfill({status:500,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',body:'{"error":"Gagal metadata fiktif"}'}));
    await page.locator('[data-pairing=refresh]').click();await page.waitForSelector('#secure-mentor[data-state=context-error]');assert.equal(await page.locator('.student-row,.school-card,.group-card').count(),0);
    await page.unroute('**/api/roster-context');await page.locator('[data-action=secure-retry]').click();await page.waitForSelector('.group-card');assert.equal(await page.locator('.student-row').count(),0);
    const batch=await adapters.root.collection('sessions').doc('fictional-batch').get();assert.equal(batch.data().records[0].status,'present');
    assert.equal((await adapters.root.collection('sessions').get()).size,1);
  });
  await t.test('Reused code and requests without proof are rejected; revoked/expired access gates the shell',async()=>{
    const other=await context.newPage();await other.goto(legacyOrigin);assert.equal(await other.locator('#pairing-root').count(),0);await other.close();
    const unauth=await page.evaluate(async api=>(await fetch(api+'/api/device/status',{credentials:'omit'})).status,apiOrigin);assert.equal(unauth,401);
    const adminDenied=await fetch(apiOrigin+'/api/admin/pairing-codes',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(adminDenied.status,401);assert.equal(adminDenied.headers.get('access-control-allow-origin'),null);
    await page.locator('[data-pairing=remove]').click();await wait(page,'inactive');await activate(pairedCode.code);await wait(page,'invalid');
    const next=await issue();await activate(next.code);await wait(page,'active');
    const device=(await adapters.root.collection('pairingCodes').doc(next.pairingId).get()).data().deviceId;
    await adapters.deviceAuthorization.revoke(device);await page.locator('[data-pairing=refresh]').click();await wait(page,'revoked');assert.equal(await page.locator('.school-card').count(),0);
    const short=await issue({grantTtlMs:1000});await activate(short.code);await wait(page,'active');await new Promise(resolve=>setTimeout(resolve,1100));await page.locator('[data-pairing=refresh]').click();await wait(page,'revoked');
  });
  await t.test('Local removal preserves fictional attendance and clears credentials/keys',async()=>{
    const before=await page.evaluate(()=>localStorage.getItem('abc-school-prototype-v1'));
    await page.locator('[data-pairing=remove]').click();await wait(page,'inactive');await page.reload();await wait(page,'inactive');
    assert.equal(await page.evaluate(()=>localStorage.getItem('abc-school-prototype-v1')),before);
    assert.equal((await adapters.root.collection('devices').doc(deviceId).get()).data().state,'active');
    assert.equal(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('abc-mentor-device-v1');r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('device').objectStore('device').count();r.onsuccess=()=>{db.close();resolve(r.result);};});}),0);
  });
  await t.test('Unsupported storage fails closed before a pairing code is consumed',async()=>{
    const isolated=await browser.newContext();await isolated.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));
    const unsupported=await isolated.newPage();await unsupported.goto(origin);await wait(unsupported,'unavailable');
    const unused=await issue();await unsupported.locator('#pairing-code').fill(unused.code);await unsupported.locator('#pairing-form button[type=submit]').click();await wait(unsupported,'invalid');
    assert.equal(await unsupported.locator('.school-card').count(),0);
    assert.equal((await adapters.root.collection('pairingCodes').doc(unused.pairingId).get()).data().state,'pending');await isolated.close();
  });
  await t.test('Each authorized group/session has its own loading, empty and populated API roster',async()=>{
    const empty={...scope,groupId:'g2'},future={...scope,serviceSessionId:'demo-pakel-2026-10-23'},grants=[scope,empty,future];
    await adapters.root.collection('adminPairingPermissions').doc(uid).set({active:true,grants});
    const code=await issue({grants});await activate(code.code);await wait(page,'active');await page.waitForSelector('.school-card');
    await page.locator('[data-action=select-school][data-id=s1]').click();await page.locator('[data-action=continue-date]').click();assert.equal(await page.locator('.group-card').count(),2);
    let resume;
    await page.route('**/api/roster?**',route=>new Promise(resolve=>{resume=async()=>{await route.continue();resolve();};}));
    await page.locator('[data-action=select-group][data-id=g2]').click();await page.waitForSelector('#secure-mentor[data-state=loading-roster]');assert.match(await page.locator('#app').innerText(),/Memuat daftar siswa/);
    await resume();await page.waitForSelector('#secure-mentor[data-state=ready]');assert.match(await page.locator('#app').innerText(),/Belum ada siswa pada kelompok dan pelayanan ini/);assert.equal(await page.locator('.student-row').count(),0);await page.unroute('**/api/roster?**');
    await page.locator('[data-action=back-groups]').click();await page.locator('[data-action=back-dates]').click();await page.locator('[data-action=calendar-toggle]').click();
    await page.locator('[data-action=calendar-date][data-id="2026-10-23"]').click();await page.locator('[data-action=continue-date]').click();
    assert.equal(await page.locator('.group-card').count(),1);assert.match(await page.locator('.mentor-subtitle').innerText(),/Kak Pengganti Fiktif/);
    await page.locator('[data-action=select-group][data-id=g1]').click();await page.waitForSelector('.student-row');assert.equal(await page.locator('.student-row').count(),2);assert.match(await page.locator('#app').innerText(),/Siswa Fiktif Terkini/);assert.doesNotMatch(await page.locator('#app').innerText(),/Siswa Fiktif Snapshot|FALLBACK_LOKAL_DILARANG/);
  });
  assert.deepEqual(errors,[]);assert.equal(logs.some(message=>message.includes(pairedCode.code)),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
