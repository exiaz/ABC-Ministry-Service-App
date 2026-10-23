import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,getSession} from '../data.js';
import {saveService,selectService,mentorGroups,reportEntries,isValidDate} from '../scheduling.js';
import {attendanceExportRows} from '../reports.js';
import {calendarGrid,dateSelectionView} from '../service-ui.js';
import {jakartaToday} from '../dates.js';
import {createSecureMentor} from '../secure-mentor.js';
import {deviceContextsFrom} from '../admin-devices.js';
import {activationCodesFrom} from '../admin-activation.js';

test('Explicit sessions on any day and the same date retain independent IDs, attendance, reports and assignment history',()=>{
  const db=seed(),history=structuredClone({sessions:db.sessions,snapshots:db.mentorAssignmentSnapshots}),date='2026-10-25';
  const a=saveService(db,{schoolId:'s1',date,groupIds:['g1']}),b=saveService(db,{schoolId:'s1',date,groupIds:['g1']});
  assert.notEqual(a.id,b.id);assert.notEqual(a.id,date);assert.throws(()=>selectService(db,'s1',date),/Pilih salah satu/);assert.equal(selectService(db,'s1',date,b.id),b);
  assert.throws(()=>selectService(db,'s2',date,b.id),/tidak tersedia/);assert.throws(()=>selectService(db,'s1','2026-10-26',b.id),/tidak tersedia/);
  assert.deepEqual(db.sessions,history.sessions);for(const snapshot of history.snapshots)assert.deepEqual(db.mentorAssignmentSnapshots.find(s=>s.id===snapshot.id),snapshot);
  const first=getSession(db,'g1',a.id),second=getSession(db,'g1',b.id);first.records[0].status='present';assert.equal(second.records[0].status,'unmarked');assert.notEqual(first.id,second.id);
  assert.deepEqual(mentorGroups(db,a.id).map(g=>g.id),['g1']);const before=structuredClone(db);assert.throws(()=>getSession(db,'g2',a.id),/tidak sesuai/);assert.deepEqual(db,before);
  assert.equal(reportEntries(db,{serviceSessionId:b.id}).length,1);const rows=attendanceExportRows(db,{month:'2026-10',schoolId:'s1'});assert.ok(rows.some(r=>r[2]===a.id&&r[3]===date));assert.ok(rows.some(r=>r[2]===b.id&&r[3]===date));
  const view=dateSelectionView(db,'s1',date,()=>'',()=>'',{});assert.match(view,new RegExp(a.id));assert.match(view,new RegExp(b.id));assert.match(view,/Pilih sesi pelayanan/);
});
test('Calendar/date boundaries support all days but missing and provisional services never authorize selection',()=>{
  const db=seed(),before=structuredClone(db);for(const date of ['2026-10-24','2026-12-31','2028-02-29']){assert.ok(isValidDate(date));assert.throws(()=>selectService(db,'s1',date),/Belum dijadwalkan/);}assert.deepEqual(db,before);
  for(const date of ['2026-02-29','2026-02-30','2026-13-01','0000-01-01'])assert.equal(isValidDate(date),false);
  assert.equal(jakartaToday(new Date('2026-12-31T16:59:59.999Z')),'2026-12-31');assert.equal(jakartaToday(new Date('2026-12-31T17:00:00Z')),'2027-01-01');
  const visit=saveService(db,{schoolId:'s1',date:'2026-10-25',groupIds:['g1']});visit.provisional=true;assert.throws(()=>selectService(db,'s1',visit.date),/Belum dijadwalkan/);assert.throws(()=>getSession(db,'g1',visit.id),/tidak sesuai/);
  const grid=calendarGrid('2026-10','2026-10-25',()=>'',['2026-10-25']);for(const match of grid.matchAll(/data-id="(\d{4}-\d{2}-\d{2})"[^>]*>/g))assert.equal(match[0].includes('disabled'),match[1]!=='2026-10-25');
});
test('Secure navigation distinguishes two allowed sessions for the same group/date and accepts non-Friday activation metadata',async()=>{
  const context={schoolId:'s1',groupId:'g13',serviceSessionId:'special-a',schoolName:'Sekolah Fiktif',groupName:'Hagai',mentorName:'Kak Louis',serviceDate:'2026-10-25'},contexts=[context,{...context,serviceSessionId:'special-b'}],reads=[];
  assert.equal(deviceContextsFrom({contexts}).length,2);assert.equal(activationCodesFrom({codes:[{pairingId:'a'.repeat(64),createdAt:1,expiresAt:172800001,state:'pending',assignment:{...context,mentorId:'mentor-louis'}}]}).length,1);
  const client={state:{phase:'active'},async readContexts(){return {contexts};},async readRoster(s){reads.push(s);return {...s,students:[]};},async readAttendance(s){return {...s,batchId:null,state:'not-started',revision:0,records:[]};}};
  const panel=createSecureMentor({client,render:()=>{},icon:()=>'',steps:()=>'',art:()=>'',openModal:()=>{},closeModal:()=>{}});await panel.refresh();panel.action('select-school','s1');panel.action('calendar-date','2026-10-25');panel.action('continue-date');assert.match(panel.view(),/data-visit="special-a"/);assert.match(panel.view(),/data-visit="special-b"/);
  panel.action('select-group','g13');assert.equal(reads.length,0);panel.action('select-group','g13','special-b');await new Promise(resolve=>setImmediate(resolve));assert.equal(reads[0].serviceSessionId,'special-b');panel.reset();
});
