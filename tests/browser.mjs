// Optional browser QA: requires Playwright and an installed Chrome, no app dependency.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {createPrototypeServer} from '../server.mjs';
import {seed} from '../data.js';
import {saveService} from '../scheduling.js';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.ABC_PLAYWRIGHT_MODULE||'C:/Users/HYPE AMD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const server=createPrototypeServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
const fixture=seed();for(const schoolId of ['s1','s2','s3'])saveService(fixture,{schoolId,date:schoolId==='s1'?'2026-10-02':schoolId==='s2'?'2026-10-16':'2026-10-30',groupIds:fixture.groups.filter(g=>g.schoolId===schoolId&&!g.retired).map(g=>g.id)});
let browser;
try{
  await mkdir('screenshots',{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'id-ID',timezoneId:'Asia/Jakarta'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-10-21T05:00:00Z')});
  await page.addInitScript(value=>{if(!localStorage.getItem('abc-school-prototype-v1'))localStorage.setItem('abc-school-prototype-v1',JSON.stringify(value));},fixture);
  await page.goto(`http://127.0.0.1:${port}`);
  const action=(name,id)=>page.locator(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`);
  const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('abc-school-prototype-v1')));
  const modalSubmit=()=>page.locator('#modal button[type=submit]');
  const selectDate=async(date)=>{
    await action('calendar-toggle').click();
    await page.locator('#calendar-year').fill(date.slice(0,4));await page.locator('#calendar-year').press('Tab');
    await page.locator('#calendar-month').selectOption(date.slice(5,7));
    await action('calendar-date',date).click();
  };
  await action('select-school','s1').click();await modalSubmit().click();
  assert.match(await page.locator('#service-date-trigger').innerText(),/21 Oktober 2026/);
  assert.equal(await page.locator('.date-card').count(),0);
  await action('calendar-toggle').click();
  assert.equal(await page.locator('#service-calendar').count(),1);
  assert.equal(await action('calendar-date','2026-10-22').isEnabled(),true);
  assert.equal(await action('calendar-date','2026-10-02').isEnabled(),true);
  await page.screenshot({path:'screenshots/calendar-mobile.png',fullPage:true});
  await action('calendar-next').click();assert.equal(await page.locator('#calendar-month').inputValue(),'11');
  await action('calendar-prev').click();assert.equal(await page.locator('#calendar-month').inputValue(),'10');
  await page.locator('#calendar-year').fill('2027');await page.locator('#calendar-year').press('Tab');
  assert.equal(await page.locator('#calendar-year').inputValue(),'2027');
  await page.locator('#calendar-month').selectOption('01');assert.equal(await action('calendar-date','2027-01-01').isEnabled(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#service-calendar').count(),0);
  const before=(await db()).serviceSessions.length;await selectDate('2026-10-01');assert.equal(await action('continue-date').isDisabled(),true);assert.equal((await db()).serviceSessions.length,before);
  await selectDate('2026-10-02');await page.locator('#service-session').selectOption(fixture.serviceSessions.find(v=>v.schoolId==='s1'&&v.date==='2026-10-02').id);await action('continue-date').click();
  assert.equal(await page.locator('.group-card').count(),8);
  assert.match(await action('select-group','g13').innerText(),/Hagai\s+Kak Louis/);
  await page.screenshot({path:'screenshots/groups-calendar-mobile.png',fullPage:true});
  await action('select-group','g1').click();assert.equal(await page.locator('.student-row').count(),12);
  await page.locator('[data-action=present]').first().click();
  await page.locator('[data-status-id]').nth(1).selectOption('excused');
  await action('add-provisional').click();await page.locator('#field-name').fill('Siswa QA Kalender');await page.locator('#field-schoolClass').fill('4A');await page.locator('[name=gender][value=male]').check();await modalSubmit().click();
  assert.equal(await page.locator('.student-row').count(),13);
  await action('finalize').click();assert.match(await page.locator('#modal').innerText(),/11 siswa belum diabsen/);await modalSubmit().click();
  assert.match(await page.locator('.success-panel').innerText(),/Absensi selesai/);
  await action('correct').click();await modalSubmit().click();await page.locator('[data-action=present]').nth(1).click();
  await action('finalize').click();await modalSubmit().click();
  let stored=await db();const oct2=stored.serviceSessions.find(v=>v.schoolId==='s1'&&v.date==='2026-10-02');
  const result=stored.sessions.find(s=>s.serviceSessionId===oct2.id&&s.groupId==='g1');
  assert.equal(result.records.filter(r=>r.status==='present').length,2);
  await page.reload();assert.equal(await page.locator('#service-date-trigger').count(),1);
  stored=await db();assert.deepEqual(stored.mentorPreferences,{schoolId:'s1',groupId:'g1'});
  await selectDate('2026-10-02');await action('continue-date').click();await action('select-group','g1').click();
  assert.equal(await page.locator('.student-row').count(),13);assert.equal(await action('correct').count(),1);
  await action('back-groups').click();await action('back-dates').click();
  await selectDate('2026-10-09');await action('continue-date').click();await action('select-group','g1').click();
  assert.equal(await page.locator('.student-row').count(),12);
  await action('back-groups').click();await action('back-dates').click();
  await selectDate('2026-10-23');await action('continue-date').click();await action('select-group','g1').click();
  assert.equal(await action('finalize').isDisabled(),true);assert.equal(await page.locator('.student-row').count(),12);
  await page.screenshot({path:'screenshots/future-attendance-mobile.png',fullPage:true});
  for(const [school,count] of [['s2',4],['s3',4]]){
    await action('back-groups').click();await action('back-dates').click();await action('back-schools').click();
    await action('select-school',school).click();await selectDate(school==='s2'?'2026-10-16':'2026-10-30');await page.locator('#service-session').selectOption(fixture.serviceSessions.find(v=>v.schoolId===school&&v.date===(school==='s2'?'2026-10-16':'2026-10-30')&&v.groupIds.length===4).id);await action('continue-date').click();
    if(await page.locator('#modal').isVisible())await modalSubmit().click();
    assert.equal(await page.locator('.group-card').count(),count);
    for(const card of await page.locator('.group-card').all()){
      assert.ok(await card.locator('h3').innerText());assert.match(await card.locator('.mentor-subtitle').innerText(),/^Kak /);
    }
    await page.screenshot({path:`screenshots/groups-${school}-mobile.png`,fullPage:true});
    await action('select-group',school==='s2'?'g4':'g7').click();assert.equal(await page.locator('.student-row').count(),12);
  }
  // Admin override and permanent assignment through the existing form.
  await action('admin').last().click();await page.locator('#field-code').fill('ABC2026');await modalSubmit().click();
  await action('admin-tab','groups').click();await action('assignment-edit','g1').click();
  await page.locator('#assignment-type-temporary').check();await page.locator('#assignment-service').selectOption('demo-pakel-2026-10-23');
  await page.locator('#assignment-mentor').selectOption('mentor-eva');await modalSubmit().click();
  await action('assignment-edit','g1').click();await page.locator('#assignment-effective').fill('2026-11-01');await page.locator('#assignment-effective').press('Tab');
  await page.locator('#assignment-mentor').selectOption('mentor-chriz');await modalSubmit().click();
  stored=await db();assert.deepEqual(stored.sessions.find(s=>s.id===result.id),result);
  assert.equal(stored.sessionMentorOverrides.find(o=>o.groupId==='g1').mentorId,'mentor-eva');
  assert.equal(stored.defaultMentorAssignments.find(a=>a.groupId==='g1'&&a.effectiveFrom==='2026-11-01').mentorId,'mentor-chriz');
  // Explicit admin rescheduling to a non-Friday keeps historical attendance.
  await action('admin-tab','schedule').click();await action('schedule-form',oct2.id).click();
  await page.locator('[name=date]').fill('2026-10-04');await modalSubmit().click();
  stored=await db();assert.equal(stored.serviceSessions.find(v=>v.id===oct2.id).date,'2026-10-04');assert.deepEqual(stored.sessions.find(s=>s.id===result.id).records.map(r=>[r.studentId,r.status]),result.records.map(r=>[r.studentId,r.status]));
  await page.setViewportSize({width:1365,height:900});await action('mentor').first().click();
  await action('back-groups').click();await action('back-dates').click();await action('calendar-toggle').click();
  await page.screenshot({path:'screenshots/calendar-desktop.png',fullPage:true});
  for(const width of [360,390,1365]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  }
  await page.evaluate(async()=>{
    await navigator.serviceWorker.ready;
    if(!await caches.match(new URL('./dates.js',location.href).href))throw Error('Date module missing from offline cache');
  });
  await context.setOffline(true);await page.reload();await page.locator('#service-date-trigger').waitFor();
  assert.equal(await page.locator('#service-date-trigger').count(),1);await action('calendar-toggle').click();
  assert.equal(await page.locator('#service-calendar').count(),1);await context.setOffline(false);
  assert.deepEqual(errors,[]);console.log('Browser QA passed: calendar/navigation, all weekdays, missing-session refusal, 16 groups, roster isolation, submit/correct/reload, future guard, admin overrides/rescheduling, offline reload/calendar, 360/390/1365px.');
}finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
