import test from 'node:test';
import assert from 'node:assert/strict';
import {createRosterServer} from '../backend/server.mjs';
import {createEmulatorAttendance} from '../backend/attendance.mjs';
import {buildWorkbook} from '../xlsx.js';
import {readWorkbook} from '../xlsx-reader.js';
import {parseWorkbookXml} from '../backend/workbook-xml.mjs';
import {createMsaXlsx,xlsxFile} from '../backend/msa-xlsx.mjs';

const scope={schoolId:'school',groupId:'group',serviceSessionId:'visit'};
const actor={kind:'msa',uid:'admin',revision:1};
const headers=['ID siswa','Nama siswa','Kelas sekolah','Jenis kelamin'];
const workbook=async rows=>Buffer.from(await buildWorkbook([headers,...rows.map(row=>[...row,'female'])]).arrayBuffer());
const options={parseXml:parseWorkbookXml,cellTypes:true};

function fixture(){
  const rows=new Map();
  let seq=0;
  const put=(key,value)=>rows.set(key,{value,seq:++seq});
  const doc=path=>({id:path.split('/').at(-1),path});
  const collection=name=>({
    doc:(id='auto-'+ ++seq)=>doc(name+'/'+id),
    where(field,_,value){return {...this,conditions:[...this.conditions,[field,value]]};},
    conditions:[],name
  });
  const snap=ref=>{
    const row=rows.get(ref.path);
    return {ref,id:ref.id,exists:!!row,data:()=>row?.value,updateTime:{seconds:row?.seq,nanoseconds:0}};
  };
  const db={async runTransaction(run){
    const writes=[];
    const tx={
      get:async ref=>ref.path?snap(ref):{docs:[...rows.keys()].filter(path=>path.startsWith(ref.name+'/')).map(path=>snap(doc(path))).filter(d=>ref.conditions.every(([field,value])=>d.data()[field]===value))},
      getAll:async(...refs)=>refs.map(snap),
      create:(ref,value)=>writes.push(()=>{assert.ok(!rows.has(ref.path));put(ref.path,value);}),
      update:(ref,patch)=>writes.push(()=>put(ref.path,{...rows.get(ref.path).value,...patch}))
    };
    const result=await run(tx);
    writes.forEach(write=>write());
    return result;
  }};
  const api=createMsaXlsx({db,root:{collection},repository:{describe:async s=>s.groupId===scope.groupId},accounts:{authorizeManager:async(_,caller)=>{
    if(caller.uid!==actor.uid)throw Object.assign(Error('denied'),{status:403});
  }},enabled(){},now:()=>0});
  return {api,db,root:{id:'test-xlsx',collection},rows,put};
}

test('XLSX emits text IDs, neutralizes formulas and decodes XML once',async()=>{
  const file=await xlsxFile([['001',' =1+2','R&D <ABC> &amp;']]);
  const {rows}=await readWorkbook(new Blob([file]),options);
  assert.deepEqual(rows[1].map(cell=>cell.value),['001',"' =1+2",'R&D <ABC> &amp;']);
  assert.equal(rows[1][0].type,'inlineStr');
  assert.throws(()=>parseWorkbookXml('<x>&bad;</x>'));
  assert.throws(()=>parseWorkbookXml('<x><y></x>'));
});

