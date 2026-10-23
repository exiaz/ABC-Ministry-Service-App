import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource} from './device-management-source.mjs';
import {initializeOwner} from '../../backend/admin-accounts.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Superadmin creates/manages PIC in mobile Chrome; PIC login has scoped devices and no account management',{timeout:90000},async t=>{
  let browser;t.after(async()=>{await browser?.close();});
  const original=process.env.ABC_FIRESTORE_NAMESPACE,{source,grants}=deviceManagementSource(),c=await emulatorFixture({source});process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;
  const f=await adminLoginFixture(t,{pairing:c.pairing});
  t.after(async()=>{const app=initializeApp({projectId:'demo-abc-attendance'},'cleanup-ui-'+randomUUID());try{const rows=await c.root.collection('adminAccounts').where('role','==','pic').get();if(rows.size)await getAuth(app).deleteUsers(rows.docs.map(d=>d.id));}finally{await deleteApp(app);await c.close();if(original===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=original;}});
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});await initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const ownerContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'}),picContext=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID'});
  const owner=await ownerContext.newPage(),pic=await picContext.newPage(),errors=[];for(const page of [owner,pic])page.on('pageerror',e=>errors.push(e.name));
  const login=async(page,email,password)=>{await page.goto(f.base);await page.locator('#admin-email').fill(email);await page.locator('#admin-password').fill(password);await page.locator('#admin-login button[type=submit]').click();await page.waitForSelector('#admin-root[data-phase=active]');};
  try{
  await login(owner,f.email,f.password);await owner.locator('[data-admin-tab=accounts]').click();await owner.waitForSelector('#account-form');
  const email='pic.'+randomUUID().slice(0,8)+'@abc-attendance.test',password=randomBytes(20).toString('base64url');
  await owner.locator('#account-form input[name=email]').fill(email);await owner.locator('#account-form input[name=password]').fill(password);
  await owner.locator('input[name=action][value="pairing:issue"]').check();await owner.locator('#account-form label').filter({hasText:'Hagai'}).locator('input').check();
  await owner.locator('#account-form button[type=submit]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Akun PIC tersimpan.'));
  assert.equal(await owner.locator('input[name=password]').inputValue(),'');
  await login(pic,email,password);assert.equal(await pic.locator('[data-admin-tab=accounts]').count(),0);
  await pic.locator('[data-admin-tab=devices]').click();await pic.waitForSelector('#admin-devices[data-state=ready]');
  assert.equal(await pic.locator('#device-school option').count(),2);
  await pic.locator('#device-school').selectOption('s1');const visits=await pic.locator('#device-visit option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));assert.equal(visits.length,1);
  await pic.locator('#device-visit').selectOption(visits[0]);assert.equal(await pic.locator('[data-device-field=group]').count(),1);
  const storage=await owner.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage}));assert.equal(storage.includes(password),false);
  await owner.locator('.device-card').filter({hasText:email}).locator('[data-account=edit]').click();await owner.locator('#account-form select[name=state]').selectOption('disabled');
  owner.once('dialog',dialog=>dialog.accept());await owner.locator('#account-form button[type=submit]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Akun PIC tersimpan.'));
  await pic.locator('[data-admin=verify]').click();await pic.waitForSelector('#admin-root[data-phase=expired]');
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await owner.route('**/api/admin/accounts',route=>route.abort());await owner.locator('[data-account=reload]').click();await owner.waitForFunction(()=>document.querySelector('#admin-accounts')?.textContent.includes('Server belum dapat dihubungi.'));
  assert.equal(await owner.locator('#account-form').count(),0);assert.deepEqual(errors,[]);
  }catch(error){t.diagnostic('UI check: '+error.message);throw error;}
});
