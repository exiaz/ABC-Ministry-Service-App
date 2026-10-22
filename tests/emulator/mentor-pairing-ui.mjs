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
  await mkdir('screenshots',{recursive:true});await page.screenshot({path:'screenshots/mentor-pairing-activation.png',fullPage:true});
  await t.test('Unauthenticated flags cannot unlock the shell; invalid/expired codes are explained',async()=>{
    await page.evaluate(()=>localStorage.setItem('authorized','true'));await page.reload();await wait(page,'inactive');assert.equal(await page.locator('.school-card').count(),0);
    await activate('ABC2026');await wait(page,'invalid');assert.match(await page.locator('#pairing-message').innerText(),/Kode tidak valid/);assert.equal(await page.locator('#pairing-code').inputValue(),'');
    const expired=await issue({codeTtlMs:1000});await new Promise(resolve=>setTimeout(resolve,1100));await activate(expired.code);await wait(page,'invalid');
  });
  let pairedCode,deviceId;
  await t.test('Pairing progress, success, workflow and key/credential storage survive reload',async()=>{
    await page.evaluate(()=>{window.pairingPhases=[];new MutationObserver(()=>window.pairingPhases.push(document.querySelector('#pairing-root').dataset.phase)).observe(document.querySelector('#pairing-root'),{attributes:true,attributeFilter:['data-phase']});});
    pairedCode=await issue();await activate(pairedCode.code);await wait(page,'active');
    assert.equal(await page.evaluate(()=>window.pairingPhases?.includes('pairing')),true);
    deviceId=(await adapters.root.collection('devices').get()).docs[0].id;
    assert.equal(await page.locator('.school-card').count(),3);assert.equal(await page.locator('[data-action=admin]:visible').count(),0);
    await page.locator('[data-action=select-school][data-id=s1]').click();assert.equal(await page.locator('#service-date-trigger').count(),1);assert.equal(await page.locator('#modal[open]').count(),0);
    await page.locator('[data-action=calendar-toggle]').click();assert.equal(await page.locator('#service-calendar').count(),1);
    await page.locator('[data-action=calendar-date]:not([disabled])').first().click();await page.locator('[data-action=continue-date]').click();
    if(await page.locator('#modal[open]').count())await page.locator('#modal button[type=submit]').click();
    await page.locator('[data-action=select-group][data-id=g1]').click();assert.equal(await page.locator('.student-row').count(),12);
    const security=await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('abc-mentor-device-v1',1);r.onsuccess=()=>resolve(r.result);});
      const record=await new Promise(resolve=>{const r=db.transaction('device').objectStore('device').get('current');r.onsuccess=()=>resolve(r.result);});db.close();
      let exportBlocked=false;try{await crypto.subtle.exportKey('pkcs8',record.privateKey);}catch{exportBlocked=true;}
      return {exportBlocked,privateExtractable:record.privateKey.extractable,aesExtractable:record.wrappingKey.extractable,hasPlaintext:'credential' in record,hasCipher:record.cipher instanceof ArrayBuffer,local:JSON.stringify(localStorage)};
    });
    assert.equal(security.exportBlocked,true);assert.equal(security.privateExtractable,false);assert.equal(security.aesExtractable,false);assert.equal(security.hasPlaintext,false);assert.equal(security.hasCipher,true);assert.equal(security.local.includes(pairedCode.code),false);assert.equal(security.local.includes('privateKey'),false);
    await page.reload();await wait(page,'active');assert.equal(await page.locator('#service-date-trigger').count(),1);
    await context.setOffline(true);await wait(page,'unavailable');assert.equal(await page.locator('.school-card').count(),0);
    await context.setOffline(false);await wait(page,'active');
    await page.screenshot({path:'screenshots/mentor-pairing-active.png',fullPage:true});
    assert.equal(requests.includes('/api/roster'),false);assert.equal(requests.some(p=>p.startsWith('/api/admin')),false);
    await page.setViewportSize({width:1365,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'screenshots/mentor-pairing-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
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
  assert.deepEqual(errors,[]);assert.equal(logs.some(message=>message.includes(pairedCode.code)),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
