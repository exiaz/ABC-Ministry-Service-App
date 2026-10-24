import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {pilotFixture} from './msa-a2-1-fixture.mjs';
import {createPrototypeServer} from '../../server.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('A2.1 Chrome branding and separate username pilot preserve legacy login, scoped PIC and session revocation',{timeout:120000},async t=>{
  const f=await pilotFixture(t);
  await f.pilot.claim(f.binding(f.uid,f.token,f.password,'momor1n'));await f.pilot.claim(f.binding(f.pic.uid,f.pic.token,f.pic.password,'pilot.pic'));
  const mentor=createPrototypeServer({mentorMode:true,apiOrigin:f.base}),demo=createPrototypeServer();
  for(const server of [mentor,demo]){server.listen(0,'127.0.0.1');await once(server,'listening');}
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},locale:'id-ID'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await mkdir('screenshots',{recursive:true});
    for(const [name,url] of [['admin',f.base],['mentor','http://127.0.0.1:'+mentor.address().port],['demo','http://127.0.0.1:'+demo.address().port],['username',f.base+'/username.html']]){
      await page.goto(url);await page.waitForSelector('.msa-brand');assert.match(await page.title(),/ABC \| Ministry Service App/);assert.match(await page.locator('.brand-copy').first().textContent(),/MINISTRY.*SERVICE APP/);
      for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'screenshots/msa-a2-1-'+name+'-'+width+'.png',fullPage:true});}
      if(name==='admin'){assert.equal(await page.locator('#admin-email').count(),1);assert.equal(await page.locator('#admin-username').count(),0);}
      if(name==='mentor')assert.equal(await page.locator('#pairing-code').count(),1);
      if(name==='demo')assert.match(await page.locator('.hero .eyebrow').innerText(),/GOES TO SCHOOL/);
    }
    assert.equal(await page.locator('#admin-email').count(),0);assert.equal(await page.getByRole('link',{name:'Masuk dengan email'}).count(),1);
    const login=async(username,password)=>{await page.locator('#admin-username').fill(username);await page.locator('#admin-password').fill(password);await page.locator('#admin-login button[type=submit]').click();};
    await login('momor1n','wrong-fictitious');await page.waitForSelector('#admin-root[data-phase=invalid]');assert.match(await page.locator('#admin-message').innerText(),/Username atau kata sandi/);
    await login('momor1n',f.password);await page.waitForSelector('#admin-root[data-phase=active]');assert.equal(await page.locator('[data-admin-tab=accounts]').count(),1);assert.equal((await page.locator('body').innerText()).includes(f.email),false);
    for(const width of [390,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'screenshots/msa-a2-1-owner-'+width+'.png',fullPage:true});}
    assert.equal(await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage})),JSON.stringify({local:{},session:{}}));
    await page.locator('[data-admin=logout]').click();await page.waitForSelector('#admin-root[data-phase=signed-out]');await login('pilot.pic',f.pic.password);await page.waitForSelector('#admin-root[data-phase=active]');assert.equal(await page.locator('[data-admin-tab=accounts]').count(),0);
    await page.locator('[data-admin-tab=devices]').click();await page.waitForSelector('#admin-devices[data-state=ready]');await page.locator('#device-school').selectOption('s1');assert.equal(await page.locator('#device-visit option').count(),2);
    await f.request('/api/admin/accounts/'+f.pic.uid,{expectedRevision:1,state:'disabled'});await page.locator('[data-admin=verify]').click();await page.waitForSelector('#admin-root[data-phase=expired]');assert.equal(await page.locator('.admin-tabs').count(),0);
    await page.getByRole('link',{name:'Masuk dengan email'}).click();await page.waitForSelector('#admin-email');assert.deepEqual(errors,[]);
  }finally{await browser.close();for(const server of [mentor,demo])await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
