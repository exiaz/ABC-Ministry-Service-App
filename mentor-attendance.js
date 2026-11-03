const scopeKeys=['schoolId','groupId','serviceSessionId'];
const copyScope=scope=>Object.fromEntries(scopeKeys.map(k=>[k,scope[k]]));
export const attendanceStatuses={unmarked:'Belum Diabsen',present:'Hadir',excused:'Izin',absent:'Tidak Hadir'};
const invalid=()=>{throw Error('Respons absensi server tidak sesuai. Muat ulang data server.');};
export function attendanceFrom(value,scope){
  const stamp=v=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
  if(!scopeKeys.every(k=>value?.[k]===scope[k])||!Number.isSafeInteger(value.revision)||value.revision<0||!['not-started','draft','completed'].includes(value.state)||!(value.batchId===null||typeof value.batchId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value.batchId))||!stamp(value.updatedAt)||!stamp(value.finalizedAt)||!Array.isArray(value.records)||value.records.length>300)invalid();
  if(value.state==='not-started'&&(value.batchId!==null||value.revision!==0)||value.state!=='not-started'&&value.batchId===null)invalid();
  const seen=new Set(),records=value.records.map(r=>{
    if(!r||typeof r.studentId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(r.studentId)||seen.has(r.studentId)||!Object.hasOwn(attendanceStatuses,r.status)||!stamp(r.updatedAt))invalid();
    seen.add(r.studentId);return {studentId:r.studentId,status:r.status,updatedAt:r.updatedAt};
  });
  return {...copyScope(scope),batchId:value.batchId,revision:value.revision,state:value.state,updatedAt:value.updatedAt,finalizedAt:value.finalizedAt,records};
}

// Only confirmed server data is rendered. Pending commands live in memory for
// explicit retry, never in browser storage or an offline/background queue.
export function createMentorAttendance(client,onChange){
  let state={phase:'idle',scope:null,data:null,students:[],message:'',pending:null},generation=0;
  const emit=()=>onChange();
  const current=(g)=>g===generation&&client.state.phase==='active';
  const fail=(e,loading=false)=>{
    const forbidden=e.status===403;
    state={...state,phase:e.status===409?'conflict':loading||forbidden?'load-error':'error',errorStatus:e.status,
      ...(forbidden?{data:null,students:[],pending:null}:{}),
      message:e.status===409?'Data atau ketentuan absensi berubah. Muat ulang data server; perubahan lama tidak dikirim ulang otomatis.':forbidden?'Cakupan pelayanan tidak diizinkan. Hubungi admin.':loading?'Daftar siswa dan absensi belum dapat dimuat. Tidak menggunakan data lokal.':'Hasil penyimpanan belum dapat dipastikan. Coba lagi dengan permintaan yang sama atau muat ulang data server.'};emit();
  };
  async function read(scope){
    const roster=await client.readRoster(scope),data=attendanceFrom(await client.readAttendance(scope),scope);
    if(!scopeKeys.every(k=>roster?.[k]===scope[k])||!Array.isArray(roster.students)||roster.students.length!==data.records.length)invalid();
    const records=new Map(data.records.map(r=>[r.studentId,r]));
    const seen=new Set(),students=roster.students.map(s=>{
      if(!records.has(s.id)||seen.has(s.id)||typeof s.name!=='string'||!(s.schoolClass===null||typeof s.schoolClass==='string'))invalid();
      seen.add(s.id);return {id:s.id,name:s.name,schoolClass:s.schoolClass,...records.get(s.id)};
    });
    return {data,students};
  }
  async function load(scope){
    const g=++generation;
    state={phase:'loading',scope:copyScope(scope),data:null,students:[],message:'Memuat daftar siswa dan absensi…',pending:null};emit();
    try{const result=await read(state.scope);if(!current(g))return;state={...state,...result,phase:'ready',message:'Data absensi dimuat dari server.'};emit();}
    catch(e){if(current(g))fail(e,true);}
  }
  async function send(){
    if(!state.pending||state.phase==='saving')return;
    const g=generation,command=state.pending;
    state={...state,phase:'saving',message:'Menyimpan ke server…'};emit();
    try{
      const value=await client[command.method](command.scope,command.body);
      const receipt=attendanceFrom(value,command.scope);
      if(receipt.revision!==command.body.expectedRevision+1)invalid();
      if(!current(g))return;
      // Idempotent retries can return an older receipt. Always read the current
      // version before showing success, never replace new data with that receipt.
      const result=await read(command.scope);
      if(!current(g))return;
      if(result.data.revision<receipt.revision||result.data.batchId!==receipt.batchId)invalid();
      state={...state,...result,phase:'saved',pending:null,message:'Tersimpan di server. Data terbaru telah dimuat.'};emit();
    }catch(e){if(current(g))fail(e);}
  }
  function mutate(action,values={},expectedRevision=state.data?.revision){
    if(!['ready','saved'].includes(state.phase)||state.pending||!state.data)return;
    if(expectedRevision!==state.data.revision){fail({status:409});return;}
    if(action==='finalize'&&(state.data.state!=='draft'||!state.students.length||state.students.some(s=>s.status==='unmarked')))return;
    if(action==='save'&&state.data.state==='completed'||action==='correct'&&state.data.state!=='completed')return;
    const methods={save:'saveAttendance',finalize:'finalizeAttendance',correct:'correctAttendance'};
    if(!methods[action])return;
    const body={...structuredClone(values),expectedRevision,idempotencyKey:crypto.randomUUID()};
    state={...state,pending:{method:methods[action],scope:copyScope(state.scope),body}};
    return send();
  }
  return {
    get state(){return structuredClone(state);},
    load,mutate,
    retry(){if(state.phase==='error'&&state.pending)return send();},
    reload(){if(state.scope&&state.phase!=='saving')return load(state.scope);},
    reset(){generation++;state={phase:'idle',scope:null,data:null,students:[],message:'',pending:null};}
  };
}
