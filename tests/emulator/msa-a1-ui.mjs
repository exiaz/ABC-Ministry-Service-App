import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {msaFixture} from './msa-a1-fixture.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('A1 Chrome real emulator: scoped promotion/revoke confirmations, search, responsive layout and protected routes',{timeout:120000},async t=>{
  const f=await msaFixture(t),user=await f.enroll({username:'ui.fiktif'}),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},locale:'id-ID'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const login=async(name,password,mode='legacy')=>{await page.locator('#msa-mode').selectOption(mode);await page.locator('#msa-name').fill(name);await page.locator('#msa-password').fill(password);await page.locator('#msa-login-form button').click();};
    await page.goto(f.base+'/a1.html');assert.equal(await page.locator('#msa-management').isVisible(),false);
    const denied=await page.evaluate(async()=>{localStorage.setItem('role','superadmin');return (await fetch('/api/a1/accounts')).status;});assert.equal(denied,401);
    await login(f.email,f.password);await page.waitForSelector('[data-user]');assert.equal(await page.locator('#msa-password').inputValue(),'');
    await page.locator('[data-user]').click();await page.locator('#msa-org').selectOption('org-a');await page.locator('#msa-program').selectOption('program-org-a');await page.locator('#msa-reason').fill('Penugasan PIC fiktif melalui antarmuka');
    await page.locator('#msa-change button').click();await page.waitForSelector('#msa-confirm[open]');assert.equal(await page.locator('#msa-cancel').evaluate(n=>n===document.activeElement),true);
    await page.locator('#msa-cancel').click();assert.equal((await f.root.collection('msaAccounts').doc(user.uid).get()).data().roles.length,0);
    await page.locator('#msa-change button').click();await page.locator('#msa-apply').click();await page.waitForFunction(()=>document.querySelector('#msa-feedback').textContent.includes('Perubahan tersimpan'));
    assert.equal((await f.root.collection('msaAccounts').doc(user.uid).get()).data().roles[0].scope.programId,'program-org-a');
    await mkdir('screenshots',{recursive:true});for(const width of [360,390,768,1365]){
      await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const inputs=await page.locator('#msa-change input,#msa-change select,#msa-change textarea').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)})));assert.ok(inputs.filter(n=>n.height>0).every(n=>n.height>=44&&n.font>=16));
      await page.screenshot({path:'screenshots/msa-a1-users-'+width+'.png',fullPage:true});
    }
    await page.locator('#msa-query').fill('no-such-user');await page.locator('#msa-search button').click();await page.waitForFunction(()=>document.querySelector('#msa-list').textContent.includes('Tidak ada akun'));
    await page.locator('#msa-query').fill(user.username);await page.locator('#msa-search button').click();await page.waitForSelector('[data-user]');await page.locator('[data-user]').click();
    await page.locator('[data-grant]').click();await page.locator('#msa-reason').fill('Pencabutan PIC fiktif melalui antarmuka');await page.locator('#msa-change button').click();await page.locator('#msa-apply').click();
    await page.waitForFunction(()=>document.querySelector('#msa-detail').textContent.includes('Dicabut'));
    await page.locator('#msa-audit').click();await page.waitForSelector('#msa-history article');assert.match(await page.locator('#msa-history').innerText(),/Pencabutan PIC fiktif/);
    await page.locator('#msa-logout').click();await page.waitForSelector('#msa-login-form');await login(user.username,user.password,'username');await page.waitForFunction(()=>document.querySelector('#msa-feedback').textContent.includes('Hanya Superadmin'));
    assert.equal(await page.locator('#msa-management').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{role:'superadmin'},session:{}}));assert.deepEqual(errors,[]);
    await page.reload();assert.equal(await page.locator('#msa-management').isVisible(),false);
  }finally{await browser.close();}
});
