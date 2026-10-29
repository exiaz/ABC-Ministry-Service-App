import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
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
