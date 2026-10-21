import {saveRegisteredStudent,normalizeGender} from './student-data.js';
import {isValidDate} from './scheduling.js';

const text=value=>String(value??'').trim();
const norm=value=>text(value).toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
const aliases={id:['id siswa','student id'],name:['nama lengkap','nama siswa','nama','full name'],schoolId:['id sekolah','school id'],school:['sekolah','nama sekolah','school'],groupId:['id kelompok','group id'],group:['kelompok abc','kelompok mentor','kelompok','abc group'],schoolClass:['kelas sekolah','kelas','school class'],gender:['jenis kelamin','gender'],status:['status siswa','student status'],dateOfBirth:['tanggal lahir','tgl lahir','date of birth'],guardianName:['nama orang tua/wali','nama orang tua','nama wali','parent/guardian name'],address:['alamat rumah','alamat','address']};
export function importBirthdate(value,date1904=false){
  const raw=text(value);if(!raw)return null;
  if(isValidDate(raw))return raw;
  const local=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if(local){const date=`${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`;if(isValidDate(date))return date;}
  if(/^\d+(?:\.0+)?$/.test(raw)){
    const serial=Number(raw);if(!date1904&&serial===60)throw Error('Serial Excel 60 bukan tanggal lahir valid.');
    if(serial>=0&&serial<2950000){const epoch=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,serial<60?31:30);return new Date(epoch+serial*86400000).toISOString().slice(0,10);}
  }
  throw Error('Tanggal lahir harus YYYY-MM-DD, DD/MM/YYYY, atau tanggal Excel.');
}
export function planStudentImport(db,{rows,date1904=false},{admin=false}={}){
  if(!admin)throw Error('Impor siswa hanya tersedia bagi admin.');
  const headerIndex=rows.findIndex(row=>row.some(v=>aliases.name.includes(norm(v)))&&row.some(v=>aliases.gender.includes(norm(v))));
  if(headerIndex<0)throw Error('Header Nama lengkap dan Jenis kelamin tidak ditemukan pada worksheet pertama.');
  const header=rows[headerIndex].map(norm),columns={};
  for(const [key,names] of Object.entries(aliases)){const matches=header.flatMap((value,i)=>names.includes(value)?[i]:[]);if(matches.length>1)throw Error('Kolom ganda: '+names[0]);if(matches.length)columns[key]=matches[0];}
  for(const key of ['name','schoolClass','gender'])if(columns[key]===undefined)throw Error('Kolom wajib tidak ditemukan: '+aliases[key][0]);
  if(columns.schoolId===undefined&&columns.school===undefined)throw Error('Kolom sekolah diperlukan.');
  if(columns.groupId===undefined&&columns.group===undefined)throw Error('Kolom kelompok diperlukan.');
  const working=structuredClone(db),seen=new Set(),changes=[],errors=[];let skipped=0;
  for(let index=headerIndex+1;index<rows.length;index++){
    const row=rows[index];if(!row.some(v=>text(v)))continue;
    if(changes.length+skipped+errors.length>=5000)throw Error('Maksimal 5000 siswa.');
    const get=key=>text(row[columns[key]]);
    try{
      let school=columns.schoolId!==undefined&&get('schoolId')?working.schools.find(s=>s.id===get('schoolId')):working.schools.find(s=>norm(s.name)===norm(get('school')));
      if(!school)throw Error('Sekolah tidak ditemukan. Gunakan nama resmi atau ID sekolah.');
      if(get('school')&&norm(get('school'))!==norm(school.name))throw Error('ID dan nama sekolah tidak cocok.');
      const group=get('groupId')?working.groups.find(g=>g.id===get('groupId')&&g.schoolId===school.id):working.groups.find(g=>g.schoolId===school.id&&norm(g.name)===norm(get('group')));
      if(!group)throw Error('Kelompok tidak ditemukan pada sekolah tersebut.');
      if(get('group')&&norm(get('group'))!==norm(group.name))throw Error('ID dan nama kelompok tidak cocok.');
      let existing=get('id')?working.students.find(s=>s.id===get('id')):null;
      const matching=working.students.filter(s=>s.schoolId===school.id&&norm(s.name)===norm(get('name')));
      if(!get('id')&&matching.length>1)throw Error('Nama siswa ambigu. Isi ID siswa yang tepat.');
      if(!get('id')&&matching.length===1)existing=matching[0];
      if(get('id')&&!existing&&matching.length)throw Error('Nama sudah terdaftar dengan ID berbeda. Periksa ID siswa.');
      const identity=existing?.id||get('id')||school.id+'|'+norm(get('name'));
      if(seen.has(identity))throw Error('ID/nama siswa berulang dalam berkas.');seen.add(identity);
      if(get('id').length>128||/[\x00-\x1f]/.test(get('id')))throw Error('ID siswa tidak valid.');
      const genderValue=norm(get('gender')),gender=normalizeGender(genderValue);
      if(genderValue&&!gender)throw Error('Jenis kelamin harus Laki-laki atau Perempuan.');
      const status=norm(get('status'));
      if(status&&!['aktif','nonaktif','active','inactive'].includes(status))throw Error('Status siswa harus Aktif atau Nonaktif.');
      const active=status?!['nonaktif','inactive'].includes(status):existing?.active??true;
      const profile=working.studentPrivateProfiles?.[existing?.id]||{};
      const values={name:get('name'),schoolClass:get('schoolClass')||null,gender,schoolId:school.id,groupId:group.id,dateOfBirth:columns.dateOfBirth!==undefined?importBirthdate(get('dateOfBirth'),date1904):profile.dateOfBirth??null,guardianName:columns.guardianName!==undefined?get('guardianName')||null:profile.guardianName??null,address:columns.address!==undefined?get('address')||null:profile.address??null};
      const unchanged=existing&&['name','schoolClass','gender','schoolId','groupId'].every(k=>(existing[k]??null)===(values[k]??null))&&existing.active===active&&['dateOfBirth','guardianName','address'].every(k=>(profile[k]??null)===(values[k]??null));
      if(unchanged){skipped++;continue;}
      if(!gender)throw Error('Jenis kelamin wajib: Laki-laki atau Perempuan.');
      const saved=saveRegisteredStudent(working,values,{id:existing?.id,newId:!existing&&get('id')?get('id'):null,admin:true});
      saved.active=active;saved.studentStatus=active?'active':'inactive';
      changes.push({row:index+1,id:saved.id,name:saved.name,schoolId:saved.schoolId,groupId:saved.groupId,kind:existing?'update':'create'});
    }catch(error){errors.push({row:index+1,message:error.message});}
  }
  if(!changes.length&&!errors.length&&!skipped)throw Error('Tidak ada baris siswa untuk diimpor.');
  return {sourceFingerprint:JSON.stringify([db.students,db.studentPrivateProfiles,db.schools,db.groups]),changes,errors,skipped,created:changes.filter(c=>c.kind==='create').length,updated:changes.filter(c=>c.kind==='update').length,next:working};
}
export function commitStudentImport(db,plan,{admin=false}={}){
  if(!admin)throw Error('Impor siswa hanya tersedia bagi admin.');
  if(plan.sourceFingerprint!==JSON.stringify([db.students,db.studentPrivateProfiles,db.schools,db.groups]))throw Error('Data berubah. Periksa ulang pratinjau impor.');
  if(plan.errors.length)throw Error('Perbaiki semua baris bermasalah sebelum impor.');
  db.students=plan.next.students;db.studentPrivateProfiles=plan.next.studentPrivateProfiles;
  return {created:plan.created,updated:plan.updated,skipped:plan.skipped};
}
