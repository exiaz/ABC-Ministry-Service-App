import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {migrationFixture} from './msa-a2-4c-fixture.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
test('A2.4C Chrome Superadmin-only redacted readiness at 360/390/768/1365, failed refresh hides data and no mutation actions exist',{timeout:120000},async t=>{
  const f=await migrationFixture(t),u=await f.account();await f.activate();
  await f.adminAuthentication.a1.legacyPilot.claim({header:'Bearer '+f.token,username:'momor1n',password:f.password,expectedUid:f.uid,reason:'Binding Superadmin fiktif untuk inspeksi UI',confirmed:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({locale:'id-ID',viewport:{width:390,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('screenshots',{recursive:true});
    const login=async(username,password)=>{await page.locator('#migration-username').fill(username);await page.locator('#migration-password').fill(password);await page.locator('#migration-login button').click();};
    const capture=async name=>{for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await page.locator('input:visible').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=16&&n.getBoundingClientRect().height>=44)));assert.ok(await page.locator('button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));await page.screenshot({path:'screenshots/msa-a2-4c-'+name+'-'+width+'.png',fullPage:true});if(name==='report'&&[360,1365].includes(width))await page.screenshot({path:'screenshots/msa-a2-4c-report-viewport-'+width+'.png'});}};
    await page.goto(f.base+'/migration-readiness.html');await capture('login');await login(u.username,u.password);await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('tidak diizinkan'));assert.equal(await page.locator('#migration-report').isVisible(),false);assert.equal(await page.locator('#migration-username').inputValue(),u.username);
    await login('momor1n',f.password);await page.waitForSelector('#migration-report:not([hidden])');await capture('report');assert.match(await page.locator('#migration-verdict').textContent(),/NO-GO/);
    const text=await page.locator('#migration-report').innerText();for(const secret of [f.uid,u.uid,u.username,u.phone,f.email,'providerAlias'])assert.ok(!text.includes(secret));assert.equal(await page.locator('#migration-report button').count(),2);
    await page.route('**/api/a2-4c/preflight',route=>route.abort('failed'),{times:1});await page.locator('#migration-refresh').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Koneksi'));assert.equal(await page.locator('#migration-report').isVisible(),false);assert.equal(await page.locator('#migration-records').textContent(),'');
    await login('momor1n',f.password);await page.waitForSelector('#migration-report:not([hidden])');await page.locator('#migration-logout').click();await page.waitForSelector('#migration-login:not([hidden])');assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));
  }finally{await browser.close();}
});
