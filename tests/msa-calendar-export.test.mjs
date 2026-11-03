import test from 'node:test';
import assert from 'node:assert/strict';
import {manualCalendarExport,icsText,icsFoldLine} from '../backend/msa-calendar-export.mjs';
const base=()=>({id:'stable-event',organizationId:'fictional-org',name:'Pelayanan & Musik + Anak? #1',venue:'Aula, Lantai 2; Sayap \\ Timur',status:'published',revision:2,startDate:'2026-11-03',startTime:'23:30',timezone:'Asia/Jakarta',startAt:Date.parse('2026-11-03T16:30:00Z'),updatedAt:Date.parse('2026-10-26T04:00:00Z'),picContacts:'PRIVATE-PIC',studentInformation:'PRIVATE-STUDENT',internalNotes:'PRIVATE-NOTES'});
const generate=(patch={},value={})=>manualCalendarExport({namespace:'test-fictional',event:{...base(),...patch},value:{expectedRevision:2,durationMinutes:90,format:'ics',...value},now:Date.parse('2026-10-26T05:00:00Z')});
const unfold=s=>s.replace(/\r\n[ \t]/g,'');
const get=(s,key)=>unfold(s).split('\r\n').find(line=>line.startsWith(key+':'))?.slice(key.length+1);
test('Manual export requires explicit duration/revision/format and published validated data, never caller-overridden text',()=>{
  for(const value of [{durationMinutes:undefined},{durationMinutes:0},{durationMinutes:-1},{durationMinutes:1.5},{durationMinutes:'90'},{durationMinutes:Number.MAX_SAFE_INTEGER},{expectedRevision:0},{format:'invite'},{venue:'caller override'},{description:'PRIVATE-NOTES'}])assert.throws(()=>generate({},value),e=>e.status===400);
  for(const status of ['draft','cancelled'])assert.throws(()=>generate({status}),e=>e.status===403);assert.throws(()=>generate({revision:3}),e=>e.status===409);assert.throws(()=>generate({timezone:'Europe/Paris'}),e=>e.status===409);assert.throws(()=>generate({startAt:0}),e=>e.status===400);assert.throws(()=>generate({name:'Injected\r\nATTENDEE:bad@example.invalid'}),e=>e.status===409);
  assert.throws(()=>generate({updatedAt:Number.MAX_SAFE_INTEGER}),e=>e.status===409);assert.throws(()=>generate({revision:2147483648},{expectedRevision:2147483648}),e=>e.status===409);
});
test('Google prefilled link encodes safe fields, UTC instants and explicit IANA start/end zones without contacts or tokens',()=>{
  const v=generate({}, {format:'google'}),url=new URL(v.googleUrl);assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.pathname,'/calendar/r/eventedit');assert.equal(url.searchParams.get('action'),'TEMPLATE');assert.equal(url.searchParams.get('dates'),'20261103T163000Z/20261103T180000Z');assert.equal(url.searchParams.get('stz'),'Asia/Jakarta');assert.equal(url.searchParams.get('etz'),'Asia/Jakarta');assert.equal(url.searchParams.get('text'),base().name);assert.equal(url.searchParams.get('location'),base().venue);assert.match(url.searchParams.get('details'),/tidak tersinkron otomatis/);assert.deepEqual([...url.searchParams.keys()].sort(),['action','dates','details','etz','location','stz','text']);assert.ok(!v.googleUrl.includes('PRIVATE-'));assert.equal(v.ics,undefined);
});
test('ICS has CRLF, UTF-8 75-octet folding, TEXT escaping, VTIMEZONE and stable identity across revisions/rescheduling',()=>{
  const v=generate(),s=v.ics;assert.ok(s.endsWith('\r\n'));assert.equal(s.replace(/\r\n/g,'').includes('\n'),false);assert.ok(s.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));assert.equal(get(s,'VERSION'),'2.0');assert.equal(get(s,'TZID'),'Asia/Jakarta');assert.equal(get(s,'TZOFFSETTO'),'+0700');assert.equal(get(s,'DTSTART;TZID=Asia/Jakarta'),'20261103T233000');assert.equal(get(s,'DTEND;TZID=Asia/Jakarta'),'20261104T010000');assert.equal(get(s,'DTSTAMP'),'20261026T050000Z');assert.equal(get(s,'LOCATION'),icsText(base().venue));assert.equal(get(s,'STATUS'),'CONFIRMED');assert.ok(!/PRIVATE-|ATTENDEE|ORGANIZER|mailto:|TOKEN|INTERNAL/i.test(s));
  const other=generate({revision:3,startDate:'2026-11-05',startAt:Date.parse('2026-11-05T16:30:00Z')},{expectedRevision:3});assert.equal(get(s,'UID'),get(other.ics,'UID'));assert.equal(get(other.ics,'SEQUENCE'),'3');assert.equal(get(s,'UID')?.includes(base().organizationId),false);
  assert.equal(icsText('A\\B;C,D\r\nE\rF\nG'),'A\\\\B\\;C\\,D\\nE\\nF\\nG');const unicode='SUMMARY:'+('é漢😀'.repeat(50));const folded=icsFoldLine(unicode);assert.equal(unfold(folded),unicode);assert.ok(folded.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));assert.equal(Buffer.from(folded).toString('utf8'),folded);
});
test('All supported IANA zones retain local date rollover independent of process timezone',()=>{
  for(const [timezone,hour,offset] of [['Asia/Jakarta','16','+0700'],['Asia/Makassar','15','+0800'],['Asia/Jayapura','14','+0900']]){
    const v=generate({timezone,startAt:Date.parse('2026-11-03T'+hour+':30:00Z')});assert.equal(get(v.ics,'DTSTART;TZID='+timezone),'20261103T233000');assert.equal(get(v.ics,'DTEND;TZID='+timezone),'20261104T010000');assert.equal(get(v.ics,'TZOFFSETFROM'),offset);assert.equal(v.endAt-v.startAt,90*60000);
  }
});
