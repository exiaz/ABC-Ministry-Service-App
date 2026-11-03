import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {mentorAccountFixture} from './msa-a2-3-fixture.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Mentor persistent cookie survives browser restart; offline state hides private UI and logout invalidates it',{timeout:180000},async t=>{
  const prior=process.env.ABC_MSA_SESSION_1A;process.env.ABC_MSA_SESSION_1A='1';t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  const f=await mentorAccountFixture(t),u=await f.account(),dir=path.resolve('mentor-session-profile');await mkdir(dir,{recursive:true});
  let context;
  const start=()=>chromium.launchPersistentContext(dir,{headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:900}});
  try{
    context=await start();let page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Session page error:',e.message);});page.on('requestfailed',r=>console.log('Session request failed:',new URL(r.url()).pathname,r.failure()?.errorText));
    let release;const hold=new Promise(resolve=>{release=resolve;});await page.route('**/api/mentor-session/restore',async r=>{await hold;await r.continue();});await page.goto(f.mentorBase+'/mentor-account.html');assert.equal(await page.locator('#account-session-check').isVisible(),true);assert.equal(await page.locator('#account-login').isVisible(),false);assert.equal(await page.locator('#account-profile').isVisible(),false);release();await page.locator('#account-login:not([hidden])').waitFor();await page.unroute('**/api/mentor-session/restore');
    for(const width of [390,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.resolve('mentor-login-'+width+'.png'),fullPage:true});}
    let accessToken,renewStarted,releaseRenewal;const renewing=new Promise(resolve=>{renewStarted=resolve;}),renewHold=new Promise(resolve=>{releaseRenewal=resolve;});await page.route('**/api/mentor-session/restore',async route=>{if(route.request().method()==='POST'){renewStarted();await renewHold;}await route.continue();});await page.route('**/api/mentor-session/login',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch(),value=await response.json();accessToken=value.token;await route.fulfill({response,json:{...value,accessExpiresAt:Date.now()+10000}});});
    const renewal=page.waitForResponse(response=>response.url().endsWith('/api/mentor-session/restore')&&response.status()===200);
    await page.locator('#account-username').fill(u.username);await page.locator('#account-password').fill(u.password);await page.locator('#account-remember').check();await page.locator('#account-login-form button[type=submit]').click();await page.locator('#account-profile:not([hidden])').waitFor();await renewing;await page.locator('#account-code').fill('kode-fiktif');assert.equal(await page.locator('#account-profile').isVisible(),true);releaseRenewal();await renewal;await page.locator('#account-profile:not([hidden])').waitFor();assert.equal(await page.locator('#account-code').inputValue(),'kode-fiktif');await page.unroute('**/api/mentor-session/restore');await page.unroute('**/api/mentor-session/login');
    const cookies=await context.cookies();const session=cookies.find(c=>c.name.startsWith('msa_mentor_'));assert.ok(session?.httpOnly);assert.equal(session.sameSite,'Strict');assert.equal(session.path,'/api/mentor-session/');assert.ok(session.expires>Date.now()/1000+29*86400);const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},cookie:document.cookie}));assert.ok(!storage.includes(u.password));assert.ok(!storage.includes(session.value));assert.ok(accessToken&&!storage.includes(accessToken));
    for(const width of [390,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.resolve('mentor-session-'+width+'.png'),fullPage:true});}
    await context.close();context=await start();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.mentorBase+'/mentor-account.html');await page.locator('#account-profile:not([hidden])').waitFor();assert.equal(await page.locator('#account-name').textContent(),u.fullName);
    await page.route('**/api/mentor-session/restore',r=>r.abort());await page.reload();await page.locator('#account-session-retry:not([hidden])').waitFor();assert.equal(await page.locator('#account-profile').isVisible(),false);assert.equal(await page.locator('#account-login').isVisible(),false);
    await page.unroute('**/api/mentor-session/restore');await page.locator('#account-session-retry').click();await page.locator('#account-profile:not([hidden])').waitFor();
    await page.locator('#account-logout').click();await page.locator('#account-login:not([hidden])').waitFor();await page.reload();await page.locator('#account-login:not([hidden])').waitFor();assert.equal(await page.locator('#account-profile').isVisible(),false);
    await page.locator('#account-username').fill(u.username);await page.locator('#account-password').fill(u.password);await page.locator('#account-remember').check();await page.locator('#account-login-form button[type=submit]').click();await page.locator('#account-code').waitFor();await f.root.collection('msaAccounts').doc(u.uid).update({state:'suspended'});await page.locator('[data-account-action=verify]').click();await page.locator('#account-login:not([hidden])').waitFor();assert.equal(await page.locator('#account-name').textContent(),'');assert.equal(await page.locator('#account-groups').textContent(),'');assert.deepEqual(errors,[]);
  }finally{await context?.close();}
});

test('Mentor private UI clears if access expires while renewal is stalled',{timeout:180000},async t=>{
  const prior=process.env.ABC_MSA_SESSION_1A;process.env.ABC_MSA_SESSION_1A='1';t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  const f=await mentorAccountFixture(t),u=await f.account(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage();await page.goto(f.mentorBase+'/mentor-account.html');await page.locator('#account-login:not([hidden])').waitFor();
    let release;const hold=new Promise(resolve=>{release=resolve;});await page.route('**/api/mentor-session/restore',async route=>{if(route.request().method()==='POST')await hold;await route.continue();});
    await page.route('**/api/mentor-session/login',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch(),value=await response.json();await route.fulfill({response,json:{...value,accessExpiresAt:Date.now()+2500}});});
    await page.locator('#account-username').fill(u.username);await page.locator('#account-password').fill(u.password);await page.locator('#account-remember').check();await page.locator('#account-login-form button[type=submit]').click();await page.locator('#account-profile:not([hidden])').waitFor();
    const late=page.waitForResponse(response=>response.url().endsWith('/api/mentor-session/restore')&&response.status()===200);await page.locator('#account-session-retry:not([hidden])').waitFor();assert.equal(await page.locator('#account-profile').isVisible(),false);assert.equal(await page.locator('#account-name').textContent(),'');release();await late;assert.equal(await page.locator('#account-profile').isVisible(),false);
    await page.unroute('**/api/mentor-session/restore');await page.locator('#account-session-retry').click();await page.locator('#account-profile:not([hidden])').waitFor();
  }finally{await browser.close();}
});
