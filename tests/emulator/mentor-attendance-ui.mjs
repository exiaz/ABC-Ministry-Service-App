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
const future={...scope,serviceSessionId:'demo-pakel-2026-10-23'},groupTwo={...scope,groupId:'g2'},grants=[scope,future,groupTwo];
async function listen(server,port=0){server.listen(port,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function stop(server){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}

test('Secure mentor attendance in real Chrome with paired device and Firestore Emulator',{timeout:180000},async t=>{
  const source=fictionalRosterData();source.sessions=[];
  source.students.push({id:'fictional-group-two',name:'Siswa Kelompok Dua Fiktif',schoolClass:'3A',schoolId:'s1',groupId:'g2',active:true});
  const adapters=await emulatorFixture({source});
  const previous=process.env.ABC_ADMIN_UIDS,uid='fictional-attendance-ui-'+randomUUID();process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  const app=initializeApp({projectId:adapters.config.projectId},'attendance-ui-'+randomUUID()),auth=getAuth(app),email=uid+'@example.invalid',password=randomBytes(32).toString('base64url');
  await auth.createUser({uid,email,password});
  const adminAuthentication=await createLocalAdminAuthentication(),adminToken=await adminAuthentication.signIn({email,password});
  await adapters.root.collection('adminPairingPermissions').doc(uid).set({active:true,grants});
  const reserve=net.createServer();await listen(reserve);const frontPort=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const origin='http://127.0.0.1:'+frontPort,api=createRosterServer({...adapters,adminAuthentication,mentorOrigin:origin}),apiOrigin=await listen(api);
  const frontend=createPrototypeServer({mentorMode:true,apiOrigin});await listen(frontend,frontPort);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  t.after(async()=>{await browser.close();await stop(frontend);await stop(api);await adminAuthentication.close();await auth.deleteUser(uid);await deleteApp(app);await adapters.close();if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;});
  const active=()=>page.waitForSelector('#pairing-root[data-phase=active]');
  const status=phase=>page.waitForSelector('#attendance-status[data-state='+phase+']');
  const row=id=>page.locator('.student-row').filter({has:page.locator('[data-secure-status-id="'+id+'"]')});
  const saved=async()=>{await status('saved');assert.match(await page.locator('#attendance-status').innerText(),/Tersimpan di server/);};
  const choose=async(s=scope)=>{
    await page.waitForSelector('.school-card');await page.locator('[data-action=select-school][data-id=s1]').click();
    await page.locator('[data-action=calendar-toggle]').click();
    await page.locator('[data-action=calendar-date][data-id="'+(s.serviceSessionId===future.serviceSessionId?'2026-10-23':'2026-10-09')+'"]').click();
    await page.locator('[data-action=continue-date]').click();await page.locator('[data-action=select-group][data-id='+s.groupId+']').click();await status('ready');
  };
  const mark=async(id,value)=>{await page.locator('[data-secure-status-id="'+id+'"]').selectOption(value);await saved();};
  const batch=async(s=scope)=>(await adapters.root.collection('sessions').where('serviceSessionId','==',s.serviceSessionId).where('groupId','==',s.groupId).get()).docs[0]?.data();
  const count=async name=>(await adapters.root.collection(name).get()).size;
  const external=async(s,records)=>page.evaluate(async({api,s,records})=>{
    const {createPairingClient}=await import('/pairing-client.js'),client=createPairingClient(api,()=>{});await client.restore();
    const value=await client.readAttendance(s);return client.saveAttendance(s,{expectedRevision:value.revision,idempotencyKey:crypto.randomUUID(),records});
  },{api:apiOrigin,s,records});
  const issue=async(options={})=>{
    const response=await fetch(apiOrigin+'/api/admin/pairing-codes',{method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify({grants,idempotencyKey:randomUUID(),...options})});assert.equal(response.status,201);return response.json();
  };
  const activate=async code=>{await page.locator('#pairing-code').fill(code);await page.locator('#pairing-form button[type=submit]').click();await active();};
  await page.goto(origin);await page.waitForSelector('#pairing-root[data-phase=inactive]');
  const decoy='{"authorized":true,"students":[{"id":"fake","name":"FALLBACK_DILARANG"}]}';
  await page.evaluate(value=>localStorage.setItem('abc-school-prototype-v1',value),decoy);
  const code=await issue();await activate(code.code);await choose();

  await t.test('Incomplete review cannot finalize; saving is confirmed before changing rows and blocks duplicate clicks',async()=>{
    assert.equal(await page.locator('.student-row').count(),2);assert.equal(await count('sessions'),0);
    await page.locator('[data-action=secure-review]').click();assert.equal(await page.locator('#modal button[type=submit]').isDisabled(),true);assert.match(await page.locator('#modal').innerText(),/Tidak ada perubahan otomatis/);
    await page.locator('#modal .btn[data-action=close-modal]').click();assert.equal(await count('sessions'),0);
    let resume;const writes=[];
    await page.route('**/api/attendance?**',async route=>{
      if(route.request().method()!=='PUT'){await route.continue();return;}
      writes.push(route.request().postDataJSON());await new Promise(resolve=>{resume=async()=>{await route.continue();resolve();};});
    });
    await row('fictional-1').locator('[data-action=secure-present]').evaluate(b=>{b.click();b.click();});await status('saving');
    assert.match(await row('fictional-1').innerText(),/Belum Diabsen/);assert.equal(await row('fictional-1').locator('select').isDisabled(),true);assert.equal(await page.locator('.success-panel').count(),0);
    await resume();await saved();await page.unroute('**/api/attendance?**');
    assert.equal(writes.length,1);assert.equal((await batch()).revision,1);assert.deepEqual((await batch()).records.map(r=>r.status),['present','unmarked']);
    await mark('fictional-2','excused');await mark('fictional-2','absent');await mark('fictional-2','unmarked');
    await page.locator('[data-action=secure-review]').click();assert.equal(await page.locator('#modal button[type=submit]').isDisabled(),true);await page.locator('#modal .btn[data-action=close-modal]').click();
    await mark('fictional-2','excused');
    await mkdir('screenshots',{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'screenshots/mentor-attendance-draft-mobile.png',fullPage:true});
  });
  await t.test('Reload restores server statuses; complete review, cancel, finalization and correction preserve history',async()=>{
    const before=(await batch()).revision;await page.reload();await active();await choose();assert.equal((await batch()).revision,before);
    assert.match(await row('fictional-1').innerText(),/Hadir/);assert.match(await row('fictional-2').innerText(),/Izin/);
    await page.locator('[data-action=secure-review]').click();await page.locator('#modal .btn[data-action=close-modal]').click();assert.equal((await batch()).state,'draft');
    let confirm,intercept;let submissions=0;
    const intercepted=new Promise(resolve=>{intercept=resolve;});
    await page.route('**/api/attendance/finalize?**',async route=>{submissions++;await new Promise(resolve=>{confirm=async()=>{await route.continue();resolve();};intercept();});});
    await page.locator('[data-action=secure-review]').click();await page.locator('#modal button[type=submit]').evaluate(b=>{b.click();b.click();});await status('saving');assert.equal(await page.locator('.success-panel').count(),0);assert.equal((await batch()).state,'draft');
    await intercepted;assert.equal(typeof confirm,'function');await confirm();await saved();await page.unroute('**/api/attendance/finalize?**');await page.waitForSelector('.success-panel');assert.equal(submissions,1);assert.equal((await batch()).state,'completed');assert.equal((await batch()).revision,before+1);
    await page.locator('[data-action=secure-correct]').click();await page.locator('#correction-student').selectOption('fictional-1');await page.locator('#correction-status').selectOption('absent');await page.locator('#correction-reason').fill('Koreksi fiktif setelah tinjauan mentor');await page.locator('#modal button[type=submit]').click();await saved();
    assert.equal((await batch()).state,'draft');assert.equal((await batch()).records[0].status,'absent');assert.equal(await page.locator('.success-panel').count(),0);
    await page.locator('[data-action=secure-review]').click();await page.locator('#modal button[type=submit]').click();await saved();assert.equal((await batch()).state,'completed');
    const history=(await adapters.root.collection('attendanceHistory').where('batchId','==',(await batch()).id).get()).docs.map(d=>d.data()).sort((a,b)=>a.revision-b.revision);
    assert.ok(history.some(h=>h.action==='correct'&&h.reason==='Koreksi fiktif setelah tinjauan mentor'));assert.equal(history.at(-3).snapshot.records[0].status,'present');assert.equal(history.at(-1).snapshot.records[0].status,'absent');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'screenshots/mentor-attendance-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1365,height:900});await page.screenshot({path:'screenshots/mentor-attendance-desktop.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:390,height:844});
  });
  await t.test('Different Fridays and concurrent revisions stay isolated, conflicts never overwrite the server',async()=>{
    const prior=await batch();await page.reload();await active();await choose(future);assert.deepEqual((await page.locator('.student-row small').allTextContents()).map(s=>s.includes('Belum Diabsen')),[true,true]);
    await mark('fictional-1','present');const first=await batch(future);assert.notEqual(first.id,prior.id);assert.deepEqual(await batch(),prior);
    await external(future,[{studentId:'fictional-1',status:'excused'}]);
    await page.locator('[data-secure-status-id=fictional-1]').selectOption('absent');await status('conflict');assert.equal((await batch(future)).records[0].status,'excused');assert.equal(await page.locator('[data-secure-status-id=fictional-1]').isDisabled(),true);assert.equal(await page.locator('[data-action=attendance-retry]').count(),0);
    await page.locator('[data-action=attendance-reload]').click();await status('ready');assert.match(await row('fictional-1').innerText(),/Izin/);
    await page.locator('[data-action=secure-review]').click();assert.equal(await page.locator('#modal button[type=submit]').isDisabled(),true);await page.locator('#modal .btn[data-action=close-modal]').click();
  });
  await t.test('Lost commit responses retry the same idempotency key; API failure cannot claim saved or fall back',async()=>{
    const keys=[],nonces=[];const before=(await batch(future)).revision;
    await page.route('**/api/attendance?**',async route=>{
      if(route.request().method()!=='PUT'){await route.continue();return;}
      keys.push(route.request().postDataJSON().idempotencyKey);nonces.push(route.request().headers()['x-device-nonce']);await route.fetch();await route.abort('failed');
    });
    await page.locator('[data-secure-status-id=fictional-2]').selectOption('absent');await status('error');assert.equal((await batch(future)).revision,before+1);assert.match(await row('fictional-2').innerText(),/Belum Diabsen/);assert.doesNotMatch(await page.locator('#attendance-status').innerText(),/Tersimpan di server/);
    await page.unroute('**/api/attendance?**');await page.route('**/api/attendance?**',async route=>{if(route.request().method()==='PUT'){keys.push(route.request().postDataJSON().idempotencyKey);nonces.push(route.request().headers()['x-device-nonce']);}await route.continue();});
    await page.locator('[data-action=attendance-retry]').click();await saved();await page.unroute('**/api/attendance?**');assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.notEqual(nonces[0],nonces[1]);assert.equal((await batch(future)).revision,before+1);
    await page.route('**/api/attendance?**',async route=>route.request().method()==='PUT'?route.fulfill({status:500,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',body:'{"error":"Gagal fiktif"}'}):route.continue());
    await page.locator('[data-secure-status-id=fictional-2]').selectOption('present');await status('error');assert.equal((await batch(future)).revision,before+1);assert.equal(await page.locator('.success-panel').count(),0);
    await page.unroute('**/api/attendance?**');await page.locator('[data-action=attendance-retry]').click();await saved();
    await page.route('**/api/attendance?**',route=>route.fulfill({status:500,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',body:'{"error":"Gagal fiktif"}'}));
    await page.locator('[data-action=attendance-reload]').click();await page.waitForSelector('#secure-mentor[data-state=roster-error]');assert.equal(await page.locator('.student-row').count(),0);assert.doesNotMatch(await page.locator('#app').innerText(),/FALLBACK_DILARANG|Tersimpan di server/);
    await page.unroute('**/api/attendance?**');await page.locator('[data-action=secure-retry]').click();await status('ready');
  });
  await t.test('Late saves after switching groups cannot overwrite the new selection',async()=>{
    let resume;
    await page.route('**/api/attendance?**',async route=>{if(route.request().method()!=='PUT'){await route.continue();return;}await new Promise(resolve=>{resume=async()=>{await route.continue();resolve();};});});
    await page.locator('[data-secure-status-id=fictional-1]').selectOption('present');await status('saving');
    await page.locator('[data-action=back-groups]').click();await page.locator('[data-action=back-dates]').click();await page.locator('[data-action=calendar-toggle]').click();await page.locator('[data-action=calendar-date][data-id="2026-10-09"]').click();await page.locator('[data-action=continue-date]').click();await page.locator('[data-action=select-group][data-id=g2]').click();await status('ready');
    await resume();await page.unroute('**/api/attendance?**');assert.match(await page.locator('#app').innerText(),/Siswa Kelompok Dua Fiktif/);assert.equal(await page.locator('.student-row').count(),1);assert.equal(await batch(groupTwo),undefined);
    await mark('fictional-group-two','present');assert.equal((await batch(groupTwo)).records[0].studentId,'fictional-group-two');assert.equal((await batch(future)).records.length,2);
  });
  await t.test('Unauthorized, revoked and expired requests close access without a local fallback',async()=>{
    const denied=await page.evaluate(async({api,scope})=>{
      const {createPairingClient}=await import('/pairing-client.js'),client=createPairingClient(api,()=>{});await client.restore();
      const statuses=[];for(const s of [{...scope,schoolId:'s2'},{...scope,groupId:'g4'},{...scope,serviceSessionId:'unknown'}]){try{await client.readAttendance(s);}catch(e){statuses.push(e.status);}try{await client.saveAttendance(s,{expectedRevision:0,idempotencyKey:crypto.randomUUID(),records:[{studentId:'fictional-1',status:'present'}]});}catch(e){statuses.push(e.status);}}
      return statuses;
    },{api:apiOrigin,scope});assert.deepEqual(denied,[403,403,403,403,403,403]);
    const before=await count('attendanceHistory'),device=(await adapters.root.collection('pairingCodes').doc(code.pairingId).get()).data().deviceId;
    await adapters.deviceAuthorization.revoke(device);await page.locator('[data-secure-status-id=fictional-group-two]').selectOption('absent');await page.waitForSelector('#pairing-root[data-phase=revoked]');assert.equal(await page.locator('.student-row').count(),0);assert.equal(await count('attendanceHistory'),before);
    await page.locator('[data-pairing=remove]').click();await page.waitForSelector('#pairing-root[data-phase=inactive]');const short=await issue({grantTtlMs:2000});await activate(short.code);await page.waitForSelector('.school-card');
    await page.waitForTimeout(2100);await page.locator('[data-pairing=refresh]').click();await page.waitForSelector('#pairing-root[data-phase=revoked]');assert.equal(await page.locator('.school-card,.student-row').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('abc-school-prototype-v1')),decoy);
  });
  assert.deepEqual(errors,[]);
});
