import test,{mock} from 'node:test';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
import assert from 'node:assert/strict';
import {seed,applyGroupConfiguration,groupDisplayName,schoolDisplayName} from '../data.js';
import {GROUP_CONFIG} from '../group-config.js';

function legacyDatabase(){
  const db=seed();delete db.groupConfigRevision;
  db.groups=db.groups.filter(g=>Number(g.id.slice(1))<=9).sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
  db.groups.forEach((g,i)=>g.name=['Kelas 1–2','Kelas 3–4','Kelas 5–6'][i%3]);
  db.schools[0].name='SDN Pacarkeling V';db.schools[1].name='SDN Airlangga III';db.schools[2].name='SDN Kertajaya IV';
  db.sessions.forEach(s=>{s.groupName=db.groups.find(g=>g.id===s.groupId).name;s.schoolName=db.schools.find(x=>x.id===s.schoolId).name;});
  return db;
}

test('Authoritative school mappings are ordered, unique within each school, and total 16',()=>{
  const db=seed();
  assert.deepEqual(db.schools.map(s=>s.name),['SDN Pacarkeling V','SDN Airlangga III','SDN Kertajaya IV']);
  assert.deepEqual(db.groups.filter(g=>g.schoolId==='s1').map(g=>g.name),['Hosea','Amos','Obaja','Zefanya','Zakharia','Hagai','Yunus','Yoel']);
  assert.deepEqual(db.groups.filter(g=>g.schoolId==='s2').map(g=>g.name),['Amos','Zakharia','Obaja','Zefanya']);
  assert.deepEqual(db.groups.filter(g=>g.schoolId==='s3').map(g=>g.name),['Zakharia','Zefanya','Obaja','Amos']);
  assert.equal(new Set(db.groups.map(g=>g.id)).size,16);
  assert.equal(new Set(db.groups.map(g=>g.schoolId+'_'+g.name)).size,16);
  assert.ok(db.groups.every(g=>db.schools.some(s=>s.id===g.schoolId)));
});

test('Migration preserves IDs, all relationships, records, provisional entries and mentor assignments',()=>{
  const db=legacyDatabase();db.authorized=true;
  db.groups[0].mentor='Kak Mentor Disunting';
  db.provisionals.push({id:'provisional-existing',name:'Siswa Sementara',groupId:'g1',sessionId:db.sessions[0].id,state:'pending'});
  db.groups.push({id:'custom-group',schoolId:'s1',name:'Kelompok Buatan Admin',mentor:'Kak Admin'});
  const before=structuredClone(db);
  assert.deepEqual(applyGroupConfiguration(db),{changed:true,issues:[]});
  assert.deepEqual(db.students,before.students);assert.deepEqual(db.sessions,before.sessions);assert.deepEqual(db.provisionals,before.provisionals);
  assert.equal(db.authorized,true);assert.equal(db.groups.find(g=>g.id==='g1').mentor,'Kak Mentor Disunting');
  for(const g of before.groups)assert.equal(db.groups.find(x=>x.id===g.id).schoolId,g.schoolId);
  assert.deepEqual(db.groups.find(g=>g.id==='custom-group'),before.groups.find(g=>g.id==='custom-group'));
  for(const group of GROUP_CONFIG.filter(g=>!Number.isInteger(g.demoRosterIndex))){
    assert.ok(!db.students.some(s=>s.groupId===group.id));assert.ok(!db.sessions.some(s=>s.groupId===group.id));
  }
  assert.deepEqual(applyGroupConfiguration(db),{changed:false,issues:[]});
  assert.equal(db.groups.length,17);
});

test('Historical snapshot labels resolve to current names without modifying stored history',()=>{
  const db=legacyDatabase(),session=db.sessions.find(s=>s.groupId==='g4'),snapshot=structuredClone(session);
  applyGroupConfiguration(db);
  assert.equal(groupDisplayName(db,session),'Amos');assert.equal(schoolDisplayName(db,session),'SDN Airlangga III');
  assert.deepEqual(session,snapshot);assert.equal(session.groupName,'Kelas 1–2');
});

test('Ambiguous duplicate names or wrong-school IDs are reported without merging, moving or mutating data',()=>{
  for(const type of ['name','school']){
    const db=legacyDatabase();
    if(type==='name')db.groups.push({id:'custom-hosea',schoolId:'s1',name:'Hosea',mentor:''});
    else db.groups[0].schoolId='s2';
    const before=structuredClone(db),result=applyGroupConfiguration(db);
    assert.equal(result.changed,false);assert.ok(result.issues.length>0);assert.deepEqual(db,before);
  }
});
