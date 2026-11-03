import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceCommand,AttendanceError} from '../backend/attendance.mjs';

test('Attendance commands accept only explicit states, revision and bounded idempotency keys',()=>{
  const base={expectedRevision:0,idempotencyKey:'fictional-key-0001',records:[{studentId:'fictional-1',status:'unmarked'}]};
  for(const status of ['present','excused','absent','unmarked'])assert.equal(attendanceCommand('save',{...base,records:[{studentId:'fictional-1',status}]}).records[0].status,status);
  for(const changes of [{expectedRevision:-1},{expectedRevision:'0'},{expectedRevision:1.5},{idempotencyKey:'short'},{idempotencyKey:'x'.repeat(129)},{records:[]},{records:[...base.records,...base.records]},{records:[{studentId:'../private',status:'present'}]},{records:[{studentId:'fictional-1',status:'missing'}]},{records:[{studentId:'fictional-1',status:'present',guardianName:'PRIVAT'}]},{state:'completed'}]){
    assert.throws(()=>attendanceCommand('save',{...base,...changes}),e=>e instanceof AttendanceError&&e.status===400);
  }
  const finalize={expectedRevision:1,idempotencyKey:base.idempotencyKey};
  for(const confirm of [undefined,false,'true',1])assert.throws(()=>attendanceCommand('finalize',{...finalize,confirm}),AttendanceError);
  assert.equal(attendanceCommand('finalize',{...finalize,confirm:true}).confirm,true);
  for(const reason of [undefined,'', ' ', 'x'.repeat(501)])assert.throws(()=>attendanceCommand('correct',{...base,reason}),AttendanceError);
  assert.equal(attendanceCommand('correct',{...base,reason:' Koreksi fiktif '}).reason,'Koreksi fiktif');
});
