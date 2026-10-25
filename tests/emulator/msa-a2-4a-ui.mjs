import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {lifecycleFixture} from './msa-a2-4a-fixture.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('A2.4A Chrome self/Admin device management, confirmations, revocation, suspension and explicit fresh activation at four widths',{timeout:180000},async t=>{
  const f=await lifecycleFixture(t),u=await f.account(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:390,height:900},locale:'id-ID',timezoneId:'Asia/Jakarta'}),page=await context.newPage(),review=await context.newPage(),errors=[];for(const p of [page,review])p.on('pageerror',e=>errors.push(e.message));
    await mkdir('screenshots',{recursive:true});
    const capture=async(p,name)=>{for(const width of [360,390,768,1365]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const root=p.locator('.account-device-list');assert.ok(await root.locator('button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(n).fontSize)>=16)));await p.screenshot({path:'screenshots/msa-a2-4a-'+name+'-'+width+'.png',fullPage:true});}};
    const login=async()=>{await page.locator('#account-username').fill(u.username);await page.locator('#account-password').fill(u.password);await page.locator('#account-login-form button').click();await page.waitForSelector('#account-code');};
    const activate=async()=>{await page.locator('#account-code').fill(await f.issue());await page.locator('#account-activation button').click();await page.waitForSelector('[data-account-action=associate]');await page.locator('[data-account-action=associate]').click();await page.waitForSelector('#secure-roster-rows .student-row');};
    await page.goto(f.mentorBase+'/mentor-account.html');await login();await activate();await page.locator('#account-manage-devices').click();await page.waitForSelector('.account-device-card');await capture(page,'mentor');
    await page.locator('[data-device-revoke]').click();await page.waitForSelector('.account-device-confirm[open]');assert.equal(await page.locator('[data-device-cancel]').evaluate(n=>n===document.activeElement),true);
    const font=await page.locator('.account-device-confirm textarea').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));assert.ok(font>=16);await capture(page,'confirmation');
    await page.locator('[data-device-cancel]').click();assert.equal((await f.root.collection('devices').get()).docs[0].data().state,'active');
    await page.locator('[data-device-revoke]').click();await page.locator('.account-device-confirm textarea').fill('Perangkat fiktif diganti oleh pemilik akun');await page.locator('.account-device-confirm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.account-device-card')?.textContent.includes('Dicabut'));await page.waitForSelector('#account-code');assert.equal(await page.locator('#account-attendance').isVisible(),false);
    await activate();await page.locator('#account-manage-devices').click();await page.waitForFunction(()=>document.querySelectorAll('.account-device-card').length===2);await capture(page,'replacement');
    await review.goto(f.base+'/identity-review.html');await review.locator('#login-name').fill(f.email);await review.locator('#login-password').fill(f.password);await review.locator('#review-login button').click();await review.waitForSelector('[data-account]');await review.locator('[data-account]').click();await review.locator('#review-devices [data-devices-open]').click();await review.waitForSelector('#review-devices .account-device-card');await capture(review,'reviewer');
    const retryIds=[];await review.route('**/api/a2-4/**/revoke',async route=>{retryIds.push(route.request().postDataJSON().requestId);const response=await route.fetch();if(retryIds.length===1)await route.abort('failed');else await route.fulfill({response});});
    await review.locator('#review-devices [data-device-revoke]').click();await review.locator('#review-devices textarea[name=reason]').fill('Pencabutan fiktif oleh peninjau berwenang');await review.locator('#review-devices button[type=submit]').click();await review.waitForFunction(()=>document.querySelector('#review-devices [data-device-result]').textContent.includes('Hasil belum dapat dipastikan'));
    assert.equal(await review.locator('#review-devices dialog').evaluate(n=>n.open),true);await review.locator('#review-devices button[type=submit]').click();await review.waitForFunction(()=>document.querySelectorAll('#review-devices [data-device-revoke]').length===0);assert.equal(retryIds.length,2);assert.equal(retryIds[0],retryIds[1]);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('#account-code');assert.equal(await page.locator('#account-attendance').isVisible(),false);
    const change=(state,expectedRevision)=>f.request('/api/a1/accounts/'+u.uid+'/change',{state,expectedRevision,requestId:randomUUID(),reason:'Perubahan status fiktif untuk uji perangkat'});
    assert.equal((await change('suspended',3)).status,200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('#account-login:not([hidden])');assert.equal(await page.locator('#account-device-management').isVisible(),false);
    assert.equal((await change('active',4)).status,200);await login();assert.equal(await page.locator('#account-attendance').isVisible(),false);await page.locator('#account-manage-devices').click();await page.waitForSelector('.account-device-card');await capture(page,'reactivated-blocked');
    await activate();assert.equal((await f.root.collection('msaDeviceAssociations').get()).size,3);assert.equal((await f.root.collection('msaDeviceAssociationEvents').where('event','==','account-device-revoked').get()).size,2);assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));
  }finally{await browser.close();}
});
