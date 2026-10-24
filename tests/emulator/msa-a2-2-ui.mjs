import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {registrationFixture,scope} from './msa-a2-2-fixture.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('A2.2 Chrome real registration, pending denial, explicit reviewer approval/link and responsive private UI',{timeout:120000},async t=>{
  const f=await registrationFixture(t),v=f.value(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},locale:'id-ID'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await mkdir('screenshots',{recursive:true});await page.goto(f.base+'/register.html');assert.equal(await page.locator('input').count(),4);assert.equal(await page.locator('input[type=email]').count(),0);assert.equal((await page.locator('body').innerText()).includes('@msa.'),false);
    await page.locator('#full-name').fill(v.fullName);await page.locator('#phone').fill(v.phone);await page.locator('#username').fill(v.username);await page.locator('#password').fill(v.password);
    for(const width of [360,390,768,1365]){
      await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const inputs=await page.locator('#registration input').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)})));assert.ok(inputs.every(n=>n.height>=44&&n.font>=16));
      await page.screenshot({path:'screenshots/msa-a2-2-register-'+width+'.png',fullPage:true});
    }
    await page.locator('#registration button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Permintaan diterima'));assert.equal(await page.locator('#password').inputValue(),'');
    const claim=(await f.root.collection('msaUsernames').doc(v.username).get()).data();f.created.push(claim.uid);const user={...v,uid:claim.uid};assert.equal((await f.signIn(user)).response.status,401);
    assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));
    await page.goto(f.base+'/identity-review.html');assert.equal(await page.locator('#review-workspace').isVisible(),false);await page.locator('#login-name').fill(f.email);await page.locator('#login-password').fill(f.password);await page.locator('#review-login button').click();await page.waitForSelector('[data-account]');
    await page.locator('[data-account]').click();await page.waitForSelector('#detail:not([hidden])');await page.locator('#school').fill(scope.schoolId);await page.locator('#group').fill(scope.groupId);await page.locator('#service').fill(scope.serviceSessionId);
    await page.locator('#operation').selectOption('approve');await page.locator('#evidence-reference').fill('Bukti pemeriksaan langsung fiktif melalui browser');await page.locator('#evidence-confirmed').check();await page.locator('#reason').fill('Persetujuan fiktif melalui UI dengan bukti independen.');
    for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'screenshots/msa-a2-2-review-'+width+'.png',fullPage:true});}
    await page.locator('#review-form button').click();await page.waitForSelector('#confirmation[open]');assert.equal(await page.locator('#cancel').evaluate(n=>n===document.activeElement),true);await page.locator('#cancel').click();assert.equal((await f.root.collection('msaAccounts').doc(user.uid).get()).data().state,'pending');
    await page.locator('#review-form button').click();await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#account-info').textContent.includes('Disetujui'));
    await page.locator('#operation').selectOption('link');await page.locator('#mentor-id').fill('fictional-mentor');await page.locator('#evidence-reference').fill('Bukti Mentor fiktif diperiksa ulang secara independen');await page.locator('#evidence-confirmed').check();await page.locator('#reason').fill('Penautan Mentor fiktif melalui UI setelah pemeriksaan.');await page.locator('#review-form button').click();await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#defaults').textContent.includes('Penugasan tetap yang cocok: 1'));
    const row=(await f.root.collection('msaAccounts').doc(user.uid).get()).data();assert.deepEqual(row.roles,[]);assert.equal(row.phone.state,'supplied');assert.equal(row.mentorLink.mentorId,'fictional-mentor');assert.equal((await f.root.collection('devices').get()).size,0);
    await page.locator('#logout').click();await page.waitForSelector('#review-login');assert.equal(await page.locator('#review-workspace').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));assert.deepEqual(errors,[]);
    // New A2.2 state must remain readable/filterable in the existing A1 UI.
    const rejected=await f.register();assert.equal((await f.review(rejected,{decision:'reject',evidence:undefined,reason:'Bukti fiktif belum dapat dikonfirmasi.'})).status,200);
    await page.goto(f.base+'/a1.html');await page.locator('#msa-name').fill(f.email);await page.locator('#msa-password').fill(f.password);await page.locator('#msa-login-form button').click();await page.waitForSelector('[data-user]');await page.locator('#msa-state-filter').selectOption('rejected');await page.locator('#msa-search button').click();await page.waitForFunction(()=>document.querySelectorAll('[data-user]').length===1);
    assert.match(await page.locator('#msa-list').innerText(),/Ditolak/);await page.locator('[data-user]').click();await page.locator('#msa-kind').selectOption('state');assert.equal(await page.locator('#msa-account-state').inputValue(),'rejected');assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
