import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {recoveryFixture} from './msa-a2-4b-fixture.mjs';
import {recoverPilotAccount} from '../../local-auth-pilot.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('A2.4B Chrome mobile request/pending, independent reviewer confirmation, trusted owner reset and fresh login at four widths',{timeout:180000},async t=>{
  const f=await recoveryFixture(t),u=await f.account(),reviewer='recovery-reviewer-'+randomUUID().slice(0,8);
  await f.adminAuthentication.a1.legacyPilot.claim({header:'Bearer '+f.token,username:reviewer,password:f.password,expectedUid:f.uid,reason:'Peninjau recovery fiktif untuk pengujian UI',confirmed:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({locale:'id-ID',timezoneId:'Asia/Jakarta',viewport:{width:390,height:900}}),page=await context.newPage(),review=await context.newPage(),errors=[];for(const p of [page,review])p.on('pageerror',e=>errors.push(e.message));await mkdir('screenshots',{recursive:true});
    const capture=async(p,name)=>{for(const width of [360,390,768,1365]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await p.locator('input:visible:not([type=checkbox]),textarea:visible,select:visible').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=16)));assert.ok(await p.locator('button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));await p.screenshot({path:'screenshots/msa-a2-4b-'+name+'-'+width+'.png',fullPage:true});}};
    await page.goto(f.mentorBase+'/mentor-account.html');await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).click();await page.waitForSelector('#recovery-username');await capture(page,'request');
    assert.equal(await page.locator('#reviewer-entry').isVisible(),false);
    await page.locator('#recovery-username').fill(u.username);
    await page.route('**/api/a2-3/recovery-request',route=>route.abort('failed'),{times:1});await page.locator('#recovery-request button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Koneksi'));assert.equal(await page.locator('#recovery-username').inputValue(),u.username);
    await page.locator('#recovery-request button').click();await page.waitForSelector('#request-pending:not([hidden])');await capture(page,'pending');
    await review.goto(f.base+'/account-recovery.html');await review.locator('#reviewer-entry summary').click();await review.locator('#review-username').fill(reviewer);await review.locator('#review-password').fill(f.password);await review.locator('#recovery-login button').click();await review.waitForSelector('[data-recovery-id]');await review.locator('[data-recovery-id]').click();await review.waitForSelector('#recovery-review:not([hidden])');
    await review.locator('#recovery-decision').selectOption('approve');await review.locator('#recovery-reason').fill('Pemulihan pemilik fiktif sesudah pemeriksaan baru');await review.locator('#recovery-reference').fill('Pertemuan dan catatan fiktif diperiksa independen');await review.locator('#recovery-evidence-confirmed').check();await capture(review,'review');
    await review.locator('#recovery-review button[type=submit]').click();assert.equal(await review.locator('#recovery-cancel').evaluate(n=>n===document.activeElement),true);await capture(review,'confirmation');await review.locator('#recovery-cancel').click();assert.equal((await f.rows())[0].state,'pending');assert.equal(await review.locator('#recovery-reason').inputValue(),'Pemulihan pemilik fiktif sesudah pemeriksaan baru');
    const retryIds=[];await review.route('**/api/a2-4b/requests/*/review',async route=>{retryIds.push(route.request().postDataJSON().requestId);const response=await route.fetch();if(retryIds.length===1)await route.abort('failed');else await route.fulfill({response});});
    await review.locator('#recovery-review button[type=submit]').click();await review.locator('#recovery-apply').click();await review.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Koneksi'));assert.equal(await review.locator('#recovery-confirm').evaluate(n=>n.open),true);await review.locator('#recovery-apply').click();await review.waitForFunction(()=>document.querySelector('#review-state').textContent.includes('Disetujui'));assert.equal(retryIds.length,2);assert.equal(retryIds[0],retryIds[1]);await capture(review,'approved');
    const pw=randomBytes(24).toString('base64url');const result=await recoverPilotAccount({recovery:f.recovery,username:u.username,askPassword:async()=>pw});assert.equal(result.result.reset,true);
    await review.locator('#recovery-refresh').click();await review.waitForFunction(()=>document.querySelector('#review-state').textContent.includes('Selesai'));await capture(review,'completed');
    await page.goto(f.mentorBase+'/mentor-account.html');await page.locator('#account-username').fill(u.username);await page.locator('#account-password').fill(u.password);await page.locator('#account-login-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#account-feedback').textContent.includes('tidak valid'));
    await page.locator('#account-password').fill(pw);await page.locator('#account-login-form button[type=submit]').click();await page.waitForSelector('#account-code');await capture(page,'fresh-login');
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));
    assert.ok(!await review.locator('body').innerText().then(s=>s.includes(pw)));
  }finally{await browser.close();}
});
