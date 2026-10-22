import {createAdminClient} from './admin-client.js';
import {createAdminDevices} from './admin-devices.js';
const root=document.querySelector('#admin-root');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand=()=>'<div class="brand"><img class="brand-logo" src="./assets/abc-movement-logo.png" alt="ABC Movement" width="94" height="40"><span class="brand-copy">GOES TO<br>SCHOOL</span></div>';
const tabs=[['overview','Ringkasan','Dasbor kehadiran'],['history','Riwayat absensi','Riwayat absensi'],['schedule','Jadwal Pelayanan','Jadwal Pelayanan'],['students','Data siswa','Data siswa'],['groups','Kelompok & mentor','Kelompok & mentor'],['birthdays','Ulang Tahun Siswa','Ulang tahun siswa']];
tabs.push(['devices','Perangkat Mentor','Perangkat Mentor']);
let selected='overview',devicePanel;
const dialog=document.querySelector('#admin-device-dialog');
function render(state){
  root.dataset.phase=state.phase;
  if(state.phase!=='active'){
    const busy=['loading','checking','signing-out'].includes(state.phase),pending=state.phase==='logout-error',checking=state.canVerify||state.phase==='checking';
    root.innerHTML=`<section class="panel pairing-panel">${brand()}<p class="eyebrow">ADMIN · DEMO LOKAL</p><h1>Masuk ke dasbor admin</h1><p id="admin-message" role="${['invalid','error','expired','logout-error'].includes(state.phase)?'alert':'status'}" aria-live="polite">${esc(state.message)}</p>${checking?'<button class="btn small" data-admin="verify">Periksa kembali sesi</button><button class="btn small" data-admin="logout">Keluar</button>':pending?'<button class="btn primary" data-admin="logout">Coba keluar lagi</button>':`<form id="admin-login"><div class="form-row"><label for="admin-email">Email Admin</label><input id="admin-email" name="email" type="email" value="admin.demo@abc-attendance.test" autocomplete="username" required maxlength="254" ${busy?'disabled':''}><small class="calendar-hint">Email demo sudah diisi. Anda tetap perlu memasukkan password.</small></div><div class="form-row"><label for="admin-password">Kata sandi Anda</label><input id="admin-password" name="password" type="password" autocomplete="current-password" aria-describedby="admin-password-help" required maxlength="512" ${busy?'disabled':''}><small id="admin-password-help" class="calendar-hint">Gunakan password yang dibuat saat pertama kali menjalankan demo.</small><button class="btn small" type="button" data-admin="toggle-password" aria-pressed="false" ${busy?'disabled':''}>Tampilkan kata sandi</button></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${busy?'Memeriksa…':'Masuk'}</button></form>`}<details class="calendar-hint"><summary>Lupa kata sandi?</summary><p>Klik dua kali <strong>Reset Admin Password.cmd</strong> di folder proyek. Ketik GANTI saat diminta, lalu buat password baru. Setelah halaman dibuka kembali, login dengan password baru. Absensi dan izin perangkat tetap.</p></details><details class="calendar-hint"><summary>Server belum siap atau belum membuat akun?</summary><p>Klik dua kali <strong>Start ABC Attendance.cmd</strong>. Biarkan jendelanya terbuka dan tunggu <strong>Demo siap</strong>. Saat diminta, buat password dua kali tanpa mengetik perintah apa pun.</p></details><p class="calendar-hint">Khusus data fiktif. Reload halaman memerlukan login ulang.</p></section>`;
    return;
  }
  const tab=tabs.find(t=>t[0]===selected)??tabs[0];
  root.innerHTML=`<aside class="sidebar">${brand()}<p class="workspace-label">RUANG PELAYANAN</p><nav aria-label="Navigasi utama"><button class="nav-btn active" data-admin-tab="overview">Dasbor admin</button></nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>Admin · API lokal</strong>Identitas dan izin diperiksa server. Khusus data fiktif.</div><div class="profile"><span class="avatar">AD</span><div><strong>Admin terotorisasi</strong><small>ABC Movement · Surabaya</small></div></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">ABC Movement <span>/</span><strong>Dasbor admin</strong></div><div class="mobile-brand">${brand()}</div><span class="demo-tag">EMULATOR LOKAL</span></header><main class="content"><div class="heading admin-heading"><div><h1>${tab[2]}</h1><p>${esc(state.message)}</p></div><div class="student-actions"><button class="btn" data-admin="verify">Periksa sesi</button><button class="btn" data-admin="logout">Keluar</button></div></div><nav class="admin-tabs" aria-label="Bagian admin">${tabs.map(([id,label])=>`<button data-admin-tab="${id}" class="${selected===id?'active':''}" ${selected===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav><section class="panel"><div class="panel-head"><h2>${tab[1]}</h2><button class="btn small" disabled title="Pengelolaan data server belum tersedia">${selected==='students'?'Tambah siswa':selected==='groups'?'Tambah kelompok':selected==='schedule'?'Tambah jadwal':'Ekspor XLSX'}</button></div><div class="empty" role="status">Data server untuk bagian ini belum tersedia.<br>Pengelolaan belum diaktifkan. Tidak menggunakan data demo atau penyimpanan browser.</div></section><p class="calendar-hint">Sesi terverifikasi: ${esc(state.uid)} · data fiktif.</p><footer class="footer"><span>ABC Movement · Goes to School</span><span>2026 · Admin lokal</span></footer></main></div>`;
  if(selected==='devices')root.querySelector('.content > .panel').outerHTML=devicePanel.view();
}
const client=createAdminClient(state=>{
  if(state.phase!=='active'){devicePanel?.reset();if(dialog.open)dialog.close();}
  render(state);
  if(state.phase==='active'&&selected==='devices'&&devicePanel.state.phase==='idle')void devicePanel.load();
});
devicePanel=createAdminDevices(client,()=>render(client.state));render(client.state);
function confirmDevice(kind,id){
  const s=devicePanel.state,device=s.devices.find(d=>d.deviceId===id),pairingId=s.issued?.pairingId;
  if(s.phase!=='ready'||kind==='revoke'&&!device||kind==='cancel-code'&&!pairingId)return;
  dialog.innerHTML=`<div class="modal-top"><h2>${kind==='revoke'?'Cabut akses perangkat?':'Batalkan kode aktivasi?'}</h2></div><form id="device-confirm"><p class="modal-copy">${kind==='revoke'?`Perangkat ${esc(id)} akan kehilangan akses pada permintaan berikutnya. Catatan absensi dan riwayat tetap tersimpan. Untuk mengaktifkan kembali, lakukan pairing baru.`:'Kode yang belum ditebus akan dibatalkan. Jika sudah ditebus, cabut akses perangkat dari daftar.'}</p><div class="modal-actions"><button class="btn" type="button" id="device-confirm-cancel">Batal</button><button class="btn danger" type="submit">${kind==='revoke'?'Ya, cabut akses':'Ya, batalkan kode'}</button></div></form>`;
  dialog.querySelector('#device-confirm-cancel').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();dialog.close();if(client.state.phase!=='active')return;if(kind==='revoke')void devicePanel.revoke(id,true);else if(devicePanel.state.issued?.pairingId===pairingId)void devicePanel.cancelCode(true);};
  dialog.showModal();
}
root.addEventListener('submit',e=>{
  if(e.target.id==='device-issue-form'){e.preventDefault();void devicePanel.issue();return;}
  if(e.target.id!=='admin-login')return;e.preventDefault();
  const email=root.querySelector('#admin-email').value.trim(),password=root.querySelector('#admin-password').value;
  root.querySelector('#admin-password').value='';void client.login(email,password);
});
root.addEventListener('click',e=>{
  const deviceAction=e.target.closest('[data-device]');
  if(deviceAction&&client.state.phase==='active'){
    const action=deviceAction.dataset.device;
    if(action==='reload')void devicePanel.load();
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
root.addEventListener('change',e=>{if(client.state.phase==='active'&&e.target.dataset.deviceField)devicePanel.choose(e.target.dataset.deviceField,e.target.value,e.target.checked);});
setInterval(()=>devicePanel.expireCode(),1000);
for(const event of ['focus','online','offline'])window.addEventListener(event,()=>void client.verify());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void client.verify();});
setInterval(()=>{if(!document.hidden&&client.state.phase==='active')void client.verify();},45000);
