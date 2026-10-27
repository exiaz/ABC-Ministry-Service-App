const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={active:'Aktif',revoked:'Dicabut',expired:'Kedaluwarsa',suspended:'Akun ditangguhkan',stale:'Perlu aktivasi baru',blocked:'Akses diblokir'};
const time=v=>Number.isSafeInteger(v)?new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'—';
const errorText=e=>e instanceof TypeError||['TimeoutError','AbortError'].includes(e.name)?'Koneksi belum tersedia. Hasil belum dapat dipastikan; periksa jaringan lalu coba lagi.':e.message||'Hasil belum dapat dipastikan. Coba lagi pengajuan yang sama.';
export function createAccountDevicesUI({root,request,base,changed=async()=>{}}){
  let generation=0,data,pending,busy=false,opened=false,message='';
  function render(){
    root.innerHTML=`<section class="account-device-list panel"><h2>Perangkat akun</h2><p>Hanya perangkat yang sudah ditautkan ke akun ini. Perangkat lama yang belum tertaut masih memerlukan rekonsiliasi; kepemilikannya belum dapat dipastikan.</p><button class="btn" data-devices-open ${busy?'disabled':''}>${opened?'Muat ulang perangkat':'Lihat perangkat akun'}</button><p role="status" aria-live="polite">${esc(message)}</p>${opened&&data?`<p>Status akun: ${esc({active:'Aktif',suspended:'Ditangguhkan',disabled:'Nonaktif',rejected:'Ditolak',pending:'Menunggu'}[data.accountState])}</p>${data.devices.map((d,i)=>`<article class="account-device-card"><h3>Perangkat ${i+1} · ${esc(labels[d.state])}</h3><p>${esc(d.groupName)} · ${esc(d.serviceDate)}<br>Diaktifkan: ${time(d.createdAt)}<br>Batas izin: ${time(d.expiresAt)}${d.revokedAt?'<br>Dicabut: '+time(d.revokedAt):''}</p><details><summary>Identitas perangkat</summary><p>${esc(d.deviceId)}</p></details>${d.canRevoke?`<button class="btn danger" data-device-revoke="${esc(d.deviceId)}" ${busy?'disabled':''}>Cabut akses perangkat</button>`:''}</article>`).join('')||'<p>Belum ada perangkat yang tertaut ke akun ini.</p>'}<p>Izin yang dicabut atau tidak berlaku tidak pulih ketika akun diaktifkan kembali. Minta kode baru kepada Admin, lakukan aktivasi, lalu konfirmasikan pemakaian perangkat. Izin lama tidak dipindahkan.</p>`:''}<dialog class="account-device-confirm" aria-label="Konfirmasi pencabutan"><h2>Cabut akses perangkat?</h2><p>Perangkat ini tidak dapat membuka absensi, termasuk kelompok backup. Riwayat absensi tetap tersimpan. Untuk memakai perangkat lagi, diperlukan aktivasi baru yang diizinkan Admin.</p><form><label>Alasan pencabutan<textarea name="reason" required minlength="5" maxlength="300"></textarea></label><div class="device-dialog-actions"><button class="btn" type="button" data-device-cancel autofocus>Batal</button><button class="btn danger" type="submit">Ya, cabut akses</button></div></form><p role="status" data-device-result></p></dialog></section>`;
    root.querySelector('dialog').oncancel=e=>{if(busy)e.preventDefault();else pending=undefined;};
  }
  async function load(){
    if(busy)return;const current=++generation;busy=true;message='Memeriksa perangkat di server…';render();
    try{const value=await request(base());if(current!==generation)return;data=value;opened=true;message='Status perangkat diperiksa oleh server.';}
    catch(e){if(current===generation){data=undefined;message=errorText(e);}}
    finally{if(current===generation){busy=false;render();}}
  }
  root.onclick=e=>{
    if(e.target.closest('[data-devices-open]')){void load();return;}
    if(e.target.closest('[data-device-cancel]')){if(busy)return;root.querySelector('dialog').close();pending=undefined;return;}
    const deviceId=e.target.closest('[data-device-revoke]')?.dataset.deviceRevoke;
    if(deviceId&&!busy){pending={deviceId,revision:data.devices.find(d=>d.deviceId===deviceId).revision,accountRevision:data.accountRevision,requestId:crypto.randomUUID()};root.querySelector('dialog').showModal();}
  };
  root.onsubmit=async e=>{
    e.preventDefault();if(!pending||busy)return;const intent=pending,current=generation,dialog=root.querySelector('dialog'),button=e.submitter;
    const reason=new FormData(e.target).get('reason');
    if(intent.reason!==reason){intent.reason=reason;intent.requestId=crypto.randomUUID();}
    const cancel=dialog.querySelector('[data-device-cancel]');busy=true;button.disabled=true;cancel.disabled=true;
    try{
      await request(base()+'/'+intent.deviceId+'/revoke',{expectedRevision:intent.revision,expectedAccountRevision:intent.accountRevision,requestId:intent.requestId,reason:intent.reason,confirmed:true});
      if(current!==generation)return;dialog.close();pending=undefined;busy=false;await load();await changed();
    }catch(e){if(current===generation){dialog.querySelector('[data-device-result]').textContent=errorText(e);}}
    finally{if(current===generation){busy=false;button.disabled=false;cancel.disabled=false;}}
  };
  return {reset(){generation++;data=undefined;pending=undefined;busy=false;opened=false;message='';render();},load};
}
