import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceFrom,createMentorAttendance} from '../mentor-attendance.js';
const scope={schoolId:'s1',groupId:'g1',serviceSessionId:'fictional-friday-1'},other={...scope,serviceSessionId:'fictional-friday-2'};
const value=(s=scope)=>({...s,batchId:null,state:'not-started',revision:0,updatedAt:null,finalizedAt:null,records:[{studentId:'fictional-1',status:'unmarked',updatedAt:null}]});
function fixture(){
  const data=new Map([scope,other].map(s=>[s.serviceSessionId,value(s)])),calls=[];
  const client={state:{phase:'active'},async readRoster(s){return {...s,students:[{id:'fictional-1',name:'Siswa Fiktif',schoolClass:null}]};},async readAttendance(s){return structuredClone(data.get(s.serviceSessionId));}};
  const write=async(s,body,action)=>{
    calls.push({s,body:structuredClone(body),action});
    const old=data.get(s.serviceSessionId),next={...old,batchId:'fictional-batch-'+s.serviceSessionId,revision:old.revision+1,state:action==='finalize'?'completed':'draft',updatedAt:new Date().toISOString(),records:old.records.map(r=>({...r,status:body.records?.find(p=>p.studentId===r.studentId)?.status??r.status}))};
    data.set(s.serviceSessionId,next);return structuredClone(next);
  };
  client.saveAttendance=(s,b)=>write(s,b,'save');client.correctAttendance=(s,b)=>write(s,b,'correct');client.finalizeAttendance=(s,b)=>write(s,b,'finalize');
  const store=createMentorAttendance(client,()=>{});return {client,store,data,calls};
}
test('Attendance projection rejects mismatches, duplicate IDs, malformed states/timestamps and private extras',()=>{
  const source=value();assert.deepEqual(attendanceFrom({...source,guardianName:'PRIVAT',records:[{...source.records[0],privateProfile:'PRIVAT'}]},scope),source);
  for(const patch of [{schoolId:'s2'},{revision:-1},{updatedAt:{secret:'PRIVAT'}},{state:'done'},{records:[...source.records,...source.records]},{records:[{...source.records[0],status:'missing'}]},{batchId:'../private'}])assert.throws(()=>attendanceFrom({...source,...patch},scope));
});
test('Saving is serialized with no optimistic success or automatic absence; finalization and correction obey state',async()=>{
  const f=fixture();await f.store.load(scope);assert.equal(f.store.state.students[0].status,'unmarked');
  await f.store.mutate('finalize',{confirm:true});assert.equal(f.calls.length,0);
  let resume;const save=f.client.saveAttendance;
  f.client.saveAttendance=async(...args)=>{await new Promise(r=>{resume=r;});return save(...args);};
  const pending=f.store.mutate('save',{records:[{studentId:'fictional-1',status:'present'}]});
  assert.equal(f.store.state.phase,'saving');assert.equal(f.store.state.students[0].status,'unmarked');
  await f.store.mutate('save',{records:[{studentId:'fictional-1',status:'absent'}]});resume();await pending;
  assert.equal(f.calls.length,1);assert.equal(f.store.state.phase,'saved');assert.equal(f.store.state.students[0].status,'present');
  await f.store.mutate('finalize',{confirm:true});assert.equal(f.store.state.data.state,'completed');
  await f.store.mutate('save',{records:[{studentId:'fictional-1',status:'absent'}]});assert.equal(f.calls.length,2);
  await f.store.mutate('correct',{records:[{studentId:'fictional-1',status:'excused'}],reason:'Koreksi fiktif'});assert.equal(f.store.state.data.state,'draft');assert.equal(f.store.state.students[0].status,'excused');
});
test('Lost responses retain the exact command for explicit retry, then read the latest revision instead of stale receipt',async()=>{
  const f=fixture();await f.store.load(scope);const save=f.client.saveAttendance;let receipt;
  f.client.saveAttendance=async(...args)=>{receipt=await save(...args);throw Error('Koneksi terputus');};
  await f.store.mutate('save',{records:[{studentId:'fictional-1',status:'present'}]});assert.equal(f.store.state.phase,'error');assert.equal(f.store.state.students[0].status,'unmarked');
  const command=f.store.state.pending.body;
  f.data.set(scope.serviceSessionId,{...receipt,revision:2,records:[{studentId:'fictional-1',status:'excused',updatedAt:null}]});
  f.client.saveAttendance=async(s,b)=>{assert.deepEqual(b,command);return receipt;};
  await f.store.retry();assert.equal(f.calls.length,1);assert.equal(f.store.state.phase,'saved');assert.equal(f.store.state.data.revision,2);assert.equal(f.store.state.students[0].status,'excused');
});
test('Conflicts require reload without replay; old modal revisions cannot submit against a refreshed version',async()=>{
  const f=fixture();await f.store.load(scope);f.client.saveAttendance=async()=>{throw Object.assign(Error(),{status:409});};
  await f.store.mutate('save',{records:[{studentId:'fictional-1',status:'present'}]});assert.equal(f.store.state.phase,'conflict');
  await f.store.retry();assert.equal(f.calls.length,0);await f.store.reload();assert.equal(f.store.state.pending,null);
  await f.store.mutate('save',{records:[]},99);assert.equal(f.store.state.phase,'conflict');assert.equal(f.calls.length,0);
});
test('Late writes/reads cannot populate a different scope, and authorization/load failures have no fallback',async()=>{
  const f=fixture();await f.store.load(scope);const save=f.client.saveAttendance;let resume;
  f.client.saveAttendance=async(...args)=>{await new Promise(r=>{resume=r;});return save(...args);};
  const pending=f.store.mutate('save',{records:[{studentId:'fictional-1',status:'present'}]});
  await f.store.load(other);resume();await pending;assert.equal(f.store.state.scope.serviceSessionId,other.serviceSessionId);assert.equal(f.store.state.students[0].status,'unmarked');
  assert.equal(f.data.get(scope.serviceSessionId).records[0].status,'present');
  f.client.readAttendance=async()=>{throw Error('API gagal');};await f.store.load(scope);assert.equal(f.store.state.phase,'load-error');assert.deepEqual(f.store.state.students,[]);
  f.client.readAttendance=async()=>{throw Object.assign(Error(),{status:403});};await f.store.load(other);assert.deepEqual(f.store.state.students,[]);assert.equal(f.store.state.pending,null);
  f.store.reset();assert.equal(f.store.state.data,null);
});
test('Delayed reads and successful responses after credential invalidation cannot restore stale attendance',async()=>{
  const f=fixture(),read=f.client.readAttendance;let resume;
  f.client.readAttendance=async s=>{if(s.serviceSessionId===scope.serviceSessionId)await new Promise(r=>{resume=r;});return read(s);};
  const old=f.store.load(scope);await new Promise(r=>setImmediate(r));await f.store.load(other);resume();await old;
  assert.equal(f.store.state.scope.serviceSessionId,other.serviceSessionId);assert.equal(f.store.state.phase,'ready');
  const pending=f.store.load(scope);await new Promise(r=>setImmediate(r));
  // The second suspended load is deliberately invalidated before it resolves.
  f.client.state.phase='revoked';f.store.reset();resume();await pending;
  assert.equal(f.store.state.phase,'idle');assert.deepEqual(f.store.state.students,[]);
});
