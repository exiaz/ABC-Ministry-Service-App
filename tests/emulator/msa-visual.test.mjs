import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {msaFixture} from './msa-a1-fixture.mjs';
import {createMsaVisual} from '../../backend/msa-visual.mjs';
import {createPrototypeServer} from '../../server.mjs';
import {createAdminServer} from '../../admin-server.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

function png(pixel){
  const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);type.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);return result;};
  const h=Buffer.alloc(13);h.writeUInt32BE(1);h.writeUInt32BE(1,4);h[8]=8;h[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.from([0,pixel,40,50,255]))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const command=revision=>({expectedRevision:revision,requestId:randomUUID(),reason:'Pengujian media fiktif',confirmed:true});
const upload=(revision,pixel)=>({mutation:command(revision),metadata:{alt:'Gambar fiktif',x:40,y:60},image:png(pixel)});

test('Visual lifecycle isolates drafts and revisions, checks authorization, restart and storage failures',async t=>{
  const previous=Object.fromEntries(['ABC_MSA_VISUAL_V1A','ABC_MSA_A2_2','ABC_MSA_A2_3'].map(k=>[k,process.env[k]]));
  for(const key of Object.keys(previous))process.env[key]='1';
  t.after(()=>{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;});
  const f=await msaFixture(t,{namespace:'test-auth-pilot-'+randomUUID()}),visual=f.adminAuthentication.a1.visual;
  const mentor=createPrototypeServer({mentorMode:true,visual});mentor.listen(0,'127.0.0.1');await once(mentor,'listening');
  t.after(()=>new Promise(resolve=>{mentor.close(resolve);mentor.closeAllConnections();}));
  const mentorBase='http://127.0.0.1:'+mentor.address().port,slots=['login','registration','dashboard'];
  const path=(slot,action='')=>'/api/visual/'+slot+(action?'/'+action:'');
  const publicRead=(base,slot,revision='')=>fetch(base+'/visual/published/'+slot+(revision?'/'+revision:''));
  const user=await f.enroll(),session=await f.signIn(user);
  for(const slot of slots){
    assert.equal((await f.request(path(slot,'draft'),upload(0,1),'')).status,401);
    assert.equal((await f.request(path(slot,'draft'),upload(0,1),session.token)).status,403);
    assert.equal((await f.request(path(slot,'preview'),undefined,session.token)).status,403);
    assert.equal((await f.request(path(slot,'history'),undefined,session.token)).status,403);
    assert.equal((await f.request(path(slot,'publish'),{mutation:command(0)},session.token)).status,403);
    assert.equal((await publicRead(f.base,slot)).status,404);
  }
  assert.equal((await f.change(user.uid,{role:'admin',scope:{organizationId:'org-a'}})).status,200);
  const admin=await f.signIn(user);
  assert.equal((await f.request(path('login','draft'),upload(0,1),admin.token)).status,403);
  assert.equal((await f.request(path('login','preview'),undefined,admin.token)).status,403);
  assert.equal((await f.request(path('login','revert'),{mutation:command(0),targetRevision:0},admin.token)).status,403);
  const manager=await f.enroll();
  assert.equal((await f.change(manager.uid,{role:'superadmin',scope:{organizationId:null}})).status,200);
  const backupManager=await f.enroll();
  assert.equal((await f.change(backupManager.uid,{role:'superadmin',scope:{organizationId:null}})).status,200);
  const managerSession=await f.signIn(manager);
  assert.equal((await f.request(path('login'),undefined,managerSession.token)).status,200);
  const portal=createAdminServer({adminAuthentication:f.adminAuthentication,pairing:f.pairing,portal:true});portal.listen(0,'127.0.0.1');await once(portal,'listening');
  t.after(()=>new Promise(resolve=>{portal.close(resolve);portal.closeAllConnections();}));
  const portalBase='http://127.0.0.1:'+portal.address().port;
  const login=await fetch(portalBase+'/api/portal/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:portalBase,'X-MSA-Portal':'1'},body:JSON.stringify({username:manager.username,password:manager.password})});
  assert.equal(login.status,200);assert.ok((await login.json()).modules.some(m=>m.href==='/visual-studio.html'));const cookie=login.headers.get('set-cookie').split(';')[0];
  const uiBrowser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await uiBrowser.newPage();
    await page.context().addCookies([{name:cookie.split('=')[0],value:cookie.split('=')[1],url:portalBase}]);
    await page.goto(portalBase+'/visual-studio.html');await page.locator('#studio').waitFor({state:'visible'});
    await page.locator('#image').setInputFiles({name:'fiktif.png',mimeType:'image/png',buffer:Buffer.from(png(17),'base64')});
    await page.locator('#alt').fill('Gambar fiktif');await page.locator('#reason').fill('Pengujian gambar fiktif');await page.locator('#confirm').check();
    await page.locator('#editor button[type=submit]').click();await page.getByText('Draf tersedia secara privat.').waitFor();
    assert.equal((await publicRead(portalBase,'welcome')).status,404);
    const screenshotDir='.emulator-data/visual-studio-v1b3';await mkdir(screenshotDir,{recursive:true});
    for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${screenshotDir}/${width}.png`,fullPage:true});}
    let firstBody='',retryBody='';
    const routePattern='**/api/portal/dispatch/api/visual/welcome/publish';
    await page.route(routePattern,async route=>{firstBody=route.request().postData();await route.fetch();await route.abort();},{times:1});
    await page.locator('#confirm').check();await page.locator('#publish').click();await page.locator('#retry').waitFor({state:'visible'});
    page.on('request',req=>{if(req.url().endsWith('/api/visual/welcome/publish'))retryBody=req.postData();});
    await page.locator('#retry').click();await page.getByText('Revisi publikasi 2').waitFor();assert.equal(retryBody,firstBody);
    await page.locator('#confirm').check();await page.locator('#revert').click();await page.getByText('Menggunakan gambar bawaan.').waitFor();
  }finally{await uiBrowser.close();}
  const portalCall=(route,options={})=>fetch(portalBase+'/api/portal/dispatch/api/visual/login'+route,{...options,headers:{'X-MSA-Portal':'1',Origin:portalBase,Cookie:cookie,...options.headers}});
  assert.equal((await portalCall('')).status,200);
  assert.equal((await portalCall('/draft',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://evil.invalid'},body:JSON.stringify(upload(0,1))})).status,403);
  assert.equal((await f.change(manager.uid,{role:'superadmin',scope:{organizationId:null},status:'revoked',expectedRevision:2})).status,200);
  assert.equal((await f.request(path('login'),undefined,managerSession.token)).status,401);
  assert.equal((await portalCall('')).status,401);
  assert.equal((await f.request(path('login','draft'),{...upload(0,1),image:Buffer.from('<svg/>').toString('base64')})).status,400);
  assert.equal((await f.request(path('login','draft'),{...upload(0,1),metadata:{alt:'',x:101,y:0}})).status,400);
  assert.equal((await f.request('/api/visual/program/draft',upload(0,1))).status,404);
  assert.equal((await f.request(path('login','draft'),upload(0,1),f.token,{Origin:'https://example.invalid'})).status,403);
  const drafts=slots.map((slot,i)=>upload(0,20+i));
  for(let i=0;i<slots.length;i++){
    const slot=slots[i],draft=drafts[i];assert.equal((await f.request(path(slot,'draft'),draft)).status,200);
    assert.equal((await f.request(path(slot,'draft'),draft)).status,200);
    assert.equal((await f.request(path(slot,'draft'),{...draft,metadata:{alt:'Berbeda',x:40,y:60}})).status,409);
    assert.equal((await f.request(path(slot,'draft'),upload(0,70))).status,409);
    assert.equal((await publicRead(f.base,slot)).status,404);
    const preview=await f.request(path(slot,'preview'));assert.equal(preview.status,200);assert.equal(preview.headers.get('cache-control'),'no-store');assert.equal((await preview.json()).image,png(20+i));
  }
  assert.equal((await f.root.collection('msaVisualAudit').get()).size,6);
  const privateChunk=(await f.root.collection('msaVisualChunks').limit(1).get()).docs[0];
  const rawFirestore='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/demo-abc-attendance/databases/(default)/documents/'+privateChunk.ref.path;
  assert.equal((await fetch(rawFirestore)).status,403);
  assert.equal((await fetch(f.base+'/visual/published/login/'+privateChunk.id)).status,404);
  for(const slot of slots){
    assert.equal((await f.request(path(slot,'publish'),{mutation:command(1)})).status,200);
    assert.equal((await f.request(path(slot,'preview'))).status,404);
    for(const base of [f.base,mentorBase]){const info=await publicRead(base,slot);assert.equal(info.status,200);assert.equal(info.headers.get('cache-control'),'no-store');const value=await info.json();assert.equal(value.revision,2);const image=await publicRead(base,slot,2);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');}
  }
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    for(const [url,slot] of [[f.base+'/register.html','registration'],[mentorBase+'/mentor-account.html','login']]){
      await page.goto(url);const image=page.locator('[data-visual-slot="'+slot+'"] img');await image.waitFor();
      await page.waitForFunction(s=>{const img=document.querySelector('[data-visual-slot="'+s+'"] img');return img?.complete&&img.naturalWidth>0&&img.getAttribute('src')==='/visual/published/'+s+'/2';},slot);
      assert.equal(await image.getAttribute('alt'),'Gambar fiktif');
      assert.equal(await image.evaluate(el=>el.style.objectPosition),'40% 60%');
    }
    await page.route('**/visual/published/login/2',route=>route.fulfill({status:404}));
    await page.goto(mentorBase+'/mentor-account.html');
    await page.waitForFunction(()=>{const img=document.querySelector('[data-visual-slot="login"] img');return img?.complete&&img.naturalWidth>0&&img.getAttribute('src')==='/assets/msa-visual-default.jpg';});
  }finally{await browser.close();}
  const oldImage=Buffer.from(await (await publicRead(f.base,'login',2)).arrayBuffer());
  assert.equal((await f.request(path('login','draft'),upload(2,99))).status,200);
  assert.deepEqual(Buffer.from(await (await publicRead(f.base,'login',2)).arrayBuffer()),oldImage);
  assert.equal((await f.request(path('login','publish'),{mutation:command(3)})).status,200);
  assert.equal((await publicRead(f.base,'login',2)).status,404);
  assert.equal((await f.request(path('login','revert'),{mutation:command(4),targetRevision:2})).status,200);
  assert.deepEqual(Buffer.from(await (await publicRead(mentorBase,'login',5)).arrayBuffer()),oldImage);
  assert.equal((await publicRead(f.base,'registration',2)).status,200);
  const restarted=createMsaVisual({db:f.db,root:f.root,accounts:f.adminAuthentication.a1.accounts,enabled:visual.enabled});
  assert.deepEqual((await restarted.publicRead('login',5)).bytes,oldImage);
  const failureDb={runTransaction:fn=>f.db.runTransaction(tx=>fn(new Proxy(tx,{get(target,key){
    if(key==='create')return (ref,data)=>{if(ref.path.includes('/msaVisualChunks/'))throw Error('Simulated storage failure');return target.create(ref,data);};
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }})))};
  const failed=createMsaVisual({db:failureDb,root:f.root,accounts:f.adminAuthentication.a1.accounts,enabled:visual.enabled});
  const principal=await f.adminAuthentication.authorize('Bearer '+f.token),actor={kind:'legacy',uid:principal.uid,revision:principal.revision,check:async()=>{const p=await f.adminAuthentication.authorize('Bearer '+f.token);return p.kind==='ok'&&p.revision===principal.revision;}};
  const auditBefore=(await f.root.collection('msaVisualAudit').get()).size;
  await assert.rejects(failed.upload(actor,'login',upload(5,101)));
  assert.equal((await f.root.collection('msaVisualSlots').doc('login').get()).data().revision,5);
  assert.equal((await f.root.collection('msaVisualAudit').get()).size,auditBefore);
  assert.deepEqual((await visual.publicRead('login',5)).bytes,oldImage);
  let checks=0;const staleActor={...actor,check:async()=>++checks<3};
  await assert.rejects(visual.upload(staleActor,'login',upload(5,102)),e=>e.status===403);
  assert.equal((await f.root.collection('msaVisualSlots').doc('login').get()).data().revision,5);
  assert.equal((await f.root.collection('msaVisualAudit').get()).size,auditBefore);
  const row=(await f.root.collection('msaVisualSlots').doc('login').get()).data();
  const chunk=f.root.collection('msaVisualChunks').doc(row.published.assetId+'-0'),saved=(await chunk.get()).data();
  await chunk.update({data:'AAAA'});assert.equal((await publicRead(f.base,'login')).status,404);
  assert.equal((await f.request(path('login','revert'),{mutation:command(5),targetRevision:2})).status,503);
  assert.equal((await f.root.collection('msaVisualSlots').doc('login').get()).data().revision,5);
  await chunk.set(saved);assert.equal((await publicRead(f.base,'login',5)).status,200);
  const events=(await f.root.collection('msaVisualAudit').get()).docs.map(d=>d.data());
  assert.ok(events.every(e=>[f.uid,manager.uid].includes(e.actorUid)&&e.reason&&e.requestId&&Number.isSafeInteger(e.at)&&e.revision===e.previousRevision+1));
  assert.equal((await f.request(path('login','revert'),{mutation:command(5),targetRevision:0})).status,200);
  assert.equal((await publicRead(f.base,'login')).status,404);
  assert.equal((await publicRead(f.base,'dashboard',2)).status,200);
  assert.equal((await f.request(path('registration','revert'),{mutation:command(2),targetRevision:0})).status,200);
  assert.equal((await publicRead(f.base,'registration')).status,404);
  assert.equal((await f.request(path('registration','revert'),{mutation:command(3),targetRevision:2})).status,200);
  assert.equal((await publicRead(mentorBase,'registration',4)).status,200);
  const history=await (await f.request(path('registration','history'))).json();
  assert.deepEqual(history.publications.map(v=>v.revision),[4,3,2]);
  assert.deepEqual(history.publications.map(v=>v.fallback),[false,true,false]);
  assert.ok(history.audit.every(e=>e.actorUid===f.uid&&e.reason&&e.requestId));
  const race=await Promise.all([upload(2,111),upload(2,112)].map(value=>f.request(path('dashboard','draft'),value)));
  assert.deepEqual(race.map(response=>response.status).sort(),[200,409]);
  assert.equal((await (await f.request(path('dashboard'))).json()).revision,3);
  assert.equal((await publicRead(f.base,'dashboard',2)).status,200);
  assert.equal((await f.request(path('dashboard','revert'),{mutation:command(3),targetRevision:0})).status,200);
  assert.equal((await publicRead(f.base,'dashboard')).status,404);
  assert.equal((await f.request(path('dashboard','revert'),{mutation:command(4),targetRevision:2})).status,200);
  assert.equal((await publicRead(mentorBase,'dashboard',5)).status,200);
  delete process.env.ABC_MSA_VISUAL_V1A;
  assert.equal((await publicRead(f.base,'dashboard')).status,404);
  assert.equal((await f.request(path('dashboard'))).status,404);
  process.env.ABC_MSA_VISUAL_V1A='1';
});
