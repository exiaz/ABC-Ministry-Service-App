import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource} from './device-management-source.mjs';
import {initializeOwner} from '../../backend/admin-accounts.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Superadmin creates/manages PIC in mobile Chrome; PIC login has scoped devices and no account management',{timeout:120000},async t=>{
  let browser;t.after(async()=>{await browser?.close();});
  const original=process.env.ABC_FIRESTORE_NAMESPACE,{source,grants}=deviceManagementSource(),c=await emulatorFixture({source});process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;
  const f=await adminLoginFixture(t,{pairing:c.pairing});
  t.after(async()=>{const app=initializeApp({projectId:'demo-abc-attendance'},'cleanup-ui-'+randomUUID());try{const rows=await c.root.collection('adminAccounts').where('role','==','pic').get();if(rows.size)await getAuth(app).deleteUsers(rows.docs.map(d=>d.id));}finally{await deleteApp(app);await c.close();if(original===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=original;}});
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});await initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const ownerContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'}),picContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'});
  const owner=await ownerContext.newPage(),pic=await picContext.newPage(),errors=[];for(const page of [owner,pic])page.on('pageerror',e=>errors.push(e.name));
  const login=async(page,email,password)=>{await page.goto(f.base);assert.equal(await page.locator('#admin-email').inputValue(),'');assert.equal((await page.locator('#admin-root').innerText()).includes(f.email),false);await page.locator('#admin-email').fill(email);await page.locator('#admin-password').fill(password);await page.locator('#admin-login button[type=submit]').click();await page.waitForSelector('#admin-root[data-phase=active]');};
  try{
  await login(owner,f.email,f.password);await owner.locator('[data-admin-tab=accounts]').click();await owner.waitForSelector('#account-form');
  assert.equal(await owner.locator('#account-form input[name=username],#account-form input[name=phone],#account-form input[name=fullName]').count(),0);
  for(const name of ['email','password']){const input=owner.locator('#account-form input[name='+name+']'),id=await input.getAttribute('id');assert.ok(id);assert.equal(await owner.locator('label[for="'+id+'"]').count(),1);assert.ok(await input.getAttribute('aria-describedby'));}
  await mkdir('screenshots',{recursive:true});for(const width of [360,390,768,1365]){
    await owner.setViewportSize({width,height:900});assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const controls=await owner.locator('#admin-accounts .account-option').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,width:n.querySelector('input').getBoundingClientRect().width})));assert.ok(controls.every(c=>c.height>=44&&c.width>=20));
    const boxes=await owner.locator('.account-form-grid>.account-card').evaluateAll(nodes=>nodes.slice(0,2).map(n=>({top:n.getBoundingClientRect().top,left:n.getBoundingClientRect().left})));
    assert.equal(width>900?Math.abs(boxes[0].top-boxes[1].top)<2:boxes[1].top>boxes[0].top,true);
    const sizes=await owner.locator('#account-email,#account-password').evaluateAll(nodes=>nodes.map(n=>parseFloat(getComputedStyle(n).fontSize)));assert.ok(sizes.every(size=>size>=16));
    await owner.evaluate(()=>scrollTo(0,0));await owner.screenshot({path:'screenshots/pic-account-create-'+width+'.png',fullPage:true});
  }await owner.setViewportSize({width:390,height:844});
  const email='pic.'+randomUUID().slice(0,8)+'@abc-attendance.test',password=randomBytes(20).toString('base64url');
  await owner.locator('#account-email').fill('pic@example.com');await owner.locator('#account-password').fill(password);await owner.locator('#account-form button[type=submit]').click();assert.match(await owner.locator('#account-email').evaluate(n=>n.validationMessage),/email fiktif/);
  await owner.locator('#account-form input[name=email]').fill(email);await owner.locator('#account-form input[name=password]').fill(password);
  await owner.locator('#account-form button[type=submit]').click();assert.equal(await owner.locator('#account-scopes').getAttribute('aria-invalid'),'true');assert.equal(await owner.locator('#account-feedback').evaluate(n=>n===document.activeElement),true);assert.equal(await owner.locator('#account-email').inputValue(),email);assert.equal(await owner.locator('#account-password').inputValue(),password);assert.equal((await c.root.collection('adminAccounts').where('role','==','pic').get()).size,0);
  await owner.locator('input[name=action][value="pairing:read"]').uncheck();await owner.locator('#account-form button[type=submit]').click();assert.equal(await owner.locator('#account-actions-error').isVisible(),true);await owner.locator('input[name=action][value="pairing:read"]').check();
  await owner.locator('input[name=action][value="pairing:issue"]').check();await owner.locator('#account-form label').filter({hasText:'Hagai'}).locator('input').check();
  await owner.locator('#account-password').fill('short');await owner.locator('#account-form button[type=submit]').click();assert.equal(await owner.locator('#account-password').evaluate(n=>n.checkValidity()),false);await owner.locator('#account-password').fill(password);
  await owner.locator('#account-email').focus();await owner.keyboard.press('Tab');assert.equal(await owner.locator('#account-password').evaluate(n=>n===document.activeElement),true);assert.notEqual(await owner.locator('#account-password').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await owner.locator('#account-form button[type=submit]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Akun PIC tersimpan.'));
  assert.equal(await owner.locator('input[name=password]').inputValue(),'');
  await login(pic,email,password);assert.equal(await pic.locator('[data-admin-tab=accounts]').count(),0);
  await pic.locator('[data-admin-tab=schedule]').click();await pic.waitForSelector('#admin-calendar[data-state=ready]');await pic.locator('#service-school').selectOption('s1');await pic.locator('#service-date').fill('2026-11-01');await pic.locator('#service-date').press('Tab');assert.equal(await pic.locator('[data-calendar-field=group]').count(),1);await pic.locator('[data-calendar-field=group]').check();await pic.locator('#admin-service-form button[type=submit]').click();await pic.waitForFunction(()=>document.querySelector('#admin-calendar')?.textContent.includes('Jadwal tersimpan.'));const special=(await c.root.collection('serviceSessions').where('date','==','2026-11-01').get()).docs[0].id;
  await mkdir('screenshots',{recursive:true});for(const width of [360,390,1365]){await pic.setViewportSize({width,height:900});assert.equal(await pic.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(width!==360)await pic.screenshot({path:'screenshots/calendar-pic-'+(width===390?'mobile':'desktop')+'.png',fullPage:true});}await pic.setViewportSize({width:390,height:844});
  await pic.locator('[data-admin-tab=devices]').click();await pic.waitForSelector('#admin-devices[data-state=ready]');
  assert.equal(await pic.locator('#device-school option').count(),2);
  await pic.locator('#device-school').selectOption('s1');const visits=await pic.locator('#device-visit option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));assert.equal(visits.length,2);
  await pic.locator('#device-visit').selectOption(special);assert.equal(await pic.locator('[data-device-field=group]').count(),1);
  await pic.locator('[data-device-field=group]').check();const issuedResponse=pic.waitForResponse(response=>response.url().endsWith('/api/admin/activation-codes')&&response.request().method()==='POST');await pic.locator('#device-issue-form button[type=submit]').click();const issued=await issuedResponse;assert.equal(issued.status(),201);const metadata=await issued.json();assert.equal(metadata.codes.length,1);assert.equal(metadata.codes[0].expiresAt-metadata.codes[0].createdAt,172800000);assert.equal(metadata.codes[0].assignment.groupId,'g13');assert.equal(metadata.codes[0].assignment.serviceDate,'2026-11-01');await pic.waitForSelector('[data-activation-code]');assert.equal(await pic.locator('#device-issue-form button[type=submit]').isDisabled(),true);await pic.locator('[data-activation=hide]').click();
  const storage=await owner.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage}));assert.equal(storage.includes(password),false);
  await owner.locator('.device-card').filter({hasText:email}).locator('[data-account=edit]').click();await owner.locator('#account-form select[name=state]').selectOption('disabled');
  await owner.screenshot({path:'screenshots/pic-account-edit-mobile.png',fullPage:true});assert.equal(await owner.locator('#account-password').count(),0);
  owner.once('dialog',dialog=>dialog.accept());await owner.locator('#account-form button[type=submit]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Akun PIC tersimpan.'));
  await pic.locator('[data-admin=verify]').click();await pic.waitForSelector('#admin-root[data-phase=expired]');
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await owner.route('**/api/admin/accounts',route=>route.abort());await owner.locator('[data-account=reload]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Server belum dapat dihubungi.'));
  assert.equal(await owner.locator('#account-form').count(),0);assert.deepEqual(errors,[]);
  }catch(error){t.diagnostic('UI check: '+error.message);throw error;}
});
