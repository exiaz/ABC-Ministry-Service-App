import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import net from 'node:net';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {activationFixture,hagai} from './activation-fixture.mjs';
import {createPrototypeServer} from '../../server.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}

test('Admin and paired Mentor in Chrome assign, switch, edit and revoke backup with separate groups and mobile layouts',{timeout:90000},async t=>{
  const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const origin='http://127.0.0.1:'+port,f=await activationFixture(t,{mentorOrigin:origin});f.setTime(new Date().toISOString());const today=new Date(f.now()+7*3600000).toISOString().slice(0,10);
  await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({date:today});
  for(const groupId of ['g1','g2'])await f.root.collection('students').doc('fictional-'+groupId).create({id:'fictional-'+groupId,schoolId:'s1',groupId,name:'Siswa Backup Fiktif '+groupId,schoolClass:'3A',active:true});
  const code=(await (await f.issue()).json()).codes[0].code,front=createPrototypeServer({mentorMode:true,apiOrigin:f.base});front.listen(port,'127.0.0.1');await once(front,'listening');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(async()=>{await browser.close();await new Promise(resolve=>{front.close(resolve);front.closeAllConnections();});});
  const mentor=await browser.newPage({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),admin=await browser.newPage({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'}),errors=[];
  for(const p of [mentor,admin])p.on('pageerror',e=>errors.push(e.message));
  await mentor.goto(origin);await mentor.locator('#pairing-code').fill(code);await mentor.locator('#pairing-form button[type=submit]').click();await mentor.waitForSelector('#attendance-status[data-state=ready]');assert.equal(await mentor.locator('[data-action=select-group]').count(),0);
  await admin.goto(f.adminBase);await admin.locator('#admin-email').fill(f.email);await admin.locator('#admin-password').fill(f.password);await admin.locator('#admin-login button[type=submit]').click();await admin.waitForSelector('#admin-root[data-phase=active]');await admin.locator('[data-admin-tab=backup]').click();await admin.waitForSelector('#admin-backup[data-state=ready]');
  await admin.locator('#backup-visit').selectOption(hagai.serviceSessionId);const options=await admin.locator('#backup-device option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));assert.equal(options.length,1);await admin.locator('#backup-device').selectOption(options[0]);
  for(const g of ['g1','g2'])await admin.locator('[data-backup-field=group][value='+g+']').check();await admin.locator('#backup-reason').fill('Mentor berhalangan hadir');
  admin.once('dialog',dialog=>dialog.accept());const issued=admin.waitForResponse(r=>r.url().endsWith('/api/admin/backup-assignments')&&r.request().method()==='POST');await admin.locator('#backup-form button[type=submit]').click();assert.equal((await issued).status(),201);await admin.waitForSelector('[data-backup=revoke]');
  await mentor.locator('[data-action=secure-context-refresh]').click();await mentor.waitForSelector('[data-action=select-group][data-id=g1]');assert.match(await mentor.locator('[aria-label="Kelompok berizin"]').innerText(),/Kelompok utama[\s\S]*Hagai[\s\S]*Kelompok backup[\s\S]*Hosea[\s\S]*Obaja/);
  await mentor.locator('[data-action=select-group][data-id=g1]').click();await mentor.waitForSelector('#attendance-status[data-state=ready]');assert.match(await mentor.locator('#secure-roster-rows').innerText(),/Siswa Backup Fiktif g1/);await mentor.locator('[data-action=secure-present]').click();await mentor.waitForSelector('#attendance-status[data-state=saved]');
  await mentor.locator('[data-action=select-group][data-id=g2]').click();await mentor.waitForSelector('#attendance-status[data-state=ready]');assert.equal(await mentor.locator('[data-secure-status-id]').inputValue(),'unmarked');assert.equal((await f.root.collection('sessions').get()).size,1);assert.equal((await f.root.collection('sessions').get()).docs[0].data().groupId,'g1');
  await mkdir('screenshots',{recursive:true});for(const width of [360,390,1365])for(const [label,p] of [['mentor',mentor],['admin',admin]]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(width!==360)await p.screenshot({path:`screenshots/backup-${label}-${width}.png`,fullPage:true});}
  let dialogs=0;admin.on('dialog',async dialog=>{dialogs++;await dialog.accept(dialog.type()==='prompt'?'Mentor utama kembali':undefined);});await admin.locator('[data-backup=revoke]').click();await admin.waitForFunction(()=>!document.querySelector('[data-backup=revoke]'));assert.equal(dialogs,2);
  await mentor.locator('[data-action=attendance-reload]').click();await mentor.waitForSelector('#secure-mentor[data-state=context-error]');assert.equal(await mentor.locator('#secure-roster-rows').count(),0);await mentor.locator('[data-action=secure-retry]').click();await mentor.waitForSelector('#attendance-status[data-state=ready]');assert.equal(await mentor.locator('[data-action=select-group]').count(),0);assert.match(await mentor.locator('#secure-roster-rows').innerText(),/Siswa Hagai Fiktif/);assert.deepEqual(errors,[]);
});
