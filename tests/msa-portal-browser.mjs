import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runPilot,stopPilot,PILOT_USERNAME,PIC_USERNAME,PILOT_PORTS} from '../local-auth-pilot.mjs';
import {portOccupied,waitFor} from '../local-demo.mjs';
import {fixtureNativeDialog} from './fixtures/msa-native-dialog.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Unified MSA portal: all authorized routes via clicks, history, reload and direct navigation, shared session and denial',{timeout:900000},async()=>{
  const password=randomBytes(24).toString('base64url'),picPassword=randomBytes(24).toString('base64url'),opened=[],messages=[];
  const nativeCredentials=new Map([[PILOT_USERNAME,{password}],[PIC_USERNAME,{password:picPassword}]]);
  const input=new PassThrough();let ready,reject;const prepared=new Promise((resolve,fail)=>{ready=resolve;reject=fail;});
  const running=runPilot({unified:true,input,output:new PassThrough(),setupPrompt:options=>fixtureNativeDialog({...options,...nativeCredentials.get(options.username)}),open:async options=>opened.push(options.adminOrigin+'/'),log:s=>{messages.push(s);console.log(s);},onReady:ready});running.then(()=>reject(Error('MSA belum siap')),reject);
  let browser;const navigation=[];
  try{
    const f=await prepared,origin=f.options.adminOrigin;
    await waitFor(async()=>opened.length===1);assert.deepEqual(opened,[origin+'/']);
    await runPilot({unified:true,open:async options=>opened.push(options.adminOrigin+'/'),log:()=>{}});assert.deepEqual(opened,[origin+'/',origin+'/']);
    const root=f.context.root,owner=(await root.collection('msaUsernames').doc(PILOT_USERNAME).get()).data().uid,pic=(await root.collection('msaUsernames').doc(PIC_USERNAME).get()).data().uid;
    assert.notEqual(owner,pic);assert.equal((await root.collection('msaCorePlatformGrants').doc(pic).get()).exists,false);assert.equal((await root.collection('msaAccounts').get()).size,0);
    const fixtureUsername='user-qa-'+randomUUID().slice(0,8),fixturePassword=randomBytes(24).toString('base64url');
    const fixtureAccount=await f.resources.auths[0].a1.accounts.provisionFixture({fictional:true,requestId:randomUUID(),username:fixtureUsername,fullName:'Pengguna Uji Fiktif',password:fixturePassword,phone:'081234567890'});
    await root.collection('msaAccounts').doc(fixtureAccount.uid).update({state:'active',identity:{state:'verified',actorUid:owner,verifiedAt:Date.now(),method:'fictional-fixture'},eligibleRoles:['pic','admin','volunteer','superadmin']});
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext({locale:'id-ID',viewport:{width:390,height:900}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const screenshots=path.resolve('.emulator-data/msa-portal-qa/screenshots');await mkdir(screenshots,{recursive:true});
    // The WPF component test fills its own controls with fictional input and
    // invokes the real Save handler. HTTP never receives a bootstrap password.
    for(const username of [PILOT_USERNAME,PIC_USERNAME]){
      await page.goto(origin+'/local-account-setup.html');await page.locator('#setup-username').selectOption(username);await page.locator('#setup-form button').click();
      await page.waitForFunction(()=>document.querySelector('#setup-status').textContent.includes('Kata sandi tersimpan'));
    }
    const capture=async(name,target=page)=>{for(const width of [360,390,768,1365]){await target.setViewportSize({width,height:900});await target.screenshot({path:path.join(screenshots,name+'-'+width+'.png'),fullPage:true});assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await target.locator('input:visible').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=16)));assert.deepEqual(await target.locator('button:visible,a:visible,summary:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,html:n.outerHTML}))),[]);}};
    const emptyDashboard=async name=>{
      const pattern='**/api/portal/dispatch/api/stage9b2/dashboard';
      await page.route(pattern,route=>route.fulfill({status:200,json:{organizations:[],horizonDays:90,upcoming:[],assigned:[],drafts:[]}}));
      await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelectorAll('#portal-schedule .msa-empty').length===3);await capture(name+'-empty');
      assert.equal(await page.locator('#portal-new').isVisible(),false);await page.unroute(pattern);await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelector('#portal-service-state').textContent.startsWith('Jadwal mendatang'));
    };
    const failedDashboard=async()=>{
      const pattern='**/api/portal/dispatch/api/stage9b2/dashboard';
      await page.route(pattern,route=>route.fulfill({status:503,json:{error:'Koneksi uji tidak tersedia.'}}));
      await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelector('#portal-service-state').textContent.includes('Jadwal belum dapat dimuat'));
      assert.equal(await page.locator('#portal-schedule article').count(),0);assert.match(await page.locator('#portal-service-state').textContent(),/Periksa ulang izin/);
      await page.unroute(pattern);await page.locator('#portal-refresh').click();await page.waitForFunction(()=>document.querySelector('#portal-service-state').textContent.startsWith('Jadwal mendatang'));
    };
    const serviceScreens=async role=>{
      await page.goto(origin+'/msa-events.html#kalender');await page.waitForFunction(()=>document.querySelector('#calendar-result').textContent.includes('pelayanan sesuai izin'));
      assert.equal(await page.locator('#calendar-show').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#calendar-range').textContent(),/–/);await capture('phase3-'+role+'-calendar');
      const calendarPattern='**/api/portal/dispatch/api/stage9b1/calendar?*';
      await page.route(calendarPattern,route=>route.fulfill({status:200,json:{events:[]}}));await page.locator('#calendar-next').click();await page.waitForFunction(()=>document.querySelector('#calendar-result').textContent.startsWith('Belum ada'));await capture('phase3-'+role+'-empty');await page.unroute(calendarPattern);
      await page.route(calendarPattern,route=>route.fulfill({status:503,json:{error:'Koneksi uji tidak tersedia.'}}));await page.locator('#calendar-prev').click();await page.waitForFunction(()=>document.querySelector('#calendar-result').textContent.includes('belum dapat dimuat'));assert.equal(await page.locator('.calendar-card').count(),0);await page.unroute(calendarPattern);
      await page.locator('#calendar-today').click();await page.waitForFunction(()=>document.querySelector('#calendar-result').textContent.includes('pelayanan sesuai izin'));
      await page.locator('[data-calendar-event]').first().click();await page.waitForSelector('#calendar-detail:not([hidden])');await capture('phase3-'+role+'-detail');
      assert.equal(await page.locator('#calendar-detail').evaluate(n=>n===document.activeElement),true);await page.locator('#calendar-export-duration').fill('30');const download=page.waitForEvent('download');await page.locator('#calendar-export-form button[value=ics]').click();assert.match((await download).suggestedFilename(),/\.ics$/);await page.locator('#calendar-back').click();await page.waitForFunction(()=>document.querySelector('#calendar-result').textContent.includes('pelayanan sesuai izin'));
      await page.goto(origin+'/msa-events.html#baru');await page.waitForSelector('#event-form:not([hidden])');await page.waitForFunction(()=>document.activeElement?.id==='draft-name');
      assert.equal(await page.locator('#draft-show').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#recurrence-frequency').isVisible(),true);await capture('phase3-'+role+'-form');
      await page.locator('#event-cancel').click();await page.goto(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');
    };
    const coreScreens=async role=>{
      await page.goto(origin+'/msa-core.html');await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent.length>0);
      const ready=()=>page.waitForFunction(()=>!document.querySelector('#core-organization').hidden&&document.querySelector('#core-workspace').getAttribute('aria-busy')==='false');await ready();
      const select=page.locator('#core-org'),options=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
      if(role==='superadmin'){
        assert.ok(options.length>=2);const emptyPattern='**/api/portal/dispatch/api/stage8/organizations/fictional-yayasan-abc/programs';
        await page.route(emptyPattern,async route=>{const response=await route.fetch(),body=await response.json();await route.fulfill({response,json:{...body,programs:[]}});});
        await select.selectOption('fictional-yayasan-abc');await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent.includes('Yayasan'));
        await ready();assert.match(await page.locator('#core-program-list').textContent(),/Belum ada program/);await capture('phase3b-owner-empty');await page.unroute(emptyPattern);
        await page.locator('#core-refresh').click();await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent.includes('Yayasan'));assert.equal(await select.inputValue(),'fictional-yayasan-abc');
        await select.selectOption('fictional-abc-movement');await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent==='ABC Movement');await ready();assert.ok(await page.locator('#core-program-list li').count()>0);await capture('phase3b-owner');
        await page.locator('#core-program-name').fill('Program uji fiktif');await page.locator('#core-reason').fill('Alasan pengujian fiktif');await page.locator('#core-program-form button').click();assert.equal(await page.locator('#core-cancel').evaluate(n=>n===document.activeElement),true);assert.equal(await page.getByRole('dialog',{name:'Tambahkan program?'}).isVisible(),true);await page.locator('#core-cancel').click();assert.equal(await page.locator('#core-program-form button').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('#core-program-name').inputValue(),'Program uji fiktif');
        const pattern='**/api/portal/dispatch/api/stage8/organizations/*/programs';await page.route(pattern,route=>route.fulfill({status:503,json:{error:'Gangguan uji fiktif'}}));await page.locator('#core-refresh').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Gangguan uji'));assert.equal(await page.locator('#core-organization').isVisible(),false);await page.unroute(pattern);await page.locator('#core-refresh').click();await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent==='ABC Movement');
      }else{
        assert.equal(options.length,1);assert.equal(await page.locator('#core-program-form').isVisible(),false);assert.match(await page.locator('#core-program-access').textContent(),/baca saja/);assert.match(await page.locator('#core-member-list').textContent(),/tidak memiliki izin/);await capture('phase3b-admin');
      }
      await page.reload();await page.waitForFunction(()=>document.querySelector('#core-org-name').textContent.length>0);assert.equal(await page.locator('input[type=password]:visible').count(),0);
      await page.goto(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');
    };
    const userScreens=async()=>{
      await page.goto(origin+'/a1.html');await page.waitForSelector('[data-user="'+fixtureAccount.uid+'"]');await page.waitForFunction(()=>document.querySelector('#msa-management').getAttribute('aria-busy')==='false');await capture('phase3b2-users');
      await page.locator('[data-user="'+fixtureAccount.uid+'"]').click();assert.equal(await page.locator('#msa-detail').evaluate(n=>n===document.activeElement),true);await capture('phase3b2-detail');
      await page.locator('#msa-kind').selectOption('state');await page.locator('#msa-account-state').selectOption('suspended');await page.locator('#msa-reason').fill('Tinjauan fiktif untuk uji pembatalan');await page.locator('#msa-change button').click();
      assert.equal(await page.locator('#msa-cancel').evaluate(n=>n===document.activeElement),true);await capture('phase3b2-confirm');await page.locator('#msa-cancel').click();assert.equal(await page.locator('#msa-change button').evaluate(n=>n===document.activeElement),true);
      assert.equal((await root.collection('msaAccounts').doc(fixtureAccount.uid).get()).data().state,'active');
      await page.locator('#msa-query').fill('tidak-ada-pengguna-uji');await page.locator('#msa-search button').click();await page.waitForFunction(()=>document.querySelector('#msa-list').textContent.includes('Tidak ada akun'));await capture('phase3b2-empty');
      const pattern='**/api/portal/dispatch/api/a1/accounts?*';await page.route(pattern,route=>route.fulfill({status:503,json:{error:'Gangguan uji fiktif'}}));await page.locator('#msa-search button').click();await page.waitForFunction(()=>document.querySelector('#msa-feedback').textContent.includes('Gangguan uji'));await capture('phase3b2-error');await page.unroute(pattern);
      await page.locator('#msa-query').fill(fixtureUsername);await page.locator('#msa-search button').click();await page.waitForSelector('[data-user="'+fixtureAccount.uid+'"]');await page.reload();await page.waitForSelector('[data-user="'+fixtureAccount.uid+'"]');assert.equal(await page.locator('input[type=password]:visible').count(),0);
      await page.locator('#msa-logout').click();await page.waitForURL(origin+'/');await page.waitForSelector('#portal-login:not([hidden])');await login(PILOT_USERNAME,password);
    };
    const login=async(username,value)=>{await page.goto(origin+'/');await page.locator('#portal-username').fill(username);await page.locator('#portal-password').fill(value);await page.locator('#portal-login button[type=submit]').click();await page.waitForSelector('#portal-workspace:not([hidden])');};
    await page.goto(origin+'/');assert.equal(await page.locator('select').count(),0);await page.waitForFunction(()=>document.querySelector('#portal-welcome .msa-visual img')?.naturalWidth>0);assert.equal(await page.locator('#portal-welcome a[href="/register.html"]').isVisible(),true);assert.equal(await page.locator('#portal-mentor-entry a').isVisible(),true);await page.locator('#portal-username').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#portal-password').evaluate(n=>n===document.activeElement),true);await page.locator('#portal-show').click();assert.equal(await page.locator('#portal-password').getAttribute('type'),'text');await capture('login');
    await page.locator('#portal-username').fill(PILOT_USERNAME);await page.locator('#portal-password').fill('incorrect-fictional-password');await page.locator('#portal-login button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#portal-feedback').textContent.includes('tidak valid'));assert.equal(await page.locator('#portal-workspace').isVisible(),false);
    assert.equal(await page.locator('#portal-title').textContent(),'ABC Ministry Service App');assert.equal(await page.locator('#portal-login input').count(),2);
    await login(PILOT_USERNAME,password);assert.equal(await page.locator('#msa-navigation .msa-nav-group a').count(),7);await page.goto(origin+'/visual-studio.html');await page.locator('#studio').waitFor({state:'visible'});await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelector('#portal-service-state').textContent.startsWith('Jadwal mendatang'));await capture('superadmin');await emptyDashboard('superadmin');await failedDashboard();
    assert.equal(await page.locator('#portal-eyebrow').textContent(),'Superadmin');assert.equal(await page.locator('#portal-new').isVisible(),true);
    await page.setViewportSize({width:390,height:900});assert.equal(await page.locator('#msa-navigation .msa-nav-primary a:visible').count(),3);assert.equal(await page.locator('#modul summary').isVisible(),true);
    const api=async(route,body)=>page.evaluate(async({route,body})=>{const {msaFetch}=await import('/msa-session.js');const r=await msaFetch(route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};},{route,body});
    const rotatedPassword=randomBytes(24).toString('base64url');
    const changeOwner=async(next,current)=>{
      nativeCredentials.set(PILOT_USERNAME,{password:next,currentPassword:current});
      await page.goto(origin+'/local-account-setup.html');await page.locator('#setup-form button').click();await page.waitForFunction(()=>document.querySelector('#setup-status').textContent.includes('Kata sandi tersimpan'));
    };
    const profile=await api('/api/portal/session');await userScreens();await coreScreens('superadmin');await serviceScreens('superadmin');assert.equal(profile.status,200);assert.equal(profile.body.token,undefined);
    const verifyDestination=async route=>{
      await page.waitForURL(origin+route);await page.waitForSelector('#msa-navigation');
      if(route==='/username.html'){
        await page.waitForSelector('#admin-root[data-phase=active]');await page.locator('[data-admin-tab=devices]').click();
        await page.waitForSelector('#admin-devices[data-state=ready]');assert.ok(await page.locator('#device-school option').count()>1);
      }else await page.waitForFunction(route=>{
        const text=id=>document.getElementById(id)?.textContent??'';
        if(route==='/msa-events.html')return text('dashboard-result').startsWith('Jadwal mendatang')&&document.querySelectorAll('#dashboard-content>section').length===3;
        if(route==='/msa-core.html')return text('core-org-name').length>0&&document.querySelectorAll('#core-program option').length>0;
        if(route==='/a1.html')return document.querySelector('#msa-list')?.childElementCount>0;
        if(route==='/identity-review.html')return document.querySelector('#queue')?.childElementCount>0;
        if(route==='/account-recovery.html')return document.querySelector('#recovery-queue')?.childElementCount>0&&!document.querySelector('#review-workspace').hidden;
        if(route==='/migration-readiness.html')return text('migration-verdict').startsWith('Cutover produksi:')&&text('migration-summary').length>0;
        if(route==='/visual-studio.html')return !document.querySelector('#studio')?.hidden&&text('revision').includes('Revisi slot:');
        throw Error('Missing destination-content assertion: '+route);
      },route);
      assert.equal(new URL(page.url()).origin,origin);assert.equal(await page.locator('input[type=password]:visible,input[type=email]:visible').count(),0);
      assert.equal(await page.locator('body').getAttribute('data-msa-portal'),'true');
    };
    const auditNavigation=async profile=>{
      const cookieBefore=(await context.cookies()).find(c=>c.name.startsWith('msa_session_'));
      const loginRequests=[];const track=r=>{if(r.url().endsWith('/api/portal/login')||r.url().endsWith('/api/admin/login')||r.url().endsWith('/api/a1/login'))loginRequests.push(new URL(r.url()).pathname);};page.on('request',track);
      try{for(const module of profile.modules){
        const route=module.href;console.log('NAVIGATION '+profile.role+' '+route);
        const checked=async source=>{await verifyDestination(route);navigation.push({role:profile.role,route,source,url:page.url(),origin:new URL(page.url()).origin,contentLoaded:true});};
        await page.goto(origin+'/');await page.waitForSelector('#msa-navigation');await page.locator('#msa-navigation a[href="'+route+'"]').first().click();await checked('navigation');
        if(route===profile.modules[0].href){
          await page.reload();await checked('refresh');await page.locator('#msa-navigation a[href="/"]').click();await page.waitForSelector('#msa-navigation');
          await page.goBack();await checked('back');await page.goForward();await page.waitForSelector('#msa-navigation');
        }
        await page.goto(origin+route);await checked('direct');
      }}finally{page.off('request',track);}
      assert.deepEqual(loginRequests,[]);assert.equal((await api('/api/portal/session')).body.uid,profile.uid);
      const cookieAfter=(await context.cookies()).find(c=>c.name===cookieBefore.name);assert.equal(cookieAfter.value,cookieBefore.value);assert.equal(cookieAfter.httpOnly,true);assert.equal(cookieAfter.sameSite,'Strict');assert.equal(cookieAfter.path,'/api/portal/');
      await writeFile(path.resolve('.emulator-data/msa-portal-qa/navigation.json'),JSON.stringify(navigation,null,2));
    };
    const cookie=(await context.cookies()).find(c=>c.name.startsWith('msa_session_'));assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Strict');assert.equal(await page.evaluate(()=>document.cookie.includes('msa_session_')),false);
    assert.equal((await context.cookies(f.options.mentorOrigin+'/')).some(c=>c.name===cookie.name),false);
    await page.setViewportSize({width:1365,height:900});await auditNavigation(profile.body);
    for(const [route,workspace] of [['/msa-events.html','#event-workspace'],['/msa-core.html','#core-workspace'],['/a1.html','#msa-management'],['/identity-review.html','#review-workspace'],['/account-recovery.html','#review-workspace'],['/migration-readiness.html','#migration-report'],['/username.html','[data-phase=active]']]){
      console.log('SESSION NAV '+route);await page.goto(origin+route);assert.equal(await page.locator('input[type=password]:visible').count(),0);await page.waitForSelector(workspace+':not([hidden])');assert.equal((await api('/api/portal/session')).body.uid,owner);
      await page.waitForSelector('#msa-navigation');
      if(['/msa-core.html','/a1.html','/username.html'].includes(route))await capture(route.includes('core')?'organizations':route.includes('a1')?'users':'devices');
    }
    await changeOwner(rotatedPassword,password);await page.goto(origin+'/');assert.equal((await api('/api/portal/session')).status,401);
    assert.equal((await api('/api/portal/login',{username:PILOT_USERNAME,password})).status,401);await login(PILOT_USERNAME,rotatedPassword);
    await page.goto(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');await page.locator('#portal-logout').click();await page.waitForSelector('#portal-login:not([hidden])');assert.equal((await api('/api/stage8/organizations')).status,401);
    await login(PIC_USERNAME,picPassword);assert.equal(await page.locator('#msa-navigation a[href="/a1.html"]').count(),0);assert.equal(await page.locator('#msa-navigation a[href="/migration-readiness.html"]').count(),0);assert.equal(await page.locator('#msa-navigation a[href="/visual-studio.html"]').count(),0);assert.equal((await page.evaluate(async()=>{const {msaFetch}=await import('/msa-session.js');return (await msaFetch('/api/visual/welcome')).status;})),403);await page.waitForFunction(()=>document.querySelector('#portal-service-state').textContent.startsWith('Jadwal mendatang'));await capture('pic');await emptyDashboard('pic');
    await coreScreens('admin');await serviceScreens('admin');assert.equal(await page.locator('#portal-eyebrow').textContent(),'Admin');assert.equal(await page.locator('#msa-navigation a[href="/a1.html"]').count(),0);
    await page.setViewportSize({width:1365,height:900});await auditNavigation((await api('/api/portal/session')).body);
    for(const route of ['/a1.html','/identity-review.html','/migration-readiness.html']){await page.goto(origin+route);await page.waitForURL(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');assert.equal(await page.locator('#msa-navigation a[href="'+route+'"]').count(),0);}
    await page.goto(origin+'/msa-events.html#kalender');await page.waitForSelector('#calendar-workspace:not([hidden])');await page.waitForFunction(()=>!document.querySelector('#calendar-result').textContent.includes('Memuat'));await capture('calendar');
    await page.goto(origin+'/msa-events.html#baru');await page.waitForSelector('#event-form:not([hidden])');assert.equal(await page.locator('#draft-name').evaluate(n=>n===document.activeElement),true);await capture('new-service');
    await page.locator('#event-cancel').click();
    await page.setViewportSize({width:390,height:900});await page.goto(origin+'/');await page.waitForSelector('#portal-workspace:not([hidden])');
    await page.locator('#modul summary').click();assert.equal(await page.locator('#msa-navigation a[href="/msa-core.html"]').isVisible(),true);
    await page.screenshot({path:path.join(screenshots,'module-menu-390.png')});await page.locator('#msa-navigation a[href="/msa-core.html"]').focus();assert.equal(await page.locator('#msa-navigation a[href="/msa-core.html"]').evaluate(n=>n===document.activeElement),true);await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#msa-navigation a[href="/msa-core.html"]').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#modul summary').click();
    await page.waitForFunction(()=>document.querySelector('#portal-schedule a[href*="event="]'));
    await page.locator('#portal-schedule a[href*="event="]').first().click();await page.waitForSelector('#calendar-detail:not([hidden])');assert.equal(await page.locator('#calendar-detail h2').textContent(),'Pelayanan PIC Fiktif');assert.equal(await page.locator('#calendar-publish').count(),0);
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
    await page.goto(origin+'/msa-events.html');await page.waitForFunction(()=>document.querySelector('#dashboard-result').textContent.startsWith('Jadwal mendatang'));await page.locator('#draft-show').click();await page.waitForSelector('[data-event="'+draftId+'"]');await page.locator('[data-event="'+draftId+'"]').click();await page.waitForSelector('#event-edit');await page.locator('#event-edit').click();await page.waitForSelector('#event-form:not([hidden])');await capture('phase3-admin-edit');await page.locator('#draft-venue').fill('Aula Uji Diperbarui');await page.locator('#event-save').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('tersimpan'));assert.match(await page.locator('#event-detail').textContent(),/Aula Uji Diperbarui/);
    await page.goto(origin+'/msa-events.html');await page.waitForFunction(()=>document.querySelector('#dashboard-result').textContent.startsWith('Jadwal mendatang'));await page.waitForSelector('[data-dashboard-event="fictional-pic-upcoming"]');await capture('pic-services');
    await page.reload();await page.waitForSelector('#event-workspace:not([hidden])');assert.equal((await api('/api/portal/session')).body.uid,pic);assert.ok((await api('/api/stage9b2/dashboard')).body.assigned?.length>0);
    await root.collection('adminAccounts').doc(pic).update({state:'disabled',revision:2});assert.equal((await api('/api/portal/session')).status,401);assert.equal((await api('/api/stage9a/organizations')).status,401);
    await page.goto(origin+'/msa-core.html');await page.waitForURL(origin+'/');await page.waitForSelector('#portal-login:not([hidden])');
    const mentorPage=await context.newPage();mentorPage.on('pageerror',e=>errors.push(e.message));await mentorPage.goto(f.options.mentorOrigin+'/');await mentorPage.waitForSelector('#account-username');
    assert.equal(await mentorPage.locator('.pilot-nav').count(),0);assert.equal(await mentorPage.locator('#account-login h1').textContent(),'ABC Ministry Service App');assert.equal(await mentorPage.locator('#account-navigation').isVisible(),false);assert.equal(await mentorPage.locator('a[href*="a1.html"]').count(),0);await capture('mentor-login',mentorPage);await mentorPage.close();
    // UI-only empty-profile case. This stub gives no server admission/grants;
    // all actual cookie, role and device boundaries above use the real emulator.
    await page.route('**/api/portal/session',route=>route.fulfill({status:200,json:{uid:'fictional-moduleless',username:'fictional-mentor',role:'volunteer',modules:[],expiresAt:Date.now()+60000}}));
    await page.goto(origin+'/');await page.waitForSelector('#portal-personal:not([hidden])');assert.equal(await page.locator('#portal-personal a').getAttribute('href'),f.options.mentorOrigin+'/');assert.equal(await page.locator('#msa-navigation .msa-nav-group a').count(),0);assert.equal(await page.locator('#msa-navigation a[href="/a1.html"]').count(),0);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/token|password|session/i.test(k))),false);assert.ok(messages.every(s=>!s.includes(password)&&!s.includes(picPassword)&&!s.includes(rotatedPassword)));
    console.log('PASS unified MSA portal screenshots: '+screenshots);
  }finally{await browser?.close();await stopPilot({log:()=>{}});await running;await waitFor(async()=>!(await Promise.all(PILOT_PORTS.map(portOccupied))).some(Boolean),{timeout:10000});}
});
