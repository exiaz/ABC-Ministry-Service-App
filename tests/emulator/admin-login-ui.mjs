import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {adminLoginFixture} from './admin-login-fixture.mjs';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
test('Admin login UI in isolated Chrome and real Auth Emulator',{timeout:120000},async t=>{
  const f=await adminLoginFixture(t),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),page=await context.newPage(),errors=[],secretLeaks=[];
  page.on('pageerror',e=>errors.push(e.name));page.on('console',message=>{if(message.text().includes(f.password))secretLeaks.push(true);});
  const wait=phase=>page.waitForSelector('#admin-root[data-phase='+phase+']');
  const login=async(email=f.email,password=f.password)=>{await page.locator('#admin-email').fill(email);await page.locator('#admin-password').fill(password);await page.locator('#admin-login button[type=submit]').click();};
  await page.goto(f.base);await wait('signed-out');
  const decoy=JSON.stringify({adminUnlocked:true,authorized:true,students:[{id:'fake',name:'FALLBACK_DILARANG',guardianName:'PRIVAT_DILARANG'}]});
  await page.evaluate(value=>{localStorage.setItem('abc-school-prototype-v1',value);localStorage.setItem('adminUnlocked','true');},decoy);await page.reload();await wait('signed-out');assert.equal(await page.locator('.admin-tabs').count(),0);
  await t.test('Invalid credentials and a real unauthorized UID cannot receive a dashboard or admin-only data',async()=>{
    await login(f.email,'fictional-wrong');await wait('invalid');assert.equal(await page.locator('#admin-password').inputValue(),'');assert.equal(await page.locator('.admin-tabs').count(),0);
    await login(f.otherEmail);await wait('invalid');assert.equal(await page.locator('.admin-tabs').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/FALLBACK_DILARANG|PRIVAT_DILARANG|ABC2026/);
    const r=await page.evaluate(async()=>{const r=await fetch('/api/admin/session',{headers:{'X-Admin':'true','X-Demo-Code':'ABC2026'}});return {status:r.status,body:await r.json()};});assert.equal(r.status,401);assert.equal(r.body.uid,undefined);
  });
  await t.test('Valid login waits for protected verification, retains navigation and keeps tokens out of browser storage',async()=>{
    let resume;
    await page.route('**/api/admin/session',route=>new Promise(resolve=>{resume=async()=>{await route.continue();resolve();};}));
    await login();await page.waitForFunction(()=>document.querySelector('#admin-root').dataset.phase==='loading');await page.waitForFunction(()=>document.querySelector('#admin-password')?.disabled===true);
    assert.equal(await page.locator('.admin-tabs').count(),0);
    // Wait for the request interception, not merely the loading render.
    for(let n=0;n<100&&!resume;n++)await page.waitForTimeout(25);
    assert.equal(typeof resume,'function');await resume();await wait('active');await page.unroute('**/api/admin/session');
    assert.equal(await page.locator('.admin-tabs button').count(),7);
    for(const tab of ['history','schedule','students','groups','birthdays','overview']){await page.locator('[data-admin-tab='+tab+']').last().click();await wait('active');assert.equal(await page.locator('.admin-tabs [aria-current=page]').getAttribute('data-admin-tab'),tab);}
    const storage=await page.evaluate(()=>({local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)}));
    assert.equal(storage.local.includes(f.password),false);assert.equal(storage.local.includes('Bearer'),false);assert.equal(storage.session,'{}');assert.equal(await page.locator('.panel-head button').isDisabled(),true);
    await mkdir('screenshots',{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'screenshots/admin-auth-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1365,height:900});await page.screenshot({path:'screenshots/admin-auth-desktop.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:390,height:844});
  });
  await t.test('Network failure gates the dashboard, logout failure blocks access, and a retry confirms server revocation',async()=>{
    await page.route('**/api/admin/session',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Gagal fiktif"}'}));await page.locator('[data-admin=verify]').click();await wait('error');assert.equal(await page.locator('.admin-tabs').count(),0);
    await page.unroute('**/api/admin/session');await page.locator('[data-admin=verify]').click();await wait('active');
    await page.route('**/api/admin/logout',route=>route.abort('failed'));await page.locator('[data-admin=logout]').click();await wait('logout-error');assert.equal(await page.locator('#admin-login,.admin-tabs').count(),0);assert.match(await page.locator('#admin-message').innerText(),/belum terkonfirmasi/);
    await page.unroute('**/api/admin/logout');await page.locator('[data-admin=logout]').click();await wait('signed-out');await page.reload();await wait('signed-out');
    assert.equal(await page.evaluate(()=>localStorage.getItem('abc-school-prototype-v1')),decoy);
  });
  await t.test('Disabled/revoked authorization gates an active dashboard; API failure never falls back to a demo',async()=>{
    await login();await wait('active');await f.auth.updateUser(f.uid,{disabled:true});await page.locator('[data-admin=verify]').click();await wait('expired');assert.equal(await page.locator('.admin-tabs').count(),0);await f.auth.updateUser(f.uid,{disabled:false});
    await page.route('**/api/admin/login',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Gagal fiktif"}'}));await login();await wait('error');assert.equal(await page.locator('.admin-tabs').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/FALLBACK_DILARANG|PRIVAT_DILARANG/);await page.unroute('**/api/admin/login');
  });
  assert.deepEqual(errors,[]);assert.deepEqual(secretLeaks,[]);
});
