import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {runPilot,stopPilot,PILOT_USERNAME,PIC_USERNAME,PILOT_PORTS} from '../local-auth-pilot.mjs';
import {portOccupied,waitFor} from '../local-demo.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Unified MSA portal: separate fictional identities, capability navigation, shared session, denial and mobile screenshots',{timeout:240000},async()=>{
  const password=randomBytes(24).toString('base64url'),picPassword=randomBytes(24).toString('base64url'),opened=[],messages=[];
  const input=new PassThrough();let ready,reject;const prepared=new Promise((resolve,fail)=>{ready=resolve;reject=fail;});
  const running=runPilot({unified:true,input,output:new PassThrough(),askPassword:async()=>password,askPicPassword:async()=>picPassword,open:async options=>opened.push(options.adminOrigin+'/'),log:s=>{messages.push(s);console.log(s);},onReady:ready});running.then(()=>reject(Error('MSA belum siap')),reject);
  let browser;
  try{
    const f=await prepared,origin=f.options.adminOrigin;
    await waitFor(async()=>opened.length===1);assert.deepEqual(opened,[origin+'/']);
    await runPilot({unified:true,open:async options=>opened.push(options.adminOrigin+'/'),log:()=>{}});assert.deepEqual(opened,[origin+'/',origin+'/']);
    const root=f.context.root,owner=(await root.collection('msaUsernames').doc(PILOT_USERNAME).get()).data().uid,pic=(await root.collection('msaUsernames').doc(PIC_USERNAME).get()).data().uid;
    assert.notEqual(owner,pic);assert.equal((await root.collection('msaCorePlatformGrants').doc(pic).get()).exists,false);assert.equal((await root.collection('msaAccounts').get()).size,0);
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext({locale:'id-ID',viewport:{width:390,height:900}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const screenshots=path.resolve('.emulator-data/msa-portal-qa/screenshots');await mkdir(screenshots,{recursive:true});
    const capture=async name=>{for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(screenshots,name+'-'+width+'.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await page.locator('input:visible').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=16)));assert.deepEqual(await page.locator('button:visible,a:visible,summary:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,html:n.outerHTML}))),[]);}};
    const login=async(username,value)=>{await page.goto(origin+'/');await page.locator('#portal-username').fill(username);await page.locator('#portal-password').fill(value);await page.locator('#portal-login button[type=submit]').click();await page.waitForSelector('#portal-workspace:not([hidden])');};
    await page.goto(origin+'/');assert.equal(await page.locator('select').count(),0);await page.locator('#portal-username').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#portal-password').evaluate(n=>n===document.activeElement),true);await page.locator('#portal-show').click();assert.equal(await page.locator('#portal-password').getAttribute('type'),'text');await capture('login');
    await page.locator('#portal-username').fill(PILOT_USERNAME);await page.locator('#portal-password').fill('incorrect-fictional-password');await page.locator('#portal-login button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#portal-feedback').textContent.includes('tidak valid'));assert.equal(await page.locator('#portal-workspace').isVisible(),false);
    await login(PILOT_USERNAME,password);assert.equal(await page.locator('#portal-modules a').count(),7);await capture('superadmin');
    const api=async(route,body)=>page.evaluate(async({route,body})=>{const {msaFetch}=await import('/msa-session.js');const r=await msaFetch(route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};},{route,body});
    const profile=await api('/api/portal/session');assert.equal(profile.status,200);assert.equal(profile.body.token,undefined);
    const cookie=(await context.cookies()).find(c=>c.name.startsWith('msa_session_'));assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Strict');assert.equal(await page.evaluate(()=>document.cookie.includes('msa_session_')),false);
    assert.equal((await context.cookies(f.options.mentorOrigin+'/')).some(c=>c.name===cookie.name),false);
    for(const [route,workspace] of [['/msa-events.html','#event-workspace'],['/msa-core.html','#core-workspace'],['/a1.html','#msa-management'],['/identity-review.html','#review-workspace'],['/account-recovery.html','#review-workspace'],['/migration-readiness.html','#migration-report'],['/username.html','[data-phase=active]']]){
      console.log('SESSION NAV '+route);await page.goto(origin+route);assert.equal(await page.locator('input[type=password]:visible').count(),0);await page.waitForSelector(workspace+':not([hidden])');assert.equal((await api('/api/portal/session')).body.uid,owner);
    }
    await page.goto(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');await page.locator('#portal-logout').click();await page.waitForSelector('#portal-login:not([hidden])');assert.equal((await api('/api/stage8/organizations')).status,401);
    await login(PIC_USERNAME,picPassword);assert.equal(await page.locator('#portal-modules a[href="/a1.html"]').count(),0);assert.equal(await page.locator('#portal-modules a[href="/migration-readiness.html"]').count(),0);await capture('pic');
    const catalog=await api('/api/stage9a/organizations');assert.deepEqual(catalog.body.organizations.map(o=>o.id),['fictional-abc-movement']);assert.ok(!catalog.body.organizations[0].permissions.includes('events:publish'));assert.ok(!catalog.body.organizations[0].permissions.includes('events:cancel'));
    for(const route of ['/api/a1/accounts','/api/a2-4c/preflight','/api/stage9a/organizations/fictional-yayasan-abc/options'])assert.equal((await api(route)).status,403);
    const options=await api('/api/stage9a/organizations/fictional-abc-movement/options');
    // Resolve the exact membership from server fixture data, never a role label.
    const membership=(await root.collection('msaCoreMemberships').where('uid','==',pic).get()).docs[0].id;
    assert.ok(options.body.pics.some(p=>p.id===membership));
    const draftId='fictional-pic-browser-draft',control={requestId:randomUUID()};
    const draft={...control,expectedRevision:0,reason:'Draf fiktif dari PIC dengan grant eksplisit',confirmed:true,name:'Draf PIC Browser',startDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),startTime:'09:00',timezone:'Asia/Jakarta',venue:'Aula Fiktif',programId:null,picMembershipId:membership};
    assert.equal((await api('/api/stage9a/organizations/fictional-abc-movement/events/'+draftId,draft)).status,200);
    assert.equal((await api('/api/stage9b1/organizations/fictional-abc-movement/events/'+draftId+'/publish',{requestId:randomUUID(),expectedRevision:1,reason:'Percobaan publish PIC tanpa grant',confirmed:true})).status,403);
    await page.goto(origin+'/msa-events.html');await page.waitForFunction(()=>document.querySelector('#dashboard-result').textContent.startsWith('Jadwal mendatang'));await page.waitForSelector('[data-dashboard-event="fictional-pic-upcoming"]');await capture('pic-services');
    await page.reload();await page.waitForSelector('#event-workspace:not([hidden])');assert.equal((await api('/api/portal/session')).body.uid,pic);assert.ok((await api('/api/stage9b2/dashboard')).body.assigned?.length>0);
    await root.collection('adminAccounts').doc(pic).update({state:'disabled',revision:2});assert.equal((await api('/api/portal/session')).status,401);assert.equal((await api('/api/stage9a/organizations')).status,401);
    await page.goto(origin+'/msa-core.html');await page.waitForURL(origin+'/');await page.waitForSelector('#portal-login:not([hidden])');
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/token|password|session/i.test(k))),false);assert.ok(messages.every(s=>!s.includes(password)&&!s.includes(picPassword)));
    console.log('PASS unified MSA portal screenshots: '+screenshots);
  }finally{await browser?.close();await stopPilot({log:()=>{}});await running;await waitFor(async()=>!(await Promise.all(PILOT_PORTS.map(portOccupied))).some(Boolean),{timeout:10000});}
});