test('Student XLSX preview is read-only and confirmation is scoped, revision-bound and idempotent',async()=>{
  const {api,rows,put}=fixture();
  const file=await workbook([['001','Siswa Fiktif','3A']]);
  await assert.rejects(api.preview({...actor,uid:'pic'},scope,file),{status:403});
  await assert.rejects(api.preview(actor,{...scope,groupId:'other'},file),{status:403});
  const preview=await api.preview(actor,scope,file);
  const command={previewId:preview.previewId,expectedRevision:preview.revision,idempotencyKey:'fictional-key-0001'};
  assert.equal(rows.size,0);
  assert.deepEqual(preview.rows,[{id:'001',name:'Siswa Fiktif',schoolClass:'3A',gender:'female'}]);
  await assert.rejects(api.confirm(actor,scope,file,{...command,previewId:'0'.repeat(64)}),{status:409});
  const changed=await workbook([['001','Nama Berbeda','3A']]);
  await assert.rejects(api.confirm(actor,scope,changed,command),{status:409});
  put('students/other',{id:'other',schoolId:'other',groupId:'elsewhere',active:true});
  const collision=await workbook([['002','Siswa Fiktif','3A'],['other','Siswa Lain','3A']]);
  await assert.rejects(api.preview(actor,scope,collision),{status:409});
  assert.equal(rows.has('students/002'),false);
  assert.deepEqual(await api.confirm(actor,scope,file,command),{created:1,updated:0,unchanged:0});
  assert.deepEqual(await api.confirm(actor,scope,file,command),{created:1,updated:0,unchanged:0});
  assert.equal([...rows.keys()].filter(key=>key.startsWith('msaXlsxAudit/')).length,1);
  await assert.rejects(api.exportStudents(actor,{scope,expectedRevision:preview.revision}),{status:409});
  const {revision}=await api.exportStudents(actor,{scope});
  const exported=await api.exportStudents(actor,{scope,expectedRevision:revision});
  assert.deepEqual((await readWorkbook(new Blob([exported]),options)).rows[1].map(cell=>cell.value),['001','Siswa Fiktif','3A','female']);
  const stale=await api.preview(actor,scope,file);
  assert.equal(stale.unchanged,1);
  put('students/001',{...rows.get('students/001').value,name:'Siswa Berubah'});
  await assert.rejects(api.confirm(actor,scope,file,{...command,expectedRevision:stale.revision,previewId:stale.previewId,idempotencyKey:'fictional-key-0002'}),{status:409});
  assert.equal(rows.get('students/001').value.name,'Siswa Berubah');
});

test('Mentor HTTP export uses scoped snapshot, rejects stale revisions and excludes private fields',async t=>{
  const previous=process.env.ABC_MSA_XLSX;
  process.env.ABC_MSA_XLSX='1';
  t.after(()=>{if(previous===undefined)delete process.env.ABC_MSA_XLSX;else process.env.ABC_MSA_XLSX=previous;});
  const {db,root,rows,put}=fixture();
  put('schools/school',{id:'school'});
  put('groups/group',{id:'group',schoolId:'school'});
  put('serviceSessions/visit',{id:'visit',schoolId:'school',date:'2026-11-04',groupIds:['group']});
  put('sessions/batch',{...scope,id:'batch',state:'draft',revision:1,records:[
    {studentId:'001',name:'Siswa Fiktif',schoolClass:'3A',status:'present',guardianName:'WALI_FIKTIF_PRIVAT'}
  ]});
  const attendance=createEmulatorAttendance({db,root,now:()=>0,credentials:{authenticate:async auth=>auth==='Bearer mentor'?{grants:[scope]}:null}});
  const server=createRosterServer({attendance,pairing:{verifyRequest:async()=>({deviceId:'fictional-device'})}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const request=(expectedRevision,authorization='Bearer mentor',requested=scope)=>fetch(
    'http://127.0.0.1:'+server.address().port+'/api/attendance/export?'+new URLSearchParams(requested),
    {method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify({format:'attendance',expectedRevision})}
  );
  assert.equal((await request(1,'Bearer invalid')).status,401);
  assert.equal((await request(1,'Bearer mentor',{...scope,groupId:'elsewhere'})).status,403);
  assert.equal((await request(0)).status,409);
  assert.equal([...rows.keys()].filter(key=>key.startsWith('msaXlsxAudit/')).length,0);
  const response=await request(1);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-disposition'),/absensi\.xlsx/);
  const workbook=await readWorkbook(await response.arrayBuffer(),options);
  assert.deepEqual(workbook.rows[1].map(cell=>cell.value),['001','Siswa Fiktif','3A','present','school','group','visit','2026-11-04']);
  assert.equal([...rows.keys()].filter(key=>key.startsWith('msaXlsxAudit/')).length,1);
  assert.equal(rows.get('sessions/batch').value.revision,1);
});
