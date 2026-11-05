import test from 'node:test';
import assert from 'node:assert/strict';
import {recurrencePlan} from '../backend/msa-scheduling.mjs';
import {migrationCheckpoint} from '../backend/msa-migration.mjs';
import {scheduleDate} from './fixtures/scheduling-dates.mjs';
const schedule={name:'Pelayanan Fiktif',startDate:'2026-11-03',startTime:'00:15',timezone:'Asia/Jayapura',venue:'Aula Fiktif',picMembershipId:'a'.repeat(64),programId:null,frequency:'weekly',weekday:2,endDate:'2026-11-24'};

test('Relative scheduling fixtures stay future and bounded across weekdays, year and leap-day boundaries',()=>{
  for(const base of ['2026-11-01','2026-12-27','2028-02-25'])for(let day=0;day<7;day++){
    const at=Date.parse(base+'T23:59:59Z')+day*86400000,date=offset=>scheduleDate(offset,at);
    const value={...schedule,startDate:date(),endDate:date(21)},plan=recurrencePlan(value);
    assert.equal(new Date(date()).getUTCDay(),2);assert.ok(plan.fields.startAt>at);assert.ok(plan.fields.startAt<at+90*86400000);assert.equal(plan.dates.length,4);
    assert.equal(recurrencePlan({...value,endDate:date(77)}).dates.length,12);
    assert.throws(()=>recurrencePlan({...value,endDate:date(84)}),e=>e.status===400);
    assert.throws(()=>recurrencePlan({...value,endDate:date(90)}),e=>e.status===400);
    assert.equal(recurrencePlan({...value,frequency:'once',endDate:date()}).dates.length,1);
  }
});
test('Bounded weekly and one-time preview preserves local weekday and explicit Indonesian zones',()=>{
  const p=recurrencePlan(schedule);assert.deepEqual(p.dates,['2026-11-03','2026-11-10','2026-11-17','2026-11-24']);assert.equal(new Date(p.fields.startAt).toISOString(),'2026-11-02T15:15:00.000Z');
  for(const [timezone,hour] of [['Asia/Jakarta','17'],['Asia/Makassar','16'],['Asia/Jayapura','15']])assert.equal(new Date(recurrencePlan({...schedule,timezone}).fields.startAt).toISOString(),`2026-11-02T${hour}:15:00.000Z`);
  assert.equal(recurrencePlan({...schedule,frequency:'once',endDate:schedule.startDate}).dates.length,1);
  assert.equal(recurrencePlan({...schedule,endDate:'2027-01-19'}).dates.length,12);
  assert.deepEqual(recurrencePlan({...schedule,startDate:'2028-02-29',weekday:2,endDate:'2028-03-07'}).dates,['2028-02-29','2028-03-07']);
});
test('Recurrence rejects excess, mismatched weekday, malformed dates/timezone and injected fields',()=>{
  for(const patch of [{endDate:'2027-01-26'},{endDate:'2027-02-01'},{endDate:'2026-11-02'},{weekday:3},{weekday:'2'},{weekday:7},{timezone:undefined},{timezone:'UTC'},{startDate:'2026-02-29'},{frequency:'daily'},{frequency:'once'},{confirmed:true}])assert.throws(()=>recurrencePlan({...schedule,...patch}),e=>e.status===400,JSON.stringify(patch));
});
test('Recurrence parent identities participate in security checkpoints',()=>{
  const a=migrationCheckpoint({msaRecurrenceSeries:[{id:'s',revision:1}]},[],'fictional'),b=migrationCheckpoint({msaRecurrenceSeries:[{id:'s',revision:2}]},[],'fictional');assert.notEqual(a.securityDigest,b.securityDigest);
});
