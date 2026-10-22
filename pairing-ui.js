import {escape as esc} from './data.js';
export function mountPairingUI(root,client){
  function update(state){
    root.dataset.phase=state.phase;
    const active=state.phase==='active',busy=['checking','pairing'].includes(state.phase);
    root.innerHTML=active?`<section class="pairing-status info-box" aria-label="Izin perangkat"><div><strong>Perangkat aktif · API lokal</strong><p>Izin perangkat diperiksa server. Absensi fiktif dimuat dan disimpan melalui API lokal sesuai cakupan izin.</p></div><button class="btn small" data-pairing="refresh">Periksa izin</button><button class="btn small" data-pairing="remove">Hapus izin lokal</button></section>`:`<section class="panel pairing-panel"><img src="./assets/abc-movement-logo.png" width="94" height="40" alt="ABC Movement"><p class="eyebrow">AKTIVASI PERANGKAT · EMULATOR LOKAL</p><h1>${state.phase==='revoked'?'Akses perangkat tidak aktif':'Aktifkan perangkat mentor'}</h1><p>Tanpa akun pribadi. Masukkan kode sekali pakai yang diberikan admin berwenang.</p><p id="pairing-message" role="status" aria-live="polite">${esc(state.message)}</p><form id="pairing-form"><div class="form-row"><label for="pairing-code">Kode aktivasi perangkat</label><input id="pairing-code" name="pairingCode" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="22" required aria-describedby="pairing-message" ${busy?'disabled':''}></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${state.phase==='pairing'?'Sedang mengaktifkan…':'Aktifkan perangkat'}</button></form><div class="pairing-actions"><button class="btn small" data-pairing="refresh" ${busy?'disabled':''}>Periksa kembali</button><button class="btn small" data-pairing="remove" ${busy?'disabled':''}>Hapus izin lokal</button></div><p class="muted">Khusus data fiktif. Kode bukan kode admin demo. Menghapus izin lokal tidak menghapus absensi atau mencabut akses perangkat di server.</p><a href="http://127.0.0.1:4173/">Buka demo fiktif terpisah</a></section>`;
  }
  root.addEventListener('submit',event=>{
    if(event.target.id!=='pairing-form')return;event.preventDefault();
    const input=root.querySelector('#pairing-code'),code=input.value.trim();input.value='';
    void client.activate(code);
  });
  root.addEventListener('click',event=>{
    const action=event.target.closest('[data-pairing]')?.dataset.pairing;
    if(action==='refresh')void client.restore();
    if(action==='remove')void client.remove();
  });
  return update;
}
