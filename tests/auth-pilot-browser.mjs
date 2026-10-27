import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {runPilot,stopPilot,PILOT_PORTS,PILOT_USERNAME,PILOT_ADDRESS} from '../local-auth-pilot.mjs';
import {portOccupied,waitFor,controlRequest,listen} from '../local-demo.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const output=path.resolve('.emulator-data/auth-pilot-qa/screenshots');

test('Interactive pilot real lifecycle, onboarding, review/link, username login, device proof, attendance/backup and responsive navigation',{timeout:300000},async()=>{
  const recoveryPassword=randomBytes(24).toString('base64url');
  const password=randomBytes(24).toString('base64url'),messages=[],input=new PassThrough(),terminal=new PassThrough();
  let notify,fail;const ready=new Promise((resolve,reject)=>{notify=resolve;fail=reject;});
  const running=runPilot({input,output:terminal,askPassword:async()=>password,askRecoveryPassword:async()=>recoveryPassword,open:async()=>{},log:s=>{messages.push(s);console.log(s);},onReady:notify});
  running.then(()=>fail(Error('Pilot berhenti sebelum siap.')),fail);
  let browser;
  try{
    const f=await ready,{mentorOrigin,adminOrigin}=f.options,namespace=f.context.config.namespace;
    const duplicate=[];await runPilot({open:async options=>assert.ok(options.adminOrigin),log:s=>duplicate.push(s)});assert.match(duplicate.join(' '),/Pilot sudah berjalan/);
    assert.match(namespace,/^test-auth-pilot-/);assert.ok(PILOT_PORTS.every(p=>!['4173','4175','4176','4177'].includes(String(p))));
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext({locale:'id-ID',timezoneId:'Asia/Jakarta',viewport:{width:390,height:900}}),page=await context.newPage(),review=await context.newPage(),admin=await context.newPage(),errors=[];
    for(const p of [page,review,admin])p.on('pageerror',e=>errors.push(e.message));await mkdir(output,{recursive:true});
    const capture=async(p,name)=>{for(const width of [360,390,768,1365]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' '+width);assert.ok(await p.locator('.pilot-nav a:visible,.pilot-nav summary:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));await p.screenshot({path:path.join(output,name+'-'+width+'.png'),fullPage:true});}};
    await page.goto(mentorOrigin+'/');await page.waitForSelector('#account-username');assert.equal(await page.locator('#account-login h1').textContent(),'ABC Ministry Service App');await page.locator('#account-show-password').click();assert.equal(await page.locator('#account-password').getAttribute('type'),'text');await page.locator('#account-show-password').click();assert.equal(await page.locator('#account-password').getAttribute('type'),'password');await capture(page,'login');
    await page.getByRole('link',{name:'Panduan pilot',exact:true}).click();await capture(page,'guide');
    await page.getByRole('link',{name:'Daftar relawan',exact:true}).click();await page.waitForSelector('#registration');await capture(page,'register');
    const username='pilot-'+randomUUID().slice(0,8),mentorPassword=randomBytes(24).toString('base64url');
    await page.locator('#full-name').fill('Mentor Perjalanan Fiktif');await page.locator('#phone').fill('081234567890');await page.locator('#username').fill(username);await page.locator('#password').fill(mentorPassword);await page.locator('#registration button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Permintaan diterima'));
    const claim=(await f.context.root.collection('msaUsernames').doc(username).get()).data();
    const mentorLogin=async()=>{await page.goto(mentorOrigin+'/');await page.locator('#account-username').fill(username);await page.locator('#account-password').fill(mentorPassword);await page.locator('#account-login-form button[type=submit]').click();};
    await mentorLogin();await page.waitForFunction(()=>document.querySelector('#account-feedback').textContent.length>0);assert.equal(await page.locator('#account-profile').isVisible(),false);assert.equal(await page.locator('#account-attendance').isVisible(),false);
    await review.goto(adminOrigin+'/identity-review.html');await review.locator('#login-mode').selectOption('username');await review.locator('#login-name').fill(PILOT_USERNAME);await review.locator('#login-password').fill(password);await review.locator('#review-login button').click();await review.waitForSelector('[data-account]');await review.locator('[data-account]').click();
    await review.locator('#school').fill('s1');await review.locator('#group').fill('g1');await review.locator('#service').fill('fictional-a23-current');
    const apply=async op=>{await review.locator('#operation').selectOption(op);if(op==='link')await review.locator('#mentor-id').fill('fictional-mentor');await review.locator('#reason').fill('Pemeriksaan identitas fiktif untuk pilot interaktif');await review.locator('#evidence-reference').fill('Pertemuan fiktif dengan penanggung jawab');await review.locator('#evidence-confirmed').check();await review.locator('#review-form button').click();await review.locator('#apply').click();await review.waitForFunction(()=>!document.querySelector('#confirmation').open);};
    await capture(review,'review');await apply('approve');await review.waitForFunction(()=>document.querySelector('#account-info').textContent.includes('Disetujui'));
    await mentorLogin();await page.waitForFunction(()=>document.querySelector('#account-feedback').textContent.includes('belum diizinkan'));
    await apply('link');await review.waitForFunction(()=>document.querySelector('#defaults').textContent.includes('Penugasan tetap yang cocok: 1'));
    const readiness=await context.newPage();readiness.on('pageerror',e=>errors.push(e.message));await readiness.goto(adminOrigin+'/migration-readiness.html');await readiness.locator('#migration-username').fill(PILOT_USERNAME);await readiness.locator('#migration-password').fill(password);await readiness.locator('#migration-login button').click();await readiness.waitForSelector('#migration-report:not([hidden])');assert.match(await readiness.locator('#migration-verdict').textContent(),/NO-GO/);assert.ok(!(await readiness.locator('#migration-report').innerText()).includes(claim.uid));await capture(readiness,'migration-readiness');
    const core=await context.newPage();core.on('pageerror',e=>errors.push(e.message));await core.goto(adminOrigin+'/msa-core.html');await core.locator('#core-username').fill(PILOT_USERNAME);await core.locator('#core-password').fill(password);await core.locator('#core-login button').click();await core.waitForSelector('#core-organization:not([hidden])');assert.equal(await core.locator('#core-org option').count(),2);await capture(core,'stage8-organizations');
    const drafts=await context.newPage();drafts.on('pageerror',e=>errors.push(e.message));await drafts.goto(adminOrigin+'/msa-events.html');await drafts.locator('#event-username').fill(PILOT_USERNAME);await drafts.locator('#event-password').fill(password);await drafts.locator('#event-login button').click();await drafts.waitForSelector('#dashboard-workspace:not([hidden])');await drafts.waitForFunction(()=>document.querySelector('#event-workspace').getAttribute('aria-busy')==='false');await drafts.locator('.pilot-nav summary').focus();await drafts.keyboard.press('Enter');assert.equal(await drafts.locator('.pilot-nav a').first().isVisible(),true);await drafts.locator('.pilot-nav summary').click();await capture(drafts,'stage9b2-dashboard');await drafts.locator('#calendar-show').click();await drafts.waitForSelector('#calendar-workspace:not([hidden])');await drafts.waitForFunction(()=>document.querySelector('#event-workspace').getAttribute('aria-busy')==='false');assert.equal(await drafts.locator('.calendar-card').count(),2);await capture(drafts,'stage9b1-agenda');await drafts.locator('#draft-show').click();await drafts.waitForSelector('#event-organization:not([hidden])');await drafts.waitForFunction(()=>document.querySelector('#event-workspace').getAttribute('aria-busy')==='false');assert.equal(await drafts.locator('#event-org option').count(),2);
    await drafts.locator('#event-new').click();await drafts.locator('#draft-name').fill('Pelayanan Pilot Fiktif');await drafts.locator('#draft-date').fill('2026-11-08');await drafts.locator('#draft-time').fill('09:30');await drafts.locator('#draft-venue').fill('Aula Pilot Fiktif');await drafts.locator('#draft-pic').selectOption({index:1});await drafts.locator('#event-save').click();await drafts.waitForSelector('#recurrence-confirm[open]');await capture(drafts,'stage9b2-preview');await drafts.locator('#recurrence-apply').click();await drafts.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('tersimpan'));assert.equal((await f.context.root.collection('msaServiceEvents').get()).size,3);await capture(drafts,'stage9a-draft');
    await drafts.locator('#event-calendar-open').click();await drafts.waitForSelector('#calendar-publish');await drafts.locator('#calendar-publish').click();await drafts.locator('#calendar-apply').click();await drafts.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('terbit di kalender'));await drafts.locator('#calendar-cancel').click();await drafts.locator('#calendar-reason').fill('Pembatalan pelayanan fiktif melalui pilot');await drafts.locator('#calendar-apply').click();await drafts.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Pelayanan dibatalkan'));await capture(drafts,'stage9b1-cancelled');
    await mentorLogin();await page.waitForSelector('#account-code');await capture(page,'activation');
    await admin.goto(adminOrigin+'/username.html');await admin.locator('#admin-username').fill(PILOT_USERNAME);await admin.locator('#admin-password').fill(password);await admin.locator('#admin-login button[type=submit]').click();await admin.waitForSelector('#admin-root[data-phase=active]');
    await admin.locator('[data-admin-tab=devices]').click();await admin.waitForSelector('#admin-devices[data-state=ready]');await admin.locator('#device-school').selectOption('s1');await admin.locator('#device-visit').selectOption('fictional-a23-current');await admin.locator('[data-device-field=group][value=g1]').check();await capture(admin,'admin');
    await admin.locator('[data-activation=issue]').click();await admin.waitForSelector('[data-activation-code]');const code=await admin.locator('[data-activation-code]').textContent();
    await page.locator('#account-code').fill(code);await page.locator('#account-activation button').click();await page.waitForSelector('[data-account-action=associate]');assert.equal(await page.locator('#account-attendance').isVisible(),false);await page.locator('[data-account-action=associate]').click();await page.waitForSelector('#secure-roster-rows .student-row');
    await page.locator('[data-action=secure-present][data-id=fictional-1]').click();await page.waitForSelector('#attendance-status[data-state=saved]');
    // Exercise existing Stage 6 Admin UI with this personally associated device.
    await admin.locator('[data-admin-tab=backup]').click();await admin.waitForSelector('#admin-backup[data-state=ready]');await admin.locator('#backup-visit').selectOption('fictional-a23-current');
    const deviceId=(await f.context.root.collection('msaDeviceAssociations').get()).docs[0].id;
    await admin.locator('#backup-device').selectOption(deviceId);await admin.locator('[data-backup-field=group][value=g2]').check();await admin.locator('#backup-reason').fill('Backup fiktif pada pilot interaktif');admin.once('dialog',dialog=>dialog.accept());await admin.locator('#backup-form button[type=submit]').click();await admin.waitForSelector('#admin-backup[data-state=ready]');
    await page.locator('[data-action=secure-context-refresh]').click();await page.waitForSelector('[data-action=select-group][data-id=g2]');await page.waitForSelector('#secure-roster-rows .student-row');await capture(page,'attendance');
    await page.locator('[data-action=select-group][data-id=g2]').click();await page.waitForSelector('[data-action=secure-present][data-id=fictional-backup-student]');await page.locator('[data-action=secure-present][data-id=fictional-backup-student]').click();await page.waitForSelector('#attendance-status[data-state=saved]');
    const batches=(await f.context.root.collection('sessions').where('serviceSessionId','==','fictional-a23-current').get()).docs.map(d=>d.data());assert.equal(batches.length,2);assert.ok(batches.every(b=>b.revision===1));
    await page.locator('#account-manage-devices').click();await page.waitForSelector('.account-device-card');await capture(page,'account-devices');
    await review.locator('#refresh').click();await review.waitForSelector('#detail:not([hidden])');await review.locator('#review-devices [data-devices-open]').click();await review.waitForSelector('#review-devices [data-device-revoke]');await capture(review,'reviewer-devices');
    await review.locator('#review-devices [data-device-revoke]').click();await review.locator('#review-devices textarea[name=reason]').fill('Pencabutan perangkat pilot fiktif oleh peninjau');await review.locator('#review-devices button[type=submit]').click();await review.waitForFunction(()=>document.querySelectorAll('#review-devices [data-device-revoke]').length===0);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('#account-code');assert.equal(await page.locator('#account-attendance').isVisible(),false);
    const recover=await context.newPage();recover.on('pageerror',e=>errors.push(e.message));
    await page.goto(mentorOrigin+'/mentor-account.html');await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).click();await page.locator('#recovery-username').fill(username);await page.locator('#recovery-request button').click();await page.waitForSelector('#request-pending:not([hidden])');await capture(page,'recovery-pending');
    await recover.goto(adminOrigin+'/account-recovery.html');await recover.locator('#reviewer-entry summary').click();await recover.locator('#review-username').fill(PILOT_USERNAME);await recover.locator('#review-password').fill(password);await recover.locator('#recovery-login button').click();await recover.waitForSelector('[data-recovery-id]');await recover.locator('[data-recovery-id]').click();await recover.locator('#recovery-decision').selectOption('approve');await recover.locator('#recovery-reason').fill('Pemulihan pilot fiktif dengan bukti baru');await recover.locator('#recovery-reference').fill('Pemeriksaan fiktif independen dengan pemilik');await recover.locator('#recovery-evidence-confirmed').check();await recover.locator('#recovery-review button[type=submit]').click();await recover.locator('#recovery-apply').click();await recover.waitForFunction(()=>document.querySelector('#review-state').textContent.includes('Disetujui'));await capture(recover,'recovery-approved');
    input.write('pulihkan '+username+'\n');await waitFor(async()=> (await f.context.root.collection('msaRecoveryRequests').get()).docs.some(d=>d.data().state==='completed'),{timeout:20000});
    await page.goto(mentorOrigin+'/mentor-account.html');await page.locator('#account-username').fill(username);await page.locator('#account-password').fill(recoveryPassword);await page.locator('#account-login-form button[type=submit]').click();await page.waitForSelector('#account-code');await capture(page,'recovery-fresh-login');
    assert.equal((await f.context.root.collection('msaAccounts').doc(claim.uid).get()).data().revision,4);
    assert.ok(messages.every(s=>!s.includes(recoveryPassword)));
    await f.context.root.collection('msaAccounts').doc(claim.uid).update({state:'suspended',revision:5});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('#account-login:not([hidden])');assert.equal(await page.locator('#account-attendance').isVisible(),false);
    assert.deepEqual(errors,[]);assert.ok(messages.every(s=>!s.includes(password)&&!s.includes(mentorPassword)&&!s.includes(code)&&!s.includes('@example.invalid')));
    // Firebase CLI diagnostics must not contain submitted application secrets.
    for(const file of await readdir(f.state))if(file.endsWith('.log')){const log=await readFile(path.join(f.state,file),'utf8');assert.ok(!log.includes(password)&&!log.includes(mentorPassword)&&!log.includes(recoveryPassword)&&!log.includes(code)&&!log.includes('@msa.example.invalid'));}
    console.log('PASS pilot browser: registration → review → link → username → activation/proof → primary/backup attendance → reviewed recovery → trusted terminal reset → suspension; screenshots '+output);
  }finally{
    await browser?.close();
    if(process.platform==='win32'&&await controlRequest(PILOT_ADDRESS,'status')){
      const result=await new Promise((resolve,reject)=>{let data='';const child=spawn('cmd.exe',['/d','/c','Stop MSA.cmd'],{windowsHide:true});child.stdout.on('data',d=>data+=d);child.once('error',reject);child.once('exit',code=>resolve({code,data}));});
      assert.equal(result.code,0);assert.match(result.data,/Pilot berhenti/);
    }else await stopPilot({log:()=>{}});
    await running;await waitFor(async()=>!(await Promise.all(PILOT_PORTS.map(portOccupied))).some(Boolean),{timeout:10000});
  }
  // A second run must start empty with a fresh namespace, no recovery/import.
  let secondReady,secondFail;const second=new Promise((resolve,reject)=>{secondReady=resolve;secondFail=reject;}),secondInput=new PassThrough();
  const secondRun=runPilot({input:secondInput,output:terminal,askPassword:async()=>randomBytes(24).toString('base64url'),open:async()=>{},log:()=>{},onReady:secondReady});
  secondRun.then(()=>secondFail(Error('Pilot kedua berhenti sebelum siap.')),secondFail);
  try{const f=await second;assert.equal((await f.context.root.collection('msaAccounts').get()).size,0);assert.equal((await f.context.root.collection('msaDeviceAssociations').get()).size,0);assert.equal((await f.context.root.collection('sessions').get()).size,0);secondInput.write('\n');await secondRun;}
  finally{await stopPilot({log:()=>{}});await secondRun;}
  console.log('PASS pilot fresh restart and Enter/Windows Stop launcher; all owned ports closed.');
  const exitCode=process.exitCode,failureMessages=[];
  try{
    await runPilot({input:new PassThrough(),output:terminal,askPassword:async()=>'',open:async()=>assert.fail('Failed startup must not open pages'),log:s=>failureMessages.push(s)});
    assert.equal(process.exitCode,1);assert.ok(failureMessages.some(s=>s.includes('Kata sandi harus')));assert.ok(failureMessages.some(s=>s.includes('Pilot berhenti')));
    await waitFor(async()=>!(await Promise.all(PILOT_PORTS.map(portOccupied))).some(Boolean),{timeout:10000});
  }finally{process.exitCode=exitCode;}
  console.log('PASS owned-emulator cleanup after invalid-password startup failure.');
  if(process.platform==='win32'){
    const unrelated=await listen(createServer(socket=>socket.end()),PILOT_PORTS[5]);
    try{
      const result=await new Promise((resolve,reject)=>{let output='';const child=spawn('cmd.exe',['/d','/c','Start MSA.cmd'],{windowsHide:true});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.stdin.end('\n');child.once('error',reject);child.once('close',code=>resolve({code,output}));});
      assert.equal(result.code,1);assert.match(result.output,/port 4275 sedang digunakan/);assert.equal(unrelated.listening,true);
      assert.equal(await portOccupied(PILOT_PORTS[0]),false);
    }finally{await new Promise(resolve=>unrelated.close(resolve));}
    console.log('PASS actual Windows Start conflict refusal; unrelated listener preserved.');
  }
});
