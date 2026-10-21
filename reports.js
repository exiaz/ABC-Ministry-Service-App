import {groupDisplayName,schoolDisplayName,statuses} from './data.js';
import {reportEntries} from './scheduling.js';
import {effectiveMentor,defaultMentorAt} from './assignments.js';
import {GENDERS} from './student-data.js';
export function attendanceExportRows(db,filters){
  const rows=[['ABC GOES TO SCHOOL — ABSENSI TERSIMPAN'],['Lokal saja. Bukan laporan resmi.'],['Bulan',filters.month||'Semua bulan'],['ID sekolah','Sekolah','ID pelayanan','Tanggal pelayanan','ID kelompok','Kelompok','ID siswa','Nama siswa','Status siswa','Status kelompok','Mentor efektif','ID mentor','Sumber penugasan','Siswa sementara','Jenis jadwal']];
  for(const {visit,group,batch} of reportEntries(db,filters)){
    const base=[visit.schoolId,schoolDisplayName(db,group),visit.id,visit.date,group.id,groupDisplayName(db,group)];
    const mentor=effectiveMentor(db,group.id,visit.id),assignment=[mentor.name,mentor.mentorId,mentor.historical?'Riwayat sesi':mentor.source==='temporary'?'Pengganti sementara':'Mentor tetap'];
    if(!batch)rows.push([...base,'','','','Belum dimulai',...assignment,'',visit.legacy?'Arsip demo lama':'Jadwal fiktif']);
    else if(!batch.records.length)rows.push([...base,'','','',batch.state==='completed'?'Selesai':'Draf',...assignment,'',visit.legacy?'Arsip demo lama':'Jadwal fiktif']);
    else for(const r of batch.records)rows.push([...base,r.studentId,r.name,statuses[r.status],batch.state==='completed'?'Selesai':'Draf',...assignment,r.provisional?'Ya':'Tidak',visit.legacy?'Arsip demo lama':'Jadwal fiktif']);
  }
  rows[3].push('Kelas sekolah (snapshot)','ID batch absensi');
  let index=4;
  for(const {batch} of reportEntries(db,filters)){
    if(!batch||!batch.records.length){rows[index++].push('',batch?.id||'');}
    else for(const record of batch.records)rows[index++].push(record.schoolClass??'',batch.id);
  }
  return rows;
}

export function studentExportData(db,{scope='filtered',schoolId='',groupId='',query='',birthMonth=null,admin=false,privateProfiles=false}={}){
  if(!admin)throw Error('Ekspor siswa hanya tersedia bagi admin.');
  const students=db.students.filter(s=>scope==='all'||(s.active&&(!schoolId||s.schoolId===schoolId)&&(!groupId||s.groupId===groupId)&&s.name.toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID'))&&(!birthMonth||Number(db.studentPrivateProfiles?.[s.id]?.dateOfBirth?.slice(5,7))===Number(birthMonth))));
  const headers=['ID siswa','Nama lengkap','Sekolah','Kelas sekolah','Kelompok ABC','Mentor ditugaskan','Jenis kelamin','Status siswa','ID sekolah','ID kelompok'];
  if(privateProfiles)headers.push('Tanggal lahir','Nama orang tua/wali','Alamat rumah');
  const rows=[['ABC GOES TO SCHOOL — DATA LOKAL'],[privateProfiles?'EKSPOR PROFIL PRIVAT — ADMIN':'Ekspor siswa tanpa profil privat'],['Cakupan',scope==='all'?'Semua siswa terdaftar, termasuk nonaktif':'Siswa aktif sesuai filter','Jumlah siswa',students.length,'Sekolah',scope==='all'?'Semua':schoolId||'Semua','Kelompok',scope==='all'?'Semua':groupId||'Semua','Bulan lahir',scope==='all'?'Semua':birthMonth||'Semua','Pencarian',scope==='all'?'':query],headers];
  for(const student of students){
    const group=db.groups.find(g=>g.id===student.groupId),profile=db.studentPrivateProfiles?.[student.id]||{};
    const row=[student.id,student.name,db.schools.find(s=>s.id===student.schoolId)?.name||'',student.schoolClass??'',group?.name||'',defaultMentorAt(db,student.groupId).name,GENDERS[student.gender]||'',student.active?'Aktif':'Nonaktif',student.schoolId,student.groupId];
    if(privateProfiles)row.push(profile.dateOfBirth??'',profile.guardianName??'',profile.address??'');
    rows.push(row);
  }
  return {rows,count:students.length};
}

export function attendanceExportData(db,filters={},scope='filtered'){
  const applied=scope==='all'?{}:filters,rows=attendanceExportRows(db,applied),entries=reportEntries(db,applied);
  const count=entries.reduce((n,e)=>n+(e.batch?.records.length||0),0),pending=entries.filter(e=>!e.batch?.records.length).length;
  rows[2]=['Cakupan',scope==='all'?'Semua riwayat absensi':'Sesuai filter absensi','Jumlah catatan siswa',count,'Baris kelompok kosong/belum dimulai',pending,'Bulan',applied.month||'Semua','Sekolah',applied.schoolId||'Semua','Pelayanan',applied.serviceSessionId||'Semua','Kelompok',applied.groupId||'Semua'];
  return {rows,count,pending};
}
