import {escape as esc} from './data.js';
import {longDate} from './scheduling.js';
import {jakartaToday} from './dates.js';
import {defaultMentorAt,effectiveMentor,mentorName,selectableMentors} from './assignments.js';

export function mentorSelect(db,selected,id='assignment-mentor'){
  return `<div class="form-row"><label for="${id}">Mentor</label><select id="${id}" name="mentorId" required>${selectableMentors(db).map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>`;
}
export function mentorSelectionLabel(db,groupId,serviceSessionId){
  const visit=db.serviceSessions.find(s=>s.id===serviceSessionId),regular=defaultMentorAt(db,groupId,visit.date),effective=effectiveMentor(db,groupId,serviceSessionId);
  return `<span>${esc(regular.name)} </span>${effective.source==='temporary'?`<span class="assignment-replacement">Pengganti sesi ini: ${esc(effective.name)}</span>`:''}`;
}
export function groupManagementRows(db,{schoolId='',groupId=''}={}){
  return db.groups.filter(g=>!g.retired&&(!schoolId||g.schoolId===schoolId)&&(!groupId||g.id===groupId));
}
export function groupsWithAssignmentsView(db,icon,filters={}){
  const groups=groupManagementRows(db,filters),choices=groupManagementRows(db,{schoolId:filters.schoolId});

  return `<div class="filters service-filters"><label class="filter-field">Sekolah<select id="groups-school"><option value="">Semua Sekolah</option>${db.schools.map(s=>`<option value="${s.id}" ${s.id===filters.schoolId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="filter-field">Kelompok Mentor<select id="groups-group"><option value="">Semua Kelompok</option>${choices.map(g=>`<option value="${g.id}" ${g.id===filters.groupId?'selected':''}>${esc(g.name)}${filters.schoolId?'':` · ${esc(db.schools.find(s=>s.id===g.schoolId).name)}`}</option>`).join('')}</select></label></div><section class="panel"><div class="panel-head"><div><h2>Kelompok & mentor tetap</h2><p>${groups.length} / ${db.groups.filter(g=>!g.retired).length} kelompok · penugasan tetap lintas tanggal pelayanan</p></div><button class="btn primary small" data-action="group-form">${icon('plus')} Tambah kelompok</button></div><div class="table-scroll"><table><thead><tr><th>Kelompok</th><th>Sekolah</th><th>Siswa aktif</th><th>Mentor tetap</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${groups.map(g=>{
    const regular=defaultMentorAt(db,g.id),future=db.defaultMentorAssignments.filter(a=>a.groupId===g.id&&a.effectiveFrom>jakartaToday()&&!a.disabledFrom).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
    return `<tr><td><strong>${esc(g.name)}${g.retired?' · arsip':''}</strong></td><td>${esc(db.schools.find(s=>s.id===g.schoolId).name)}</td><td>${db.students.filter(s=>s.active&&s.groupId===g.id).length}</td><td><strong>${esc(regular.name)}</strong>${future.map(a=>`<small>Mulai ${longDate(a.effectiveFrom)}: ${esc(mentorName(db,a.mentorId))}</small>`).join('')}</td><td><div class="assignment-row-actions"><button class="btn soft small" data-action="assignment-edit" data-id="${g.id}">${icon('users')} Ubah penugasan</button><button class="btn text small" data-action="group-form" data-id="${g.id}">${icon('edit')} Ubah kelompok</button></div></td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">Tidak ada kelompok sesuai filter.</td></tr>'}</tbody></table></div><div class="panel-caption">Hanya admin yang mengubah penugasan. Pengganti sementara berlaku pada satu pelayanan; penugasan tetap berlaku mulai tanggal efektif. Kehadiran siswa tidak berubah.</div></section>`;
}
export function assignmentControls(db,groupId,mode,{serviceSessionId='',effectiveFrom=jakartaToday()}={}){
  if(mode==='temporary'){
    const visits=db.serviceSessions.filter(v=>!v.legacy&&v.date>=jakartaToday()&&v.groupIds.includes(groupId)).sort((a,b)=>a.date.localeCompare(b.date));
    if(!visits.length)return '<div class="info-box">Belum ada pelayanan mendatang untuk kelompok ini. Tambahkan melalui Jadwal Pelayanan terlebih dahulu. Penugasan tetap tetap dapat dikelola.</div>';
    const visit=visits.find(v=>v.id===serviceSessionId)||visits[0],existing=db.sessionMentorOverrides.find(a=>a.groupId===groupId&&a.serviceSessionId===visit.id);
    return `<div class="form-row"><label for="assignment-service">Tanggal pelayanan</label><select id="assignment-service" name="serviceSessionId">${visits.map(v=>`<option value="${v.id}" ${v.id===visit.id?'selected':''}>${longDate(v.date)}</option>`).join('')}</select></div>${mentorSelect(db,existing?.mentorId||effectiveMentor(db,groupId,visit.id).mentorId)}<input type="hidden" name="existingAssignmentId" value="${existing?.id||''}"><div class="info-box">Hanya untuk <strong>${longDate(visit.date)}</strong>. Mentor tetap ${esc(defaultMentorAt(db,groupId,visit.date).name)} tidak berubah. ${existing?'Sudah ada pengganti; menyimpan akan memperbarui penugasan sesi ini dan menyimpan riwayat sebelumnya.':''}</div>`;
  }
  const existing=db.defaultMentorAssignments.find(a=>a.groupId===groupId&&a.effectiveFrom===effectiveFrom&&!a.baseline);
  return `<div class="form-row"><label for="assignment-effective">Berlaku mulai tanggal</label><input id="assignment-effective" name="effectiveFrom" type="date" min="${jakartaToday()}" required value="${esc(effectiveFrom)}"></div>${mentorSelect(db,existing?.mentorId||defaultMentorAt(db,groupId,effectiveFrom||jakartaToday()).mentorId)}<input type="hidden" name="existingAssignmentId" value="${existing?.id||''}"><div class="info-box">Menjadi mentor tetap mulai tanggal ini sampai penugasan tetap berikutnya. Sesi lampau tetap memakai penugasan tercatat; pengganti sementara pada sesi tertentu tetap berlaku. ${existing?'Ada rencana pada tanggal ini; menyimpan akan memperbaruinya dengan riwayat perubahan.':''}</div>`;
}
export function assignmentHistory(db,groupId){
  const defaults=db.defaultMentorAssignments.filter(a=>a.groupId===groupId).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
  const overrides=db.sessionMentorOverrides.filter(a=>a.groupId===groupId);
  const past=new Map();
  for(const s of db.mentorAssignmentSnapshots.filter(s=>s.groupId===groupId)){const visit=db.serviceSessions.find(v=>v.id===s.serviceSessionId);if(visit&&(visit.legacy||s.serviceDate<jakartaToday()))past.set(s.serviceSessionId+'_'+s.serviceDate,s);}
  const changes=db.mentorAssignmentEvents.filter(e=>e.next.groupId===groupId);
  return `<details class="assignment-history"><summary>Riwayat penugasan</summary><h3>Mentor tetap</h3>${defaults.map(a=>`<div class="history-row"><span>${esc(mentorName(db,a.mentorId))}<small class="muted"> · ${a.disabledFrom?'Riwayat; dinonaktifkan mulai '+longDate(a.disabledFrom):a.baseline?'Sejak awal demo':longDate(a.effectiveFrom)}</small></span>${!a.baseline&&a.effectiveFrom>=jakartaToday()?`<button type="button" class="btn text small" data-action="assignment-plan-edit" data-id="${a.id}" data-group="${groupId}">Ubah rencana</button>`:''}</div>`).join('')}<h3>Pengganti per pelayanan</h3>${overrides.map(a=>`<div class="history-row"><span>${esc(mentorName(db,a.mentorId))}<small class="muted"> · ${longDate(db.serviceSessions.find(v=>v.id===a.serviceSessionId).date)}</small></span></div>`).join('')||'<p class="muted">Belum ada pengganti sementara.</p>'}<h3>Sesi lampau yang dipertahankan</h3>${[...past.values()].map(s=>`<div class="history-row"><span>${longDate(s.serviceDate)}</span><strong>${esc(s.mentorName)}</strong></div>`).join('')||'<p class="muted">Belum ada catatan sesi lampau.</p>'}<h3>Perubahan admin (${changes.length})</h3>${changes.map(e=>`<div class="history-row"><span>${e.type==='temporary'?'Sementara':e.type==='permanent'?'Tetap':e.type==='retire-demo'?'Penugasan contoh dinonaktifkan':e.type==='configuration'?'Koreksi konfigurasi':'Awal'}: ${e.previous?esc(mentorName(db,e.previous.mentorId))+' → ':''}${esc(mentorName(db,e.next.mentorId))}<small class="muted"> · ${new Intl.DateTimeFormat('id-ID',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(e.changedAt))} WIB</small></span></div>`).join('')}</details>`;
}
