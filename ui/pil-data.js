// Fictional local presentation data only. Never sent to an operational API.
export const clock='2026-11-06';
export const weeks=['2026-10-02','2026-10-09','2026-10-16','2026-10-23','2026-10-30',clock];
export const organizations=[{id:'test-org-abc',name:'ABC Movement'},{id:'test-org-yayasan',name:'Yayasan'}];
export const programs=[{id:'test-program-school',name:'Goes to School',organizationId:organizations[0].id},{id:'test-program-pojok',name:'Pojok Ceria',organizationId:organizations[0].id},{id:'test-program-natal',name:'Natal 2026',organizationId:organizations[1].id}];
export const identities=[{id:'test-rina',name:'Kak Rina',initials:'R',role:'Admin'},{id:'test-dita',name:'Kak Dita',initials:'D',role:'Mentor'},{id:'test-sari',name:'Kak Sari',initials:'S',role:'Admin'},{id:'test-bayu',name:'Kak Bayu',initials:'B',role:'Admin'},{id:'test-dimas',name:'Kak Dimas',initials:'D',role:'Admin'}];
const entries=[
 ['pojok','Pojok Ceria sesi 4','2026-11-04','15:00','published','Balai RW 04 Pakel','test-bayu',1],
 ['pakel','Pelayanan rutin Jumat','2026-11-06','09:00','published','SDN Pakel V','test-rina',0],
 ['airlangga-draft','Pelayanan rutin Jumat','2026-11-06','10:00','draft','SDN Kertajaya','test-sari',0],
 ['airlangga','Pelayanan SDN Airlangga','2026-11-07','09:00','published','SDN Airlangga','test-dimas',0],
 ['drama','Latihan drama Natal','2026-11-07','14:00','draft','Ruang serbaguna','test-sari',2],
 ['volunteer','Pertemuan Volunteer baru','2026-11-08','10:00','cancelled','Ruang serbaguna','test-dimas',2],
 ['natal','Persiapan Natal 2026','2026-11-08','14:00','draft','Ruang serbaguna','test-sari',2]
];
export const services=entries.map(([id,title,date,time,lifecycle,venue,picId,p])=>({id:'test-service-'+id,title,date,time,startAt:date+'T'+time+':00+07:00',timezone:'Asia/Jakarta',lifecycle,venue,picId,programId:programs[p].id,organizationId:programs[p].organizationId,revision:1}));
export const groups=[24,25,24,25,25,25].map((count,i)=>({id:'test-group-'+(i+1),name:'Kelompok '+(i+1),count,school:['SDN Pakel V','SDN Kertajaya','SDN Pakel V','SDN Airlangga','SDN Pakel V','SDN Kertajaya'][i]}));
const first=['Alya','Bima','Citra','Dafa','Elsa','Fajar','Gita','Hana','Ilham','Jihan','Kevin','Laras','Maya','Naufal','Olivia','Putra','Rafa','Salsa','Tania','Umar','Vina','Wahyu','Yasmin','Zahra','Aditya'];
const last=['Anindita','Pradana','Kusuma','Utami','Wijaya','Permata'];
export const students=groups.flatMap((g,j)=>Array.from({length:g.count},(_,i)=>({id:g.id+'-student-'+(i+1),name:first[i]+' '+last[j],classLabel:'Kelas '+(3+i%2),groupId:g.id})));
const names=['Alya Putri','Bima Saputra','Citra Lestari','Dafa Ramadhan','Elsa Wijaya'];
students.filter(s=>s.groupId===groups[2].id).slice(0,5).forEach((s,i)=>{s.name=names[i];s.classLabel='Kelas '+([3,3,4,4,3][i]);});
export const sessions=weeks.flatMap(date=>groups.map(g=>({id:'test-session-'+date+'-'+g.id,serviceId:'test-service-pakel',groupId:g.id,date,startAt:date+'T09:00:00+07:00',state:date===clock?'draft':'completed',revision:1})));
export const selectedSession=sessions.find(s=>s.date===clock&&s.groupId===groups[2].id);
export const statusLabels={present:'Hadir',excused:'Izin',absent:'Tidak hadir',unmarked:'Belum diisi'};
const historyPresent=[116,124,118,127,130],historyExcused=[12,10,12,8,7];
export const attendance=sessions.flatMap(session=>{
 const roster=students.filter(s=>s.groupId===session.groupId),wi=weeks.indexOf(session.date),gi=groups.findIndex(g=>g.id===session.groupId);
 return roster.map((s,i)=>{
  let status;
  if(wi<5){const index=students.indexOf(s);status=index<historyPresent[wi]?'present':index<historyPresent[wi]+historyExcused[wi]?'excused':'absent';}
  else if(gi===2){status=[2,6,9,12].includes(i)?'unmarked':[3,7].includes(i)?'excused':'present';}
  else {const p=[18,19,18,19,18,19][gi];status=i<p?'present':i<p+2?'excused':'unmarked';}
  return {sessionId:session.id,studentId:s.id,status,updatedAt:session.date+'T09:05:00+07:00'};
 });
});
export const volunteers=Array.from({length:18},(_,i)=>({id:'test-volunteer-'+(i+1),name:first[i]+' '+last[(i+2)%last.length]}));
export const slots=Array.from({length:22},(_,i)=>({id:'test-slot-'+(i+1),serviceId:i===18?'test-service-airlangga':i<21&&i>18?'test-service-airlangga-draft':i===21?'test-service-drama':services.filter(s=>s.lifecycle!=='cancelled')[i%6].id,groupId:i===18?groups[3].id:i===19||i===20?groups[1].id:null,volunteerId:i<18?volunteers[i].id:null}));
export const slotHistory=weeks.map((date,i)=>({date,capacity:22,filled:[18,18,18,19,20,18][i]}));
export const needs=[{label:'SDN Airlangga · Kelompok 4',serviceId:'test-service-airlangga',slotIds:[slots[18].id]},{label:'SDN Kertajaya · Kelompok 2',serviceId:'test-service-airlangga-draft',slotIds:[slots[19].id,slots[20].id]},{label:'Latihan drama Natal',serviceId:'test-service-drama',slotIds:[slots[21].id]}];
export const countStatuses=rows=>Object.fromEntries(Object.keys(statusLabels).map(k=>[k,rows.filter(r=>r.status===k).length]));
export function sessionRoster(sessionId=selectedSession.id,changes={}){return attendance.filter(r=>r.sessionId===sessionId).map(r=>({...students.find(s=>s.id===r.studentId),status:changes[r.studentId]??r.status}));}
export const percent=(n,total)=>total?Math.round(n/total*100):null;
export function weeklyRows(groupId=''){return weeks.map(date=>{const ids=new Set(sessions.filter(s=>s.date===date&&(!groupId||s.groupId===groupId)).map(s=>s.id)),rows=attendance.filter(a=>ids.has(a.sessionId));return {date,total:rows.length,...countStatuses(rows),rate:percent(rows.filter(a=>a.status==='present').length,rows.length)};});}
export function filterServices({query='',status='',organization='',program='',from='',to='',sort='asc'}={}){const q=query.trim().toLocaleLowerCase('id');return services.filter(s=>(!q||(s.title+' '+s.venue).toLocaleLowerCase('id').includes(q))&&(!status||s.lifecycle===status)&&(!organization||s.organizationId===organization)&&(!program||s.programId===program)&&(!from||s.date>=from)&&(!to||s.date<=to)).sort((a,b)=>(sort==='desc'?-1:1)*(a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id)));}
export const initials=name=>name.split(' ').map(n=>n[0]).slice(0,2).join('');
export const formatDate=(date,options={day:'numeric',month:'short'})=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',...options}).format(new Date(date+'T12:00:00+07:00'));
export function validateData(){
 const assertions=[];const check=(ok,message)=>{console.assert(ok,message);assertions.push({ok,message});};
 check(new Set(students.map(s=>s.id)).size===148,'148 unique fictional students');
 check(services.length===7&&new Set(services.map(s=>s.id)).size===7,'7 unique services');
 check(['published','draft','cancelled'].map(status=>services.filter(s=>s.lifecycle===status).length).join() ==='3,3,1','Service lifecycle totals');
 check(sessions.length===36&&attendance.length===888,'36 sessions and 888 attendance records');
 check(attendance.every(a=>students.some(s=>s.id===a.studentId)&&sessions.some(s=>s.id===a.sessionId)&&Object.hasOwn(statusLabels,a.status)),'Valid attendance references and status enum');
 check(new Set(attendance.map(a=>a.sessionId+'/'+a.studentId)).size===attendance.length,'No duplicate session/student pairs');
 const current=countStatuses(sessionRoster());check(current.present===18&&current.excused===2&&current.absent===0&&current.unmarked===4,'Group 3: 18 + 2 + 0 + 4 = 24');
 const rows=weeklyRows();check(rows.map(r=>r.rate).join()==='78,84,80,86,88,75','Weekly displayed percentages');
 check(rows.reduce((s,r)=>s+r.present,0)===726&&percent(726,attendance.length)===82,'726 / 888 rounds to 82%');
 check(rows.at(-1).present===111&&rows.at(-1).excused===12&&rows.at(-1).unmarked===25,'Latest week: 111 + 12 + 25 = 148');
 check(slots.length===22&&slots.filter(s=>s.volunteerId).length===18&&needs.reduce((n,r)=>n+r.slotIds.length,0)===4,'18 filled and 4 empty slots');
 check(slots.every(slot=>services.some(s=>s.id===slot.serviceId&&s.lifecycle!=='cancelled')),'Slots reference services that are not cancelled');
 check(percent(slotHistory.reduce((n,r)=>n+r.filled,0),slotHistory.reduce((n,r)=>n+r.capacity,0))===84,'Volunteer mean occupancy is 84%');
 return assertions;
}
export const dataChecks=validateData();
