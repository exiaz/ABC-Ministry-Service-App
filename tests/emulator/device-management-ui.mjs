import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import net from 'node:net';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {deviceManagementFixture,hagai} from './device-management-fixture.mjs';
import {createPrototypeServer} from '../../server.mjs';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('48-hour bulk codes show once on mobile, survive metadata reload, revoke with confirmation and distinguish revoked redemption',{timeout:60000},async t=>{
  const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const mentorOrigin='http://127.0.0.1:'+port,f=await deviceManagementFixture(t,{mentorOrigin}),front=createPrototypeServer({mentorMode:true,apiOrigin:f.mentorBase});front.listen(port,'127.0.0.1');await once(front,'listening');
  await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({date:'2026-10-30'});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(async()=>{await browser.close();await new Promise(resolve=>{front.close(resolve);front.closeAllConnections();});});
  const adminContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'}),mentorContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'}),page=await adminContext.newPage(),mentor=await mentorContext.newPage(),logs=[],errors=[];
  for(const p of [page,mentor]){p.on('console',entry=>logs.push(entry.text()));p.on('pageerror',error=>errors.push(error.name));}
  await page.goto(f.base);await page.locator('#admin-email').fill(f.email);await page.locator('#admin-password').fill(f.password);await page.locator('#admin-login button[type=submit]').click();await page.waitForSelector('#admin-root[data-phase=active]');
  await page.locator('[data-admin-tab=devices]').click();await page.waitForSelector('#admin-devices[data-state=ready]');
  await page.locator('#device-school').selectOption('s1');await page.locator('#device-visit').selectOption(hagai.serviceSessionId);for(const group of ['g13','g1'])await page.locator('[data-device-field=group][value='+group+']').check();
  await page.locator('[data-activation=issue]').click();await page.waitForSelector('#admin-activation[data-state=ready] [data-activation-code]');
  const secrets=await page.locator('[data-activation-code]').allTextContents();const hagaiCode=await page.locator('#admin-activation .device-card').filter({hasText:'Hagai'}).locator('[data-activation-code]').textContent();assert.equal(secrets.length,2);assert.equal(secrets.every(code=>/^[A-Za-z0-9_-]{22}$/.test(code)),true);assert.equal(secrets[0]!==secrets[1],true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert.equal(secrets.some(code=>storage.includes(code)),false);
  await page.locator('[data-activation=hide]').click();assert.equal(await page.locator('[data-activation-code]').count(),0);await page.locator('[data-device=reload]').click();await page.waitForSelector('#admin-devices[data-state=ready]');assert.equal(await page.locator('#admin-activation .device-card').count(),2);assert.equal(await page.locator('[data-activation-code]').count(),0);
  const hagaiCard=page.locator('#admin-activation .device-card').filter({hasText:'Hagai'});await hagaiCard.locator('[data-activation=revoke]').click();await page.locator('dialog[open] button[type=button]').click();assert.equal(await hagaiCard.locator('.badge').textContent(),'Belum dipakai');
  await hagaiCard.locator('[data-activation=revoke]').click();await page.locator('dialog[open] button[type=submit]').click();await page.waitForFunction(()=>[...document.querySelectorAll('#admin-activation .device-card')].some(row=>row.textContent.includes('Hagai')&&row.querySelector('.badge')?.textContent==='Dicabut'));
  await mentor.goto(mentorOrigin);await mentor.waitForSelector('#pairing-form');await mentor.locator('#pairing-code').fill(hagaiCode);const redemption=mentor.waitForResponse(response=>response.url().endsWith('/api/pairing/redeem'));await mentor.locator('#pairing-form button[type=submit]').click();const denied=await redemption;assert.equal(denied.status(),400);assert.equal((await denied.json()).codeState,'revoked');await mentor.waitForSelector('#pairing-root[data-phase=invalid]');assert.equal((await mentor.locator('#pairing-message').textContent()).includes('Kode telah dicabut'),true);
  assert.equal((await f.root.collection('devices').get()).size,0);
  await page.locator('#device-school').selectOption('s1');await page.locator('#device-visit').selectOption(hagai.serviceSessionId);await page.locator('[data-device-field=group][value=g13]').check();await page.locator('[data-activation=issue]').click();await page.waitForSelector('[data-activation-code]');const activeCode=await page.locator('#admin-activation .device-card').filter({has:page.locator('[data-activation-code]')}).filter({hasText:'Hagai'}).locator('[data-activation-code]').textContent();secrets.push(activeCode);await page.locator('[data-activation=hide]').click();
  await mentor.locator('#pairing-code').fill(activeCode);await mentor.locator('#pairing-form button[type=submit]').click();await mentor.waitForSelector('#pairing-root[data-phase=active]');await mentor.waitForSelector('.student-row');assert.match(await mentor.locator('.heading').innerText(),/Kak Louis/);assert.equal(await mentor.locator('.school-card,.group-card,[data-action=continue-date]').count(),0);await mentor.reload();await mentor.waitForSelector('.student-row');assert.match(await mentor.locator('.student-row').innerText(),/Siswa Hagai Fiktif/);
  assert.equal((await f.root.collection('devices').get()).size,1);assert.equal(secrets.some(code=>logs.some(line=>line.includes(code))),false);assert.deepEqual(errors,[]);
  await mkdir('screenshots',{recursive:true});await page.screenshot({path:'screenshots/activation-48h-mobile.png',fullPage:true});await page.setViewportSize({width:1365,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'screenshots/activation-48h-desktop.png',fullPage:true});
});
test('Admin device management and secure mentor pairing in isolated Chrome',{timeout:150000},async t=>{
  const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const mentorOrigin='http://127.0.0.1:'+port,f=await deviceManagementFixture(t,{mentorOrigin}),front=createPrototypeServer({mentorMode:true,apiOrigin:f.mentorBase});front.listen(port,'127.0.0.1');await once(front,'listening');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(async()=>{await browser.close();await new Promise(resolve=>{front.close(resolve);front.closeAllConnections();});});
  const adminContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),mentorContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'});
  const page=await adminContext.newPage(),mentor=await mentorContext.newPage(),errors=[],logs=[],secrets=[];
  for(const p of [page,mentor]){p.on('pageerror',e=>errors.push(e.name));p.on('console',m=>logs.push(m.text()));}
  const active=()=>page.waitForSelector('#admin-root[data-phase=active]'),ready=async()=>{try{await page.waitForSelector('#admin-devices[data-state=ready]');}catch(error){console.log('Device panel state:',await page.locator('#admin-devices').getAttribute('data-state'));console.log('Admin API failures:',apiFailures);throw error;}};
  const apiFailures=[];page.on('response',response=>{if(response.url().includes('/api/admin/')&&response.status()>=400)apiFailures.push({path:new URL(response.url()).pathname,status:response.status()});});
  const login=async()=>{await page.locator('#admin-email').fill(f.email);await page.locator('#admin-password').fill(f.password);await page.locator('#admin-login button[type=submit]').click();await active();};
  const open=async()=>{await page.locator('[data-admin-tab=devices]').click();await ready();};
  const select=async()=>{await page.locator('#device-school').selectOption('s1');await page.locator('#device-visit').selectOption(hagai.serviceSessionId);await page.locator('[data-device-field=group][value=g13]').check();};
  await page.goto(f.base);await login();await open();
  let code,deviceId;
  await t.test('Authorized choices show canonical groups/mentors; issuance waits for success and exposes the code only once',async()=>{
    assert.equal(await page.locator('#device-school option').count(),4);await select();assert.equal(await page.locator('[data-device-field=group]').count(),8);
    const group=page.locator('label').filter({has:page.locator('[data-device-field=group][value=g13]')});assert.match(await group.innerText(),/Hagai/);assert.match(await group.locator('.mentor-subtitle').innerText(),/Kak Louis/);
    let resume;let count=0;
    await page.route('**/api/admin/pairing-codes',async route=>{count++;await new Promise(resolve=>{resume=async()=>{await route.continue();resolve();};});});
    await page.locator('#device-issue-form button[type=submit]').evaluate(b=>{b.click();b.click();});await page.waitForSelector('#admin-devices[data-state=issuing]');assert.equal(await page.locator('#pairing-code-once').count(),0);
    for(let n=0;n<100&&!resume;n++)await page.waitForTimeout(25);assert.equal(typeof resume,'function');await resume();await page.waitForSelector('#pairing-code-once');assert.equal(count,1);await page.unroute('**/api/admin/pairing-codes');
    code=await page.locator('#pairing-code-once').innerText();secrets.push(code);assert.equal(/^[A-Za-z0-9_-]{22}$/.test(code),true);
    const storage=await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage}));assert.equal(storage.includes(code),false);
    const stored=(await f.root.collection('pairingCodes').get()).docs[0].data();assert.deepEqual(stored.grants,[hagai]);assert.equal(JSON.stringify(stored).includes(code),false);
    await page.locator('[data-device=hide-code]').click();assert.equal(await page.locator('#pairing-code-once').count(),0);await page.locator('[data-device-field=group][value=g13]').uncheck();assert.equal(await page.locator('#pairing-code-once').count(),0);
  });
  await t.test('The issued code activates the existing secure mentor UI and appears as a scoped device without raw secrets',async()=>{
    await mentor.goto(mentorOrigin);await mentor.waitForSelector('#pairing-root[data-phase=inactive]');await mentor.locator('#pairing-code').fill(code);await mentor.locator('#pairing-form button[type=submit]').click();await mentor.waitForSelector('#pairing-root[data-phase=active]');await mentor.waitForSelector('.school-card');
    await mentor.locator('[data-action=select-school][data-id=s1]').click();await mentor.locator('[data-action=continue-date]').click();assert.equal(await mentor.locator('.group-card').count(),1);assert.match(await mentor.locator('.group-card').innerText(),/Hagai/);assert.match(await mentor.locator('.mentor-subtitle').innerText(),/Kak Louis/);
    await mentor.locator('[data-action=select-group][data-id=g13]').click();await mentor.waitForSelector('.student-row');assert.match(await mentor.locator('.student-row').innerText(),/Siswa Hagai Fiktif/);
    await page.locator('[data-device=reload]').click();await ready();await page.waitForSelector('.device-card');assert.equal(await page.locator('.device-card').count(),1);assert.equal(await page.locator('#pairing-code-once').count(),0);
    assert.doesNotMatch(await page.locator('.device-card').innerText(),/PRIVAT_DILARANG|publicKey|credential/);assert.equal((await page.locator('.device-card').innerText()).includes(code),false);assert.match(await page.locator('.device-card').innerText(),/Akses berakhir|Jejak terakhir/);
    deviceId=(await f.root.collection('devices').get()).docs[0].id;
    await mkdir('screenshots',{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'screenshots/admin-devices-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1365,height:900});await page.screenshot({path:'screenshots/admin-devices-desktop.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:390,height:844});
  });
  await t.test('Revocation requires confirmation, updates audit/status and immediately denies the mentor on its next request',async()=>{
    await page.locator('[data-device=revoke]').click();await page.waitForSelector('#admin-device-dialog[open]');await page.locator('#device-confirm-cancel').click();assert.equal((await f.root.collection('devices').doc(deviceId).get()).data().state,'active');
    await page.locator('[data-device=revoke]').click();await page.locator('#device-confirm button[type=submit]').click();await ready();assert.match(await page.locator('.device-card .badge').innerText(),/Dicabut/);assert.equal(await page.locator('[data-device=revoke]').isDisabled(),true);
    await mentor.locator('[data-pairing=refresh]').click();await mentor.waitForSelector('#pairing-root[data-phase=revoked]');assert.equal(await mentor.locator('.student-row,.school-card').count(),0);
    assert.equal((await f.root.collection('sessions').get()).size,0);
  });
  await t.test('Lost issuance response retries the same key, never creates/reveals a second code and offers explicit cancellation',async()=>{
    await select();const before=(await f.root.collection('pairingCodes').get()).size;let firstKey;
    await page.route('**/api/admin/pairing-codes',async route=>{
      firstKey=route.request().postDataJSON().idempotencyKey;const committed=await route.fetch();assert.equal(committed.status(),201);secrets.push((await committed.json()).code);await route.abort();
    });
    await page.locator('#device-issue-form button[type=submit]').click();await page.waitForSelector('[data-device=retry-issue]');await page.unroute('**/api/admin/pairing-codes');
    let retriedKey;const inspect=request=>{if(request.url().endsWith('/api/admin/pairing-codes'))retriedKey=request.postDataJSON().idempotencyKey;};page.on('request',inspect);
    await page.locator('[data-device=retry-issue]').click();await ready();page.off('request',inspect);
    assert.equal(firstKey===retriedKey,true);assert.equal((await f.root.collection('pairingCodes').get()).size,before+1);assert.equal(await page.locator('#pairing-code-once').count(),0);
    assert.match(await page.locator('#admin-devices').innerText(),/kode tidak ditampilkan ulang/);assert.equal(await page.locator('#device-issue-form button[type=submit]').isDisabled(),true);
    await page.locator('[data-device=cancel-code]').click();await page.locator('#device-confirm button[type=submit]').click();await ready();
    assert.match(await page.locator('#admin-devices').innerText(),/Kode dibatalkan oleh server/);
  });
  await t.test('API failure clears data without false success; logout and session expiry remove codes and device access',async()=>{
    await page.route('**/api/admin/devices',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Gagal fiktif"}'}));await page.locator('[data-device=reload]').click();await page.waitForSelector('#admin-devices[data-state=error]');assert.equal(await page.locator('.device-card').count(),0);await page.unroute('**/api/admin/devices');await page.locator('[data-device=reload]').click();await ready();
    await select();await page.locator('#device-issue-form button[type=submit]').click();await page.waitForSelector('#pairing-code-once');secrets.push(await page.locator('#pairing-code-once').innerText());
    await page.locator('[data-admin=logout]').click();await page.waitForSelector('#admin-root[data-phase=signed-out]');assert.equal(await page.locator('#pairing-code-once,.device-card').count(),0);
    await login();await open();assert.equal(await page.locator('#pairing-code-once').count(),0);
    const now=Date.now;try{Date.now=()=>now()+3700000;await page.locator('[data-admin=verify]').click();await page.waitForSelector('#admin-root[data-phase=expired]');}finally{Date.now=now;}
    assert.equal(await page.locator('#pairing-code-once,.device-card,.admin-tabs').count(),0);
  });
  assert.deepEqual(errors,[]);assert.equal(logs.some(line=>secrets.some(s=>line.includes(s))||line.includes(f.password)),false);
});
