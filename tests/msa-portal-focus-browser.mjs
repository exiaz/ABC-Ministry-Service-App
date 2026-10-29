import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createAdminServer} from '../admin-server.mjs';
import {listen} from '../local-demo.mjs';
import {pilotEnvironment} from '../local-auth-pilot.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Chrome portal focus: delayed session validation keeps workspace; revoked session returns to login',async()=>{
  const prior={...process.env};Object.assign(process.env,pilotEnvironment({},{unified:true}));
  const server=await listen(createAdminServer({portal:true,adminAuthentication:{a1:{},revoke(){}}}),0);
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage();let pending,hold=false,valid=true;
    const profile={username:'fictional-focus',role:'superadmin',modules:[],expiresAt:Date.now()+1800000};
    // UI-only network fixture; no admission, credentials or grants are created.
    await page.route('**/api/portal/session',async route=>{
      if(hold)await new Promise(resolve=>pending=resolve);
      await route.fulfill({status:valid?200:401,json:valid?profile:{error:'Sesi berakhir.'}});
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#portal-workspace:not([hidden])').waitFor();
    hold=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>document.querySelector('#portal-workspace').getAttribute('aria-busy')==='true');
    assert.equal(await page.locator('#portal-login').isVisible(),false);assert.equal(await page.locator('#portal-workspace').isVisible(),true);
    while(!pending)await new Promise(resolve=>setTimeout(resolve,10));pending();
    await page.waitForFunction(()=>document.querySelector('#portal-workspace').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('#portal-login').isVisible(),false);
    hold=false;valid=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#portal-login:not([hidden])').waitFor();
    assert.equal(await page.locator('#portal-workspace').isVisible(),false);
  }finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);}
});

test('Authentication screens retain navigation, validation, login and registration across viewports',async()=>{
  const prior={...process.env};Object.assign(process.env,pilotEnvironment({},{unified:true}));
  const server=await listen(createAdminServer({portal:true,adminAuthentication:{a1:{registration:{enabled(){}}},revoke(){}}}),0);
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage(),base='http://127.0.0.1:'+server.address().port,output=path.resolve('.emulator-data/auth-ux-redesign');await mkdir(output,{recursive:true});
    let loginBody,registrationBody;
    await page.route('**/api/portal/session',r=>r.fulfill({status:401,json:{error:'Sesi berakhir.'}}));
    await page.route('**/api/portal/login',r=>{loginBody=r.request().postDataJSON();return r.fulfill({status:200,json:{username:'uji-fiktif',role:'volunteer',modules:[],expiresAt:Date.now()+60000}});});
    await page.route('**/api/a2-2/register',r=>{registrationBody=r.request().postDataJSON();return r.fulfill({status:200,json:{message:'Permintaan diterima untuk ditinjau.'}});});
    await page.goto(base+'/#masuk');await page.locator('#portal-login:not([hidden])').waitFor();
    assert.equal(await page.locator('#portal-title').textContent(),'Welcome back');
    for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('#portal-login button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)),true);await page.screenshot({path:path.join(output,'login-'+width+'.png'),fullPage:true});}
    await page.locator('#portal-username').fill('uji-fiktif');await page.locator('#portal-password').fill('kata-sandi-fiktif');await page.locator('#portal-show').click();assert.equal(await page.locator('#portal-password').getAttribute('type'),'text');assert.equal(await page.locator('#portal-show').getAttribute('aria-pressed'),'true');
    await page.locator('#portal-submit').click();await page.locator('#portal-workspace:not([hidden])').waitFor();assert.equal(loginBody.username,'uji-fiktif');assert.equal(loginBody.password,'kata-sandi-fiktif');
    await page.goto(base+'/register.html');await page.locator('#registration').waitFor();assert.equal(await page.locator('#registration h1').textContent(),'Create an account');assert.equal(await page.locator('#registration').evaluate(n=>n.checkValidity()),false);assert.equal(registrationBody,undefined);
    for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'signup-'+width+'.png'),fullPage:true});}
    await page.locator('#full-name').fill('Volunteer Fiktif');await page.locator('#phone').fill('081234567890');await page.locator('#username').fill('volunteer.uji');await page.locator('#password').fill('kata-sandi-fiktif');await page.locator('#registration button').click();await page.getByRole('status').filter({hasText:'Permintaan diterima'}).waitFor();assert.equal(registrationBody.fullName,'Volunteer Fiktif');assert.equal(registrationBody.username,'volunteer.uji');
    await page.locator('.auth-switch a').click();await page.locator('#portal-login:not([hidden])').waitFor();
  }finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);}
});
