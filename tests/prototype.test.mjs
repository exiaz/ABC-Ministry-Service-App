import test,{mock} from 'node:test';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
import assert from 'node:assert/strict';
import {seed,getSession,CURRENT,count,escape} from '../data.js';
import {buildWorkbook} from '../xlsx.js';
import {saveService} from '../scheduling.js';
import {setPermanentMentor} from '../assignments.js';

test('One current session per group; existing attendance is resumed and school rosters are isolated',()=>{
  const db=seed();
  assert.equal(db.schools.length,3);assert.equal(db.groups.length,16);assert.equal(db.students.length,96);
  const current=getSession(db,'g1','demo-pakel-2026-10-23');
  assert.equal(current.records.length,12);assert.equal(count(current.records).unmarked,12);
  current.records[0].status='present';
  assert.equal(getSession(db,'g1','demo-pakel-2026-10-23'),current);
  assert.equal(db.sessions.filter(s=>s.groupId==='g1'&&s.serviceSessionId==='demo-pakel-2026-10-23').length,1);
  assert.equal(count(getSession(db,'g4','demo-airlangga-2026-10-16').records).present,3);
});
test('Historical snapshots survive roster edits, deactivation and mentor changes',()=>{
  const db=seed(),current=getSession(db,'g1','demo-pakel-2026-10-23'),original=structuredClone(current);
  db.students.find(s=>s.id===current.records[0].studentId).name='Nama diubah';
  db.students.find(s=>s.id===current.records[1].studentId).active=false;
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-chriz',effectiveFrom:'2026-11-06'});db.groups[0].name='Kelompok Baru';
  assert.deepEqual(current,original);
  const visit=saveService(db,{schoolId:'s1',date:'2026-11-06',groupIds:['g1']});
  const next=getSession(db,'g1',visit.id);
  assert.equal(next.records.length,11);assert.equal(next.mentor,'Kak Chriz');
  assert.equal(next.records[0].name,'Nama diubah');assert.equal(next.groupName,'Kelompok Baru');
  assert.equal(getSession(db,'g1','legacy-s1-2026-10-14').state,'completed');
});
test('Counts preserve the four statuses and include provisional records',()=>{
  const records=['present','excused','absent','unmarked','present'].map((status,i)=>({studentId:String(i),status,provisional:i===4}));
  assert.deepEqual(count(records),{present:2,excused:1,absent:1,unmarked:1});
  assert.equal(escape('<img src=x> & "hello"'), '&lt;img src=x&gt; &amp; &quot;hello&quot;');
});
test('XLSX is a valid five-part ZIP with central directory, checksums and escaped literal cells',async()=>{
  const blob=buildWorkbook([['SIMULASI — DATA FIKTIF'],['Nama','Status'],['A & B <contoh>','Hadir'],['=1+1','Izin']]);
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder();
  assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  let offset=0;const files={};const locals=[];
  while(view.getUint32(offset,true)===0x04034b50){
    const crc=view.getUint32(offset+14,true),size=view.getUint32(offset+18,true),nl=view.getUint16(offset+26,true),el=view.getUint16(offset+28,true);
    const name=decoder.decode(bytes.slice(offset+30,offset+30+nl)),start=offset+30+nl+el,body=bytes.slice(start,start+size);
    assert.equal(crc32(body),crc,`CRC: ${name}`);files[name]=decoder.decode(body);locals.push({offset,name,size,crc});offset=start+size;
  }
  assert.equal(Object.keys(files).length,5);
  const centralStart=offset;
  for(const local of locals){assert.equal(view.getUint32(offset,true),0x02014b50);assert.equal(view.getUint32(offset+42,true),local.offset);assert.equal(view.getUint32(offset+16,true),local.crc);const nl=view.getUint16(offset+28,true);assert.equal(decoder.decode(bytes.slice(offset+46,offset+46+nl)),local.name);offset+=46+nl;}
  assert.equal(view.getUint32(offset,true),0x06054b50);assert.equal(view.getUint32(offset+16,true),centralStart);assert.equal(view.getUint16(offset+10,true),5);assert.equal(offset+22,bytes.length);
  assert.match(files['xl/worksheets/sheet1.xml'],/A &amp; B &lt;contoh&gt;/);
  assert.match(files['xl/worksheets/sheet1.xml'],/t="inlineStr"><is><t xml:space="preserve">=1\+1/);
  assert.match(files['xl/workbook.xml'],/SIMULASI - Data Fiktif/);
});
