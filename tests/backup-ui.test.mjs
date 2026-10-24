import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupPanel} from '../admin-backup.js';
import {createSecureMentor} from '../secure-mentor.js';
const primary={schoolId:'s1',groupId:'g13',serviceSessionId:'fictional-backup',schoolName:'Sekolah Fiktif',groupName:'Hagai',serviceDate:'2026-11-01',mentorId:'mentor-one',mentorName:'Mentor Satu'};
const backup={...primary,groupId:'g1',groupName:'Hosea',mentorId:'mentor-two',mentorName:'Mentor Dua',accessKind:'backup'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
  const originals={FormData:globalThis.FormData,confirm:globalThis.confirm};globalThis.FormData=class{get(){return 'Mentor berhalangan';}};globalThis.confirm=()=>true;t.after(()=>Object.assign(globalThis,originals));
  const calls=[],client={state:{phase:'active',role:'pic',actions:['pairing:read','pairing:issue','pairing:revoke']},async readPairingContext(){return {contexts:[primary,backup]};},async readBackups(){return {candidates:[{deviceId:'fictional-device',assignment:primary,expiresAt:Date.now()+3600000}],assignments:[]};},async saveBackup(command){calls.push(structuredClone(command));if(calls.length===1)throw Error('Respons hilang');return {};}};
  const panel=createBackupPanel(client,()=>{});return {client,panel,calls,choose(){panel.choose('visit',primary.serviceSessionId);panel.choose('device','fictional-device');panel.choose('group',backup.groupId,true);}};
}
test('Backup UI requires confirmation and retries an uncertain assignment with the same intent across session verification',async t=>{
  const f=fixture(t);await f.panel.load();f.choose();globalThis.confirm=()=>false;f.panel.submit({});assert.equal(f.calls.length,0);globalThis.confirm=()=>true;f.panel.submit({});await tick();assert.equal(f.panel.phase,'error');assert.match(f.panel.view(),/Coba lagi penugasan yang sama/);
  f.panel.reset({preserveIntent:true});await f.panel.load();f.choose();f.panel.submit({});assert.equal(f.calls.length,1);await f.panel.click({dataset:{backup:'retry'}});assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.panel.phase,'ready');
});
test('Definitively rejected backup commands allow a fresh choice; malformed metadata and late reads fail closed',async t=>{
  const f=fixture(t);f.client.saveBackup=async command=>{f.calls.push(command);throw Object.assign(Error(),{status:403});};await f.panel.load();f.choose();f.panel.submit({});await tick();assert.doesNotMatch(f.panel.view(),/data-backup="retry"/);
  f.client.readBackups=async()=>({candidates:[{}],assignments:[]});await f.panel.load();assert.equal(f.panel.phase,'error');assert.doesNotMatch(f.panel.view(),/id="backup-form"/);
  let release;f.client.readBackups=()=>new Promise(resolve=>{release=resolve;});const waiting=f.panel.load();f.panel.reset();release({candidates:[],assignments:[]});await waiting;assert.equal(f.panel.phase,'idle');
});
test('A resolved Mentor switches only explicit server groups, labels primary/backup separately and returns to primary after revocation',async()=>{
  let contexts=[primary,backup],reads=[];const client={state:{phase:'active',assignment:primary},async readContexts(){return {contexts};},async readRoster(s){reads.push(s.groupId);return {...s,students:[]};},async readAttendance(s){return {...s,batchId:null,state:'not-started',revision:0,updatedAt:null,finalizedAt:null,records:[]};}};
  const panel=createSecureMentor({client,render:()=>{},icon:()=>'',steps:()=>'',art:()=>'',openModal:()=>{},closeModal:()=>{}});await panel.refresh();await tick();assert.deepEqual(reads,['g13']);assert.match(panel.view(),/Kelompok utama[\s\S]*Hagai[\s\S]*Kelompok backup[\s\S]*Hosea/);
  panel.action('select-group','g1','wrong-session');panel.action('select-group','unauthorized',primary.serviceSessionId);assert.equal(reads.length,1);panel.action('select-group','g1',primary.serviceSessionId);await tick();assert.deepEqual(reads,['g13','g1']);contexts=[primary];await panel.refresh();await tick();assert.deepEqual(reads,['g13','g1','g13']);assert.doesNotMatch(panel.view(),/data-action="select-group"/);
});
