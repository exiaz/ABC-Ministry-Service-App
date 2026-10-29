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
function widePng(){
  const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);type.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);return result;};
  const h=Buffer.alloc(13);h.writeUInt32BE(96);h.writeUInt32BE(24,4);h[8]=8;h[9]=6;const row=Buffer.alloc(1+96*4);
  for(let x=0;x<96;x++){row[1+x*4]=x*2;row[2+x*4]=40;row[3+x*4]=200-x;row[4+x*4]=255;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.concat(Array.from({length:24},()=>row)))),chunk('IEND',Buffer.alloc(0))]);
}
async function selectSlot(page,slot){const field=page.locator('#slot');if(await field.isVisible())await field.selectOption(slot);else await page.locator('[data-slot="'+slot+'"]').click();}
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
    await page.setViewportSize({width:2400,height:1100});
    await page.context().addCookies([{name:cookie.split('=')[0],value:cookie.split('=')[1],url:portalBase}]);
    await page.goto(portalBase+'/visual-studio.html');await page.locator('#studio').waitFor({state:'visible'});
    const screenshotDir='.emulator-data/visual-studio-v1b3a';await mkdir(screenshotDir,{recursive:true});
    for(const slot of ['welcome','login','registration','dashboard']){
      await selectSlot(page,slot);
      await page.waitForFunction(()=>!document.querySelector('#image').disabled);
      const mimeType=slot==='welcome'?'image/jpeg':slot==='registration'?'image/webp':'image/png';
      const converted=await page.evaluate(async({source,type})=>{
        const raw=Uint8Array.from(atob(source),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([raw],{type:'image/png'}));
        const canvas=document.createElement('canvas');canvas.width=type==='image/png'?24:bitmap.width;canvas.height=type==='image/png'?96:bitmap.height;const ctx=canvas.getContext('2d');if(type==='image/png'){ctx.translate(24,0);ctx.rotate(Math.PI/2);ctx.drawImage(bitmap,0,0,96,24);}else ctx.drawImage(bitmap,0,0);bitmap.close();
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,type));
        return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
      },{source:widePng().toString('base64'),type:mimeType});
      await page.locator('#image').setInputFiles({name:'fiktif.'+(mimeType==='image/jpeg'?'jpg':mimeType==='image/webp'?'webp':'png'),mimeType,buffer:Buffer.from(converted,'base64')});
      await page.waitForFunction(()=>document.querySelector('#image-info').textContent.includes('MiB')).catch(async()=>{throw Error('Persiapan gambar '+slot+': '+await page.locator('#image-info').textContent()+'; '+await page.locator('#feedback').textContent());});
      if(slot==='login'){
        await page.locator('#crop-stage').scrollIntoViewIfNeeded();const box=await page.locator('#crop-stage').boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+25,{steps:4});await page.mouse.up();
        const shifted=Number(await page.locator('#y').inputValue());assert.ok(shifted<50,'Dragging portrait down must move the crop toward the top');
        await page.locator('#crop-stage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await page.locator('#y').inputValue()),shifted+1);
        await page.locator('#position-reset').click();assert.equal(await page.locator('#y').inputValue(),'50');
      }
      await page.locator('#zoom').evaluate(el=>{el.value='1.6';el.dispatchEvent(new Event('input'));});
      assert.equal(await page.locator('#zoom-value').textContent(),'160%');
      if(slot==='login')for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:screenshotDir+'/studio-zoom-'+width+'.png',fullPage:true});}
      await page.locator('#crop-apply').click();
      await page.locator('#image-edit').click();await page.locator('#zoom').evaluate(el=>{el.value='2.2';el.dispatchEvent(new Event('input'));});await page.keyboard.press('Escape');assert.equal(await page.locator('#zoom').inputValue(),'1.6');
      if(!await page.locator('.advanced').evaluate(el=>el.open))await page.locator('.advanced summary').click();await page.locator('#alt').fill('Pratinjau fiktif');
      await page.locator('#image-edit').click();await page.locator('#crop-stage').focus();await page.locator('#x').evaluate(el=>el.value='40');await page.locator('#y').evaluate(el=>{el.value='60';});
      await page.locator('#zoom').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input'));});await page.locator('#crop-apply').click();
      for(const [mode,width] of [['mobile',390],['desktop',1365]]){
        await page.locator('#mode').selectOption(mode);
        const frame=page.frameLocator('#layout-preview'),img=frame.locator(`[data-visual-slot="${slot}"] img`);
        await img.waitFor({state:'visible'});await page.waitForFunction(({s})=>{const d=document.querySelector('#layout-preview').contentDocument,i=d?.querySelector(`[data-visual-slot="${s}"] img`);return i?.complete&&i.naturalWidth>0&&i.alt==='Pratinjau fiktif'&&i.style.objectPosition==='40% 60%';},{s:slot});
        assert.equal(await frame.locator('html').evaluate(el=>el.clientWidth),width);
        assert.equal(await img.evaluate(el=>getComputedStyle(el).objectFit),'cover');
        if(mode==='mobile'){
          const axis=mimeType==='image/png'?'#y':'#x';
          await page.locator('#image-edit').click();await page.locator(axis).evaluate(el=>el.value='0');await page.locator('#zoom').dispatchEvent('input');await page.locator('#crop-apply').click();const left=await img.screenshot();
          await page.locator('#image-edit').click();await page.locator(axis).evaluate(el=>el.value='100');await page.locator('#zoom').dispatchEvent('input');await page.locator('#crop-apply').click();const right=await img.screenshot();assert.notDeepEqual(left,right);
          await page.locator('#image-edit').click();await page.locator(axis).evaluate((el,value)=>el.value=value,axis==='#x'?'40':'60');await page.locator('#zoom').dispatchEvent('input');await page.locator('#crop-apply').click();
        }
        await page.locator('.preview-wrap').evaluate(el=>{el.style.width='1400px';});
        await page.locator('#layout-preview').screenshot({path:`${screenshotDir}/${slot}-${width}.png`});
        await page.locator('.preview-wrap').evaluate(el=>{el.style.width='';});
        const reference=await uiBrowser.newPage({viewport:{width,height:900}});
        try{
          await reference.goto(slot==='welcome'?portalBase+'/':slot==='registration'?portalBase+'/register.html':mentorBase+'/mentor-account.html');
          if(slot==='login'||slot==='dashboard')await reference.evaluate(()=>{const home=document.createElement('a');home.href='#';home.className='btn';home.textContent='Beranda aplikasi';document.querySelector('#account-brand').append(home);});
          if(slot==='dashboard'){
            const fixture=await frame.locator('#account-dates').innerHTML(),groups=await frame.locator('#account-groups').innerHTML();
            await reference.evaluate(({fixture,groups})=>{document.body.classList.add('account-signed-in');document.querySelector('#account-login').hidden=true;document.querySelector('#account-profile').hidden=false;document.querySelector('#account-navigation').hidden=false;document.querySelector('#account-name').textContent='Mentor fiktif';document.querySelector('#account-dates').innerHTML=fixture;document.querySelector('#account-groups').innerHTML=groups;},{fixture,groups});
          }
          const metric=el=>{const box=el.getBoundingClientRect(),style=getComputedStyle(el);return {x:box.x,y:box.y,width:box.width,height:box.height,font:style.fontFamily,fit:getComputedStyle(el.querySelector('img')).objectFit};};
          const actual=reference.locator(`[data-visual-slot="${slot}"]`);await actual.locator('img').waitFor({state:'attached'});
          assert.deepEqual(await frame.locator(`[data-visual-slot="${slot}"]`).evaluate(metric),await actual.evaluate(metric));
          const heading={welcome:'#portal-title',login:'#account-login h1',registration:'main h1',dashboard:'#account-name'}[slot];
          const textMetric=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,size:s.fontSize,line:s.lineHeight};};
          assert.deepEqual(await frame.locator(heading).evaluate(textMetric),await reference.locator(heading).evaluate(textMetric));
          await reference.screenshot({path:`${screenshotDir}/${slot}-${width}-actual.png`});
        }finally{await reference.close();}
      }
      assert.equal((await publicRead(portalBase,slot)).status,404);
      if(slot==='login')for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${screenshotDir}/studio-portrait-${width}.png`,fullPage:true});}
      await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#save').disabled);
    }
    await selectSlot(page,'welcome');await page.waitForFunction(()=>!document.querySelector('#image').disabled);
    assert.equal(await page.locator('#reason,#confirm,#publish,#revert,#history').count(),0);
    await page.locator('#headline').fill('Selamat melayani bersama');await page.locator('#description').fill('Ruang pelayanan fiktif untuk semua.');
    await page.locator('#image').setInputFiles({name:'fiktif.png',mimeType:'image/png',buffer:Buffer.from(png(17),'base64')});await page.locator('#image-editor').waitFor({state:'visible'});await page.locator('#crop-apply').click();
    let firstBody='',retryBody='';const routePattern='**/api/portal/dispatch/api/visual/welcome/save';
    await page.route(routePattern,async route=>{firstBody=route.request().postData();await route.fetch();await route.abort();},{times:1});
    await page.locator('#save').click();await page.locator('#retry').waitFor({state:'visible'});
    page.on('request',req=>{if(req.url().endsWith('/api/visual/welcome/save'))retryBody=req.postData();});
    await page.locator('#retry').click();await page.getByText('Revisi slot: 1',{exact:true}).waitFor();assert.equal(retryBody,firstBody);
    await page.reload();await page.locator('#studio').waitFor({state:'visible'});assert.equal(await page.locator('#headline').inputValue(),'Selamat melayani bersama');
    const actual=await uiBrowser.newPage();await actual.goto(portalBase+'/');await actual.getByText('Selamat melayani bersama',{exact:true}).waitFor();await actual.close();
    await page.locator('#image-edit').click();await page.locator('#zoom').evaluate(el=>{el.value='1.8';el.dispatchEvent(new Event('input'));});await page.locator('#crop-apply').click();
    await page.locator('#description').fill('Kalimat baru fiktif.');await page.route('**/api/portal/dispatch/api/visual/welcome',route=>route.abort(),{times:1});await page.locator('#save').click();await page.getByText('Tersimpan. Muat ulang untuk melihat hasilnya.',{exact:true}).waitFor();await page.locator('#reload').click();await page.getByText('Revisi slot: 2',{exact:true}).waitFor();
    await page.reload();await page.locator('#studio').waitFor({state:'visible'});assert.equal(await page.locator('#zoom').inputValue(),'1.8');assert.equal(await page.locator('#description').inputValue(),'Kalimat baru fiktif.');
    const active=await (await publicRead(portalBase,'welcome')).json();assert.equal(active.metadata.zoom,1.8);assert.equal(active.metadata.description,'Kalimat baru fiktif.');
    const publishedPage=await uiBrowser.newPage();try{await publishedPage.goto(portalBase+'/');await publishedPage.waitForFunction(()=>document.querySelector('[data-visual-slot=welcome] img')?.style.transform==='scale(1.8)');await publishedPage.getByText('Kalimat baru fiktif.',{exact:true}).waitFor();}finally{await publishedPage.close();}
    for(const width of [360,390,768,1365]){await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:screenshotDir+'/studio-simple-'+width+'.png',fullPage:true});}
    await page.locator('#image').setInputFiles({name:'fiktif.png',mimeType:'image/png',buffer:Buffer.from(png(19),'base64')});
    await page.evaluate(()=>window.dispatchEvent(new Event('msa-session-ended')));assert.equal(await page.locator('#studio').isHidden(),true);assert.equal(await page.locator('#layout-preview').getAttribute('srcdoc'),'');assert.equal(await page.locator('#crop-image').getAttribute('src'),null);
    await page.reload();await page.locator('#studio').waitFor({state:'visible'});
    assert.equal((await f.change(manager.uid,{role:'superadmin',scope:{organizationId:null},status:'revoked',expectedRevision:2})).status,200);
    await page.locator('#reload').click();await page.getByText('Sesi berakhir. Masuk kembali.').waitFor();assert.equal(await page.locator('#studio').isHidden(),true);
  }finally{await uiBrowser.close();}
  const portalCall=(route,options={})=>fetch(portalBase+'/api/portal/dispatch/api/visual/login'+route,{...options,headers:{'X-MSA-Portal':'1',Origin:portalBase,Cookie:cookie,...options.headers}});
  assert.equal((await portalCall('')).status,401);
  assert.equal((await portalCall('/draft',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://evil.invalid'},body:JSON.stringify(upload(0,1))})).status,403);
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
  const login2=await fetch(portalBase+'/api/portal/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:portalBase,'X-MSA-Portal':'1'},body:JSON.stringify({username:backupManager.username,password:backupManager.password})});
  assert.equal(login2.status,200);const cookie2=login2.headers.get('set-cookie').split(';')[0];
  const lifecycleBrowser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});t.after(()=>lifecycleBrowser.close());
  const lifecyclePage=await lifecycleBrowser.newPage();await lifecyclePage.context().addCookies([{name:cookie2.split('=')[0],value:cookie2.split('=')[1],url:portalBase}]);
  await lifecyclePage.goto(portalBase+'/visual-studio.html');await lifecyclePage.locator('#studio').waitFor({state:'visible'});
  for(const slot of slots){
    await selectSlot(lifecyclePage,slot);await lifecyclePage.getByText('Pratinjau draf privat; belum diterbitkan.').waitFor();
    await lifecyclePage.waitForFunction(s=>{const img=document.querySelector('#layout-preview').contentDocument?.querySelector(`[data-visual-slot="${s}"] img`);return img?.alt==='Gambar fiktif'&&img.style.objectPosition==='40% 60%'&&img.complete&&img.naturalWidth>0;},slot);
    await lifecyclePage.reload();await lifecyclePage.locator('#studio').waitFor({state:'visible'});
    await selectSlot(lifecyclePage,slot);await lifecyclePage.getByText('Pratinjau draf privat; belum diterbitkan.').waitFor();
    await lifecyclePage.waitForFunction(s=>{const img=document.querySelector('#layout-preview').contentDocument?.querySelector(`[data-visual-slot="${s}"] img`);return img?.alt==='Gambar fiktif'&&img.complete&&img.naturalWidth>0;},slot);
  }
  assert.equal((await f.root.collection('msaVisualAudit').get()).size,5);
  const privateChunk=(await f.root.collection('msaVisualChunks').limit(1).get()).docs[0];
  const rawFirestore='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/demo-abc-attendance/databases/(default)/documents/'+privateChunk.ref.path;
  assert.equal((await fetch(rawFirestore)).status,403);
  assert.equal((await fetch(f.base+'/visual/published/login/'+privateChunk.id)).status,404);
  for(const slot of slots){
    assert.equal((await f.request(path(slot,'publish'),{mutation:command(1)})).status,200);
    assert.equal((await f.request(path(slot,'preview'))).status,404);
    for(const base of [f.base,mentorBase]){const info=await publicRead(base,slot);assert.equal(info.status,200);assert.equal(info.headers.get('cache-control'),'no-store');const value=await info.json();assert.equal(value.revision,2);const image=await publicRead(base,slot,2);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');}
    const missing='**/visual/published/'+slot+'/2';await lifecyclePage.route(missing,route=>route.fulfill({status:404}));
    await selectSlot(lifecyclePage,slot);await lifecyclePage.getByText('Tidak ada draf; menampilkan publikasi saat ini.').waitFor();
    await lifecyclePage.waitForFunction(s=>{const img=document.querySelector('#layout-preview').contentDocument?.querySelector(`[data-visual-slot="${s}"] img`);return img?.getAttribute('src')==='/assets/msa-visual-default.jpg'&&img.complete&&img.naturalWidth>0;},slot);
    await lifecyclePage.unroute(missing);await lifecyclePage.locator('#reload').click();
    await lifecyclePage.waitForFunction(s=>{const img=document.querySelector('#layout-preview').contentDocument?.querySelector(`[data-visual-slot="${s}"] img`);return img?.getAttribute('src')==='/visual/published/'+s+'/2'&&img.complete&&img.naturalWidth>0;},slot);
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
  await selectSlot(lifecyclePage,'login');
  await lifecyclePage.waitForFunction(()=>{const img=document.querySelector('#layout-preview').contentDocument?.querySelector('[data-visual-slot="login"] img');return img?.getAttribute('src')==='/visual/published/login/5'&&img.complete&&img.naturalWidth>0;});
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


test('Atomic visual save preserves authorization, copy-only fallback, idempotency and rollback',async t=>{
  const previous=Object.fromEntries(['ABC_MSA_VISUAL_V1A','ABC_MSA_A2_2','ABC_MSA_A2_3'].map(key=>[key,process.env[key]]));for(const key of Object.keys(previous))process.env[key]='1';t.after(()=>{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;});
  const f=await msaFixture(t,{namespace:'test-auth-pilot-'+randomUUID()}),visual=f.adminAuthentication.a1.visual;
  const path=(slot,action)=>'/api/visual/'+slot+'/'+action,publicRead=(base,slot,revision='')=>fetch(base+'/visual/published/'+slot+(revision?'/'+revision:''));
  const value={mutation:command(0),metadata:{alt:'',x:30,y:60,zoom:1.8,headline:'<img src=x onerror="window.injected=true">',description:'Kalimat fiktif.'}};
  assert.equal((await f.request(path('login','save'),value,'')).status,401);
  const member=await f.enroll();await f.change(member.uid,{role:'admin'});const memberSession=await f.signIn(member);
  assert.equal((await f.request(path('login','save'),value,memberSession.token)).status,403);
  assert.equal((await f.request(path('login','save'),value,f.token,{Origin:'http://untrusted.invalid'})).status,403);
  assert.equal((await f.request(path('login','save'),value)).status,200);
  assert.equal((await f.request(path('login','save'),value)).status,200);
  assert.equal((await f.request(path('login','save'),{...value,metadata:{...value.metadata,description:'Berbeda'}})).status,409);
  assert.equal((await f.request(path('login','save'),{...value,mutation:command(0)})).status,409);
  const publicValue=await (await publicRead(f.base,'login')).json();assert.equal(publicValue.src,null);assert.equal(publicValue.metadata.headline,value.metadata.headline);assert.equal((await publicRead(f.base,'login',1)).status,404);
  assert.equal((await f.root.collection('msaVisualAssets').get()).size,0);assert.equal((await f.root.collection('msaVisualAudit').get()).size,1);
  const mentor=createPrototypeServer({visual,mentorMode:true});await new Promise(resolve=>mentor.listen(0,'127.0.0.1',resolve));t.after(()=>mentor.close());const mentorBase='http://127.0.0.1:'+mentor.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});try{const page=await browser.newPage();assert.equal((await page.goto(mentorBase+'/mentor-account.html')).status(),200);await page.waitForFunction(expected=>document.querySelector('#account-login h1')?.textContent===expected,value.metadata.headline);assert.equal(await page.locator('#account-login h1 img').count(),0);assert.equal(await page.evaluate(()=>window.injected===true),false);}finally{await browser.close();}
  const imageValue={mutation:command(1),image:png(77),metadata:{alt:'Fiktif',x:30,y:60,zoom:2.25,headline:'Judul baru',description:'Kalimat baru'}};
  assert.equal((await f.request(path('login','save'),imageValue)).status,200);assert.equal((await f.request(path('login','save'),imageValue)).status,200);
  assert.equal((await (await publicRead(f.base,'login')).json()).metadata.zoom,2.25);assert.equal((await publicRead(f.base,'login',2)).status,200);
  const restarted=createMsaVisual({db:f.db,root:f.root,accounts:f.adminAuthentication.a1.accounts,enabled:visual.enabled});assert.equal((await restarted.publicRead('login')).metadata.headline,'Judul baru');
  for(const metadata of [{...imageValue.metadata,zoom:3.01},{...imageValue.metadata,headline:'a'.repeat(121)}])assert.equal((await f.request(path('login','save'),{...imageValue,mutation:command(2),metadata})).status,400);
  const failureDb={runTransaction:fn=>f.db.runTransaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='create')return(ref,data)=>{if(ref.path.includes('/msaVisualChunks/'))throw Error('Simulated storage failure');return target.create(ref,data);};const item=target[key];return typeof item==='function'?item.bind(target):item;}})))};
  const failed=createMsaVisual({db:failureDb,root:f.root,accounts:f.adminAuthentication.a1.accounts,enabled:visual.enabled});const principal=await f.adminAuthentication.authorize('Bearer '+f.token),actor={kind:'legacy',uid:principal.uid,revision:principal.revision,check:async()=>true};
  await assert.rejects(failed.save(actor,'login',{...imageValue,mutation:command(2)}));assert.equal((await f.root.collection('msaVisualSlots').doc('login').get()).data().revision,2);assert.equal((await f.root.collection('msaVisualAudit').get()).size,2);assert.equal((await f.root.collection('msaVisualAssets').get()).size,1);
  assert.equal((await f.request(path('login','revert'),{mutation:command(2),targetRevision:1})).status,200);assert.equal((await (await publicRead(f.base,'login')).json()).src,null);
  const reset={mutation:command(3),metadata:{alt:'',x:50,y:50,zoom:1,headline:'',description:''}};assert.equal((await f.request(path('login','save'),reset)).status,200);
  const cleanBrowser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu']});try{const page=await cleanBrowser.newPage();await page.goto(mentorBase+'/mentor-account.html');await page.getByRole('heading',{name:'Akun Mentor / Volunteer',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-visual-slot=login] img')?.complete);assert.equal(await page.locator('[data-visual-description=login]').textContent(),'Masuk dengan akun yang sudah ditinjau dan ditautkan oleh penanggung jawab.');}finally{await cleanBrowser.close();}
});
