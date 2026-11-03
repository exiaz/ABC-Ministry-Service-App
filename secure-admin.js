import {resumeMsaSession,isMsaPortal} from './msa-session.js';
import {createAdminCalendar} from './admin-calendar.js';
import {createAdminClient} from './admin-client.js';
import {createAdminDevices} from './admin-devices.js';
import {createAccountPanel} from './admin-accounts.js';
import {createBackupPanel} from './admin-backup.js';
import {msaBrand as brand} from './msa-brand.js';
import {usernameFields} from './username-login.js';
const root=document.querySelector('#admin-root');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usernamePilot=document.body.dataset.usernamePilot==='true';
const tabs=[['overview','Ringkasan','Dasbor kehadiran'],['history','Riwayat absensi','Riwayat absensi'],['schedule','Jadwal Pelayanan','Jadwal Pelayanan'],['students','Data siswa','Data siswa'],['groups','Kelompok & mentor','Kelompok & mentor'],['birthdays','Ulang Tahun Siswa','Ulang tahun siswa']];
tabs.push(['devices','Perangkat Mentor','Perangkat Mentor']);
tabs.push(['accounts','Akun Admin','Pengelolaan akun Admin']);
tabs.push(['backup','Backup Mentor','Backup Mentor / Gabung Kelompok Sementara']);
let selected='overview',devicePanel,accountPanel,calendarPanel,backupPanel;
const dialog=document.querySelector('#admin-device-dialog');
function render(state){
  root.dataset.phase=state.phase;
  if(isMsaPortal()&&state.phase!=='active'){
    root.innerHTML=`<section class="panel pairing-panel">${brand()}<h1>Pengelolaan MSA</h1><p id="admin-message" role="status">${esc(state.message==='Gunakan email dan kata sandi akun Anda.'?'Memeriksa sesi MSA…':state.message)}</p>${state.canVerify?'<button class="btn" data-admin="verify">Periksa kembali sesi</button>':''}${state.phase==='logout-error'?'<button class="btn" data-admin="logout">Coba keluar lagi</button>':''}<p><a class="btn" href="/">Beranda MSA / Masuk</a></p></section>`;
    return;
  }
  if(state.phase!=='active'){
    const busy=['loading','checking','signing-out'].includes(state.phase),pending=state.phase==='logout-error',checking=state.canVerify||state.phase==='checking';
    root.innerHTML=`<section class="panel pairing-panel">${brand()}<p class="eyebrow">ADMIN · DEMO LOKAL</p><h1>Masuk ke dasbor admin</h1><p id="admin-message" role="${['invalid','error','expired','logout-error'].includes(state.phase)?'alert':'status'}" aria-live="polite">${esc(state.message)}</p>${checking?'<button class="btn small" data-admin="verify">Periksa kembali sesi</button><button class="btn small" data-admin="logout">Keluar</button>':pending?'<button class="btn primary" data-admin="logout">Coba keluar lagi</button>':`<form id="admin-login"><div class="form-row"><label for="admin-email">Email Admin</label><input id="admin-email" name="email" type="email" autocomplete="username" required maxlength="254" ${busy?'disabled':''}><small class="calendar-hint">Gunakan email akun yang diberikan kepada Anda.</small></div><div class="form-row"><label for="admin-password">Kata sandi Anda</label><input id="admin-password" name="password" type="password" autocomplete="current-password" aria-describedby="admin-password-help" required maxlength="512" ${busy?'disabled':''}><small id="admin-password-help" class="calendar-hint">Gunakan kata sandi akun Anda.</small><button class="btn small" type="button" data-admin="toggle-password" aria-pressed="false" ${busy?'disabled':''}>Tampilkan kata sandi</button></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${busy?'Memeriksa…':'Masuk'}</button></form>`}<details class="calendar-hint"><summary>Lupa kata sandi?</summary><p>Klik dua kali <strong>Reset Admin Password.cmd</strong> di folder proyek. Ketik GANTI saat diminta, lalu buat password baru. Setelah halaman dibuka kembali, login dengan password baru. Absensi dan izin perangkat tetap.</p></details><details class="calendar-hint"><summary>Server belum siap atau belum membuat akun?</summary><p>Klik dua kali <strong>Start MSA.cmd</strong>. Biarkan jendelanya terbuka dan tunggu <strong>Demo siap</strong>. Saat diminta, buat password dua kali tanpa mengetik perintah apa pun.</p></details><p class="calendar-hint">Khusus data fiktif. Reload halaman memerlukan login ulang.</p></section>`;
    if(usernamePilot){
      const form=root.querySelector('#admin-login');
      if(form){form.innerHTML=usernameFields({disabled:busy})+'<button class="btn primary" type="submit" '+(busy?'disabled':'')+'>Masuk</button>';}
      root.querySelector('.eyebrow').textContent='ADMIN · PILOT USERNAME';
      if(state.phase==='signed-out')root.querySelector('#admin-message').textContent='Gunakan username yang telah diikat ke akun Admin uji Anda.';
      const link=document.createElement('p');link.innerHTML='<a href="/">Masuk dengan email</a>';root.querySelector('.pairing-panel').append(link);
    }
    return;
  }
  if(selected==='accounts'&&state.role!=='superadmin')selected='overview';
  const visibleTabs=tabs.filter(t=>t[0]!=='accounts'||state.role==='superadmin');
  const tab=tabs.find(t=>t[0]===selected)??tabs[0];
  root.innerHTML=`<aside class="sidebar">${brand()}<p class="workspace-label">RUANG PELAYANAN</p><nav aria-label="Navigasi utama"><button class="nav-btn active" data-admin-tab="overview">Dasbor admin</button></nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>Admin · API lokal</strong>Identitas dan izin diperiksa server. Khusus data fiktif.</div><div class="profile"><span class="avatar">AD</span><div><strong>${state.role==='superadmin'?'Superadmin':state.role==='pic'?'Admin':'Admin terotorisasi'}</strong><small>ABC Movement · Surabaya</small></div></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">ABC Movement <span>/</span><strong>Dasbor admin</strong></div><div class="mobile-brand">${brand()}</div><span class="demo-tag">EMULATOR LOKAL</span></header><main class="content"><div class="heading admin-heading"><div><h1>${tab[2]}</h1><p>${esc(state.message)}</p></div><div class="student-actions"><button class="btn" data-admin="verify">Periksa sesi</button><button class="btn" data-admin="logout">Keluar</button></div></div><nav class="admin-tabs" aria-label="Bagian admin">${visibleTabs.map(([id,label])=>`<button data-admin-tab="${id}" class="${selected===id?'active':''}" ${selected===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav><section class="panel"><div class="panel-head"><h2>${tab[1]}</h2><button class="btn small" disabled title="Pengelolaan data server belum tersedia">${selected==='students'?'Tambah siswa':selected==='groups'?'Tambah kelompok':selected==='schedule'?'Tambah jadwal':'Ekspor XLSX'}</button></div><div class="empty" role="status">Data server untuk bagian ini belum tersedia.<br>Pengelolaan belum diaktifkan. Tidak menggunakan data demo atau penyimpanan browser.</div></section><p class="calendar-hint">Sesi terverifikasi: ${esc(state.uid)} · data fiktif.</p><footer class="footer"><span>ABC Movement · Goes to School</span><span>2026 · Admin lokal</span></footer></main></div>`;
  if(selected==='devices')root.querySelector('.content > .panel').outerHTML=devicePanel.view();
  if(selected==='schedule')root.querySelector('.content > .panel').outerHTML=calendarPanel.view();
  if(selected==='accounts')root.querySelector('.content > .panel').outerHTML=accountPanel.view();
  if(selected==='accounts'&&state.msaA1===true){const link=document.createElement('a');link.className='btn';link.href='/a1.html';link.textContent='Pengelolaan pengguna MSA · Uji A1';root.querySelector('.content').append(link);}
  if(selected==='backup')root.querySelector('.content > .panel').outerHTML=backupPanel.view();
}
const client=createAdminClient(state=>{
  if(state.phase!=='active'){devicePanel?.reset({preserveIntent:state.phase==='checking'});accountPanel?.reset();calendarPanel?.reset({preserveIntent:state.phase==='checking'});backupPanel?.reset({preserveIntent:state.phase==='checking'});if(dialog.open)dialog.close();}
  render(state);
  if(state.phase==='active'&&state.role==='superadmin'&&selected==='accounts'&&accountPanel.phase==='idle')void accountPanel.load();
  if(state.phase==='active'&&selected==='schedule'&&calendarPanel.phase==='idle')void calendarPanel.load();
  if(state.phase==='active'&&selected==='devices'&&devicePanel.state.phase==='idle')void devicePanel.load();
  if(state.phase==='active'&&selected==='backup'&&backupPanel.phase==='idle')void backupPanel.load();
});
calendarPanel=createAdminCalendar(client,()=>render(client.state));devicePanel=createAdminDevices(client,()=>render(client.state));accountPanel=createAccountPanel(client,()=>render(client.state));render(client.state);
backupPanel=createBackupPanel(client,()=>render(client.state));
function confirmDevice(kind,id){
  const s=devicePanel.state,device=s.devices.find(d=>d.deviceId===id),pairingId=s.issued?.pairingId;
  if(s.phase!=='ready'||kind==='revoke'&&!device||kind==='cancel-code'&&!pairingId)return;
  dialog.innerHTML=`<div class="modal-top"><h2>${kind==='revoke'?'Cabut akses perangkat?':'Batalkan kode aktivasi?'}</h2></div><form id="device-confirm"><p class="modal-copy">${kind==='revoke'?`Perangkat ${esc(id)} akan kehilangan akses pada permintaan berikutnya. Catatan absensi dan riwayat tetap tersimpan. Untuk mengaktifkan kembali, lakukan pairing baru.`:'Kode yang belum ditebus akan dibatalkan. Jika sudah ditebus, cabut akses perangkat dari daftar.'}</p><div class="modal-actions"><button class="btn" type="button" id="device-confirm-cancel">Batal</button><button class="btn danger" type="submit">${kind==='revoke'?'Ya, cabut akses':'Ya, batalkan kode'}</button></div></form>`;
  dialog.querySelector('#device-confirm-cancel').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();dialog.close();if(client.state.phase!=='active')return;if(kind==='revoke')void devicePanel.revoke(id,true);else if(devicePanel.state.issued?.pairingId===pairingId)void devicePanel.cancelCode(true);};
  dialog.showModal();
}
function confirmActivation(pairingId){
  const row=devicePanel.activation.rows.find(row=>row.pairingId===pairingId);if(!row||devicePanel.activation.busy||!['pending','invalid','service-ended'].includes(row.state))return;
  dialog.innerHTML=`<div class="modal-top"><h2>Cabut kode aktivasi?</h2></div><form><p class="modal-copy">Kode untuk ${esc(row.assignment.groupName)} · ${esc(row.assignment.mentorName)} akan dicabut. Akses perangkat yang sudah aktif dan riwayat absensi tetap; cabut perangkat melalui daftar bila diperlukan.</p><div class="modal-actions"><button class="btn" type="button">Batal</button><button class="btn danger" type="submit">Ya, cabut kode</button></div></form>`;
  dialog.querySelector('button[type=button]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{event.preventDefault();dialog.close();if(client.state.phase==='active')void devicePanel.activation.revoke(pairingId,true);};dialog.showModal();
}
root.addEventListener('submit',e=>{
  if(e.target.id==='backup-form'){e.preventDefault();backupPanel.submit(e.target);return;}
  if(e.target.id==='account-form'){e.preventDefault();void accountPanel.submit(e.target);return;}
  if(e.target.id==='admin-service-form'){e.preventDefault();void calendarPanel.save();return;}
  if(e.target.id==='device-issue-form'){e.preventDefault();void (['superadmin','pic'].includes(client.state.role)?devicePanel.issueActivation():devicePanel.issue());return;}
  if(e.target.id!=='admin-login')return;e.preventDefault();
  const email=root.querySelector(usernamePilot?'#admin-username':'#admin-email').value.trim(),password=root.querySelector('#admin-password').value;
  root.querySelector('#admin-password').value='';void client.login(email,password,{username:usernamePilot});
});
root.addEventListener('click',e=>{
  const backupAction=e.target.closest('[data-backup]');if(backupAction&&client.state.phase==='active'){void backupPanel.click(backupAction);return;}
  const calendarAction=e.target.closest('[data-calendar]');if(calendarAction){const a=calendarAction.dataset.calendar;if(a==='reload')void calendarPanel.load();if(a==='retry')void calendarPanel.retry();if(a==='edit')calendarPanel.edit(calendarAction.dataset.serviceId);if(a==='cancel')calendarPanel.cancel();return;}
  const activationAction=e.target.closest('[data-activation]');
  if(activationAction&&client.state.phase==='active'){
    const action=activationAction.dataset.activation;
    if(action==='issue')void devicePanel.issueActivation();if(action==='retry')void devicePanel.activation.retry();if(action==='hide')devicePanel.activation.hide();if(action==='revoke')confirmActivation(activationAction.dataset.pairingId);return;
  }
  const accountAction=e.target.closest('[data-account]');if(accountAction&&client.state.phase==='active'&&client.state.role==='superadmin'){void accountPanel.click(accountAction);return;}
  const deviceAction=e.target.closest('[data-device]');
  if(deviceAction&&client.state.phase==='active'){
    const action=deviceAction.dataset.device;
    if(action==='reload')void devicePanel.load();
    if(action==='retry-issue')void devicePanel.retryIssue();
    if(action==='hide-code')devicePanel.hideCode();
    if(action==='revoke'||action==='cancel-code')confirmDevice(action,deviceAction.dataset.deviceId);
    return;
  }
  const action=e.target.closest('[data-admin]')?.dataset.admin;
  if(action==='toggle-password'){
    const password=root.querySelector('#admin-password'),button=e.target.closest('[data-admin]');if(!password||password.disabled)return;
    const visible=password.type==='password';password.type=visible?'text':'password';button.textContent=visible?'Sembunyikan kata sandi':'Tampilkan kata sandi';button.setAttribute('aria-pressed',String(visible));
  }
  if(action==='logout'){selected='overview';void client.logout();}
  if(action==='verify')void client.verify();
  const tab=e.target.closest('[data-admin-tab]')?.dataset.adminTab;
  if(tab&&client.state.phase==='active'&&tabs.some(t=>t[0]===tab)){selected=tab;void client.verify();}
});
root.addEventListener('input',e=>{if(e.target.closest('#account-form'))accountPanel.input(e.target);});
root.addEventListener('change',e=>{if(client.state.phase==='active'&&e.target.dataset.backupField){backupPanel.choose(e.target.dataset.backupField,e.target.value,e.target.checked);return;}if(client.state.phase==='active'&&e.target.dataset.calendarField){calendarPanel.choose(e.target.dataset.calendarField,e.target.value,e.target.checked);return;}if(client.state.phase==='active'&&e.target.dataset.deviceField)devicePanel.choose(e.target.dataset.deviceField,e.target.value,e.target.checked);});
setInterval(()=>devicePanel.expireCode(),1000);
for(const event of ['focus','online','offline'])window.addEventListener(event,()=>void client.verify());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void client.verify();});
setInterval(()=>{if(!document.hidden&&client.state.phase==='active')void client.verify();},45000);

void resumeMsaSession(()=>client.resumePortal());
