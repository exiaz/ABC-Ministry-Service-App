import {createAdminClient} from './admin-client.js';
const root=document.querySelector('#admin-root');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand=()=>'<div class="brand"><img class="brand-logo" src="./assets/abc-movement-logo.png" alt="ABC Movement" width="94" height="40"><span class="brand-copy">GOES TO<br>SCHOOL</span></div>';
const tabs=[['overview','Ringkasan','Dasbor kehadiran'],['history','Riwayat absensi','Riwayat absensi'],['schedule','Jadwal Pelayanan','Jadwal Pelayanan'],['students','Data siswa','Data siswa'],['groups','Kelompok & mentor','Kelompok & mentor'],['birthdays','Ulang Tahun Siswa','Ulang tahun siswa']];
let selected='overview';
function render(state){
  root.dataset.phase=state.phase;
  if(state.phase!=='active'){
    const busy=['loading','checking','signing-out'].includes(state.phase),pending=state.phase==='logout-error',checking=state.canVerify||state.phase==='checking';
    root.innerHTML=`<section class="panel pairing-panel">${brand()}<p class="eyebrow">ADMIN · EMULATOR LOKAL</p><h1>Masuk ke dasbor admin</h1><p id="admin-message" role="${['invalid','error','expired','logout-error'].includes(state.phase)?'alert':'status'}" aria-live="polite">${esc(state.message)}</p>${checking?'<button class="btn small" data-admin="verify">Periksa kembali sesi</button><button class="btn small" data-admin="logout">Keluar</button>':pending?'<button class="btn primary" data-admin="logout">Coba keluar lagi</button>':`<form id="admin-login"><div class="form-row"><label for="admin-email">Email admin</label><input id="admin-email" name="email" type="email" autocomplete="username" required maxlength="254" ${busy?'disabled':''}></div><div class="form-row"><label for="admin-password">Kata sandi</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required maxlength="512" ${busy?'disabled':''}></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${busy?'Memeriksa…':'Masuk'}</button></form>${state.phase==='error'?'<button class="btn small" data-admin="verify">Periksa kembali sesi</button><button class="btn small" data-admin="logout">Keluar</button>':''}`}<p class="calendar-hint">Gunakan akun fiktif yang telah diizinkan operator server. Sesi hanya berada di memori halaman; reload memerlukan login ulang.</p></section>`;
    return;
  }
  const tab=tabs.find(t=>t[0]===selected)??tabs[0];
  root.innerHTML=`<aside class="sidebar">${brand()}<p class="workspace-label">RUANG PELAYANAN</p><nav aria-label="Navigasi utama"><button class="nav-btn active" data-admin-tab="overview">Dasbor admin</button></nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>Admin · API lokal</strong>Identitas dan izin diperiksa server. Khusus data fiktif.</div><div class="profile"><span class="avatar">AD</span><div><strong>Admin terotorisasi</strong><small>ABC Movement · Surabaya</small></div></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">ABC Movement <span>/</span><strong>Dasbor admin</strong></div><div class="mobile-brand">${brand()}</div><span class="demo-tag">EMULATOR LOKAL</span></header><main class="content"><div class="heading admin-heading"><div><h1>${tab[2]}</h1><p>${esc(state.message)}</p></div><div class="student-actions"><button class="btn" data-admin="verify">Periksa sesi</button><button class="btn" data-admin="logout">Keluar</button></div></div><nav class="admin-tabs" aria-label="Bagian admin">${tabs.map(([id,label])=>`<button data-admin-tab="${id}" class="${selected===id?'active':''}" ${selected===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav><section class="panel"><div class="panel-head"><h2>${tab[1]}</h2><button class="btn small" disabled title="Pengelolaan data server belum tersedia">${selected==='students'?'Tambah siswa':selected==='groups'?'Tambah kelompok':selected==='schedule'?'Tambah jadwal':'Ekspor XLSX'}</button></div><div class="empty" role="status">Data server untuk bagian ini belum tersedia.<br>Pengelolaan belum diaktifkan. Tidak menggunakan data demo atau penyimpanan browser.</div></section><p class="calendar-hint">Sesi terverifikasi: ${esc(state.uid)} · data fiktif.</p><footer class="footer"><span>ABC Movement · Goes to School</span><span>2026 · Admin lokal</span></footer></main></div>`;
}
const client=createAdminClient(render);render(client.state);
root.addEventListener('submit',e=>{
  if(e.target.id!=='admin-login')return;e.preventDefault();
  const email=root.querySelector('#admin-email').value.trim(),password=root.querySelector('#admin-password').value;
  root.querySelector('#admin-password').value='';void client.login(email,password);
});
root.addEventListener('click',e=>{
  const action=e.target.closest('[data-admin]')?.dataset.admin;
  if(action==='logout'){selected='overview';void client.logout();}
  if(action==='verify')void client.verify();
  const tab=e.target.closest('[data-admin-tab]')?.dataset.adminTab;
  if(tab&&client.state.phase==='active'&&tabs.some(t=>t[0]===tab)){selected=tab;void client.verify();}
});
for(const event of ['focus','online','offline'])window.addEventListener(event,()=>void client.verify());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void client.verify();});
setInterval(()=>{if(!document.hidden&&client.state.phase==='active')void client.verify();},45000);
