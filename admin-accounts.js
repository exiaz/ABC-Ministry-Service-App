const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={'pairing:read':'Lihat cakupan dan perangkat','pairing:issue':'Terbitkan kode Mentor dan atur jadwal','pairing:revoke':'Cabut kode/perangkat'};
const key=s=>JSON.stringify([s.schoolId,s.groupId,s.serviceSessionId]);
const states={active:'Aktif',disabled:'Nonaktif',revoked:'Dicabut','setup-pending':'Menunggu setup','setup-failed':'Setup belum berhasil'};
const validEmail=value=>typeof value==='string'&&/^[-a-zA-Z0-9_.+]+@(?:[a-zA-Z0-9-]+\.)*(?:test|example\.invalid)$/.test(value)&&value.length<=254;
export function createAccountPanel(client,notify){
  const errorMessage=error=>Number.isInteger(error.status)?error.message:'Server belum dapat dihubungi. Muat ulang setelah koneksi pulih.';
  let rows=[],contexts=[],editing=null,phase='idle',message='',generation=0;
  const reset=()=>{generation++;rows=[];contexts=[];editing=null;phase='idle';message='';};
  const load=async(success='')=>{
    const g=++generation;phase='loading';message='Memuat akun dan cakupan…';notify();
    try{const a=await client.readAccounts(),c=await client.readPairingContext().catch(error=>{if(error.status===403)return {contexts:[]};throw error;});if(g!==generation)return;if(!Array.isArray(a.accounts)||!Array.isArray(c.contexts))throw Error();rows=a.accounts;contexts=c.contexts;phase='ready';message=success||(contexts.length?'Pilih izin hanya sesuai tanggung jawab PIC.':'Izin pairing pemilik tidak tersedia. Anda tetap dapat menonaktifkan atau mencabut akun PIC.');}
    catch(error){if(g!==generation)return;rows=[];contexts=[];phase='error';message=errorMessage(error);}notify();
  };
  return {
    reset,load,get phase(){return phase;},
    view(){
      const selected=rows.find(r=>r.uid===editing),busy=['loading','saving'].includes(phase);
      const scopeGroups=new Map();contexts.forEach((s,i)=>{const k=JSON.stringify([s.schoolId,s.serviceSessionId]);if(!scopeGroups.has(k))scopeGroups.set(k,{...s,items:[]});scopeGroups.get(k).items.push({...s,index:i});});
      return `<section id="admin-accounts" class="account-workspace" data-state="${phase}" aria-labelledby="account-panel-title">
        <header class="account-section-head"><div><h2 id="account-panel-title">Akun PIC</h2><p>Kelola akun dan izin sesuai tanggung jawab pelayanan.</p></div><button class="btn small" data-account="reload" ${busy?'disabled':''}>Muat ulang akun</button></header>
        <div id="account-feedback" class="account-feedback ${phase==='error'?'account-error':''}" role="${phase==='error'?'alert':'status'}" aria-live="polite" tabindex="-1">${esc(message)}</div>
        ${phase==='ready'?`<form id="account-form" aria-labelledby="account-form-title">
          <div class="account-form-heading"><h3 id="account-form-title">${selected?'Ubah izin PIC':'Buat akun PIC'}</h3><p>Login saat ini menggunakan email akun dan kata sandi.</p></div>
          <div class="account-form-grid">
            <fieldset class="account-card"><legend>Detail akun</legend>
              ${selected?`<p class="account-identity">${esc(selected.email)}</p><div class="form-row"><label for="account-state">Status akun PIC</label><select id="account-state" name="state" aria-describedby="account-state-help">${['active','disabled','revoked'].map(state=>`<option value="${state}" ${selected.state===state?'selected':''}>${states[state]}</option>`).join('')}</select><p class="account-help" id="account-state-help">Nonaktif/Dicabut menutup sesi PIC dan mempertahankan cakupan tersimpan. Pencabutan perangkat dikelola melalui Perangkat Mentor.</p></div>`:`
              <div class="form-row"><label for="account-email">Email akun</label><input id="account-email" name="email" type="email" required maxlength="254" placeholder="pic.pakel@abc-attendance.test" autocomplete="off" spellcheck="false" autocapitalize="none" aria-describedby="account-email-help"><p class="account-help" id="account-email-help">Khusus data fiktif: gunakan alamat .test atau .example.invalid.</p></div>
              <div class="form-row"><label for="account-password">Kata sandi awal</label><input id="account-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="account-password-help"><p class="account-help" id="account-password-help">12–128 karakter. Bagikan secara privat; kata sandi tidak ditampilkan kembali.</p></div>`}
            </fieldset>
            <fieldset id="account-actions" class="account-card" aria-describedby="account-actions-help account-actions-error"><legend>Tindakan yang diizinkan</legend><p id="account-actions-help" class="account-help">Pilih tindakan yang diperlukan PIC.</p><p id="account-actions-error" class="account-field-error" hidden></p><div class="account-options">${Object.entries(labels).map(([action,label],i)=>`<label class="account-option" for="account-action-${i}"><input id="account-action-${i}" type="checkbox" name="action" value="${action}" ${selected?selected.actions.includes(action)?'checked':'':action==='pairing:read'?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>
            <fieldset id="account-scopes" class="account-card account-scopes" aria-describedby="account-scopes-help account-scopes-error"><legend>Sekolah, sesi dan kelompok</legend><p id="account-scopes-help" class="account-help">Pilih kelompok pada sesi yang menjadi tanggung jawab PIC.</p><p id="account-scopes-error" class="account-field-error" hidden></p><div class="account-scope-list">${[...scopeGroups.values()].map(group=>`<fieldset class="account-scope-set"><legend>${esc(group.schoolName)} · ${esc(group.serviceDate)}</legend><p class="account-help">Sesi: ${esc(group.serviceSessionId)}</p><div class="account-scope-options">${group.items.map(s=>`<label class="account-option" for="account-scope-${s.index}"><input id="account-scope-${s.index}" type="checkbox" name="scope" value="${s.index}" ${selected?.grants.some(g=>key(g)===key(s))?'checked':''}><span><strong>${esc(s.groupName)}</strong><small>${esc(s.mentorName)}</small></span></label>`).join('')}</div></fieldset>`).join('')||'<p class="account-help">Cakupan belum tersedia. Muat ulang atau hubungi operator; akun terdaftar tetap dapat dinonaktifkan.</p>'}</div></fieldset>
          </div><div class="account-form-actions"><button class="btn primary" type="submit">${selected?'Simpan perubahan':'Buat PIC'}</button>${selected?'<button class="btn" type="button" data-account="cancel">Batal mengubah</button>':''}</div>
        </form>`:''}
        <section class="account-list" aria-labelledby="account-list-title"><header class="account-section-head"><h3 id="account-list-title">Akun terdaftar</h3><span class="account-help">${rows.length} akun PIC</span></header><div class="account-list-grid">${rows.map(r=>`<article class="device-card account-row"><div><strong class="account-identity">${esc(r.email)}</strong><p><span class="account-state">${esc(states[r.state]??r.state)}</span> · ${r.grants.length} cakupan</p></div>${['active','disabled','revoked'].includes(r.state)?`<button class="btn small" data-account="edit" data-uid="${esc(r.uid)}" aria-label="Ubah izin atau status ${esc(r.email)}" ${busy?'disabled':''}>Ubah izin / status</button>`:'<p class="account-help">Setup belum lengkap. Minta operator memeriksa; akun belum dapat digunakan.</p>'}</article>`).join('')||'<p class="account-help">Belum ada akun PIC yang dimuat.</p>'}</div></section></section>`;
    },
    click(button){
      if(button.dataset.account==='reload')return load();
      if(phase!=='ready')return;
      if(button.dataset.account==='edit')editing=button.dataset.uid;
      if(button.dataset.account==='cancel')editing=null;
      notify();
    },
    input(target){if(target.name==='email'){target.setCustomValidity('');target.removeAttribute('aria-invalid');}},
    async submit(form){
      if(phase!=='ready'||client.state.role!=='superadmin')return;
      const selected=rows.find(r=>r.uid===editing),data=new FormData(form),actions=data.getAll('action'),grants=data.getAll('scope').map(i=>contexts[Number(i)]).map(s=>({schoolId:s.schoolId,groupId:s.groupId,serviceSessionId:s.serviceSessionId}));
      if(!selected&&!validEmail(data.get('email'))){const input=form.elements.email;input.setCustomValidity('Gunakan email fiktif berakhiran .test atau .example.invalid.');input.setAttribute('aria-invalid','true');input.reportValidity();return;}
      if(!form.checkValidity()){form.reportValidity();return;}
      const needsScope=!selected||data.get('state')==='active';
      for(const [id,missing,text] of [['actions',needsScope&&!actions.length,'Pilih setidaknya satu tindakan.'],['scopes',needsScope&&!grants.length,'Pilih setidaknya satu cakupan kelompok dan sesi.']]){const field=form.querySelector('#account-'+id),error=form.querySelector('#account-'+id+'-error');field.setAttribute('aria-invalid',String(missing));error.hidden=!missing;error.textContent=missing?text:'';}
      if(needsScope&&(!actions.length||!grants.length)){message='Periksa tindakan dan cakupan yang belum dipilih.';const feedback=form.closest('#admin-accounts').querySelector('#account-feedback');feedback.textContent=message;feedback.setAttribute('role','alert');feedback.focus();return;}
      if(selected&&!window.confirm('Simpan perubahan izin/status untuk '+selected.email+'? Sesi PIC lama akan berakhir. Pencabutan perangkat Mentor dikelola terpisah.'))return;
      const body=selected?{actions,grants,state:data.get('state'),expectedRevision:selected.revision}:{actions,grants,email:data.get('email'),password:data.get('password')};
      if(form.elements.password)form.elements.password.value='';
      const g=++generation;phase='saving';message='Menyimpan akun…';notify();
      try{if(selected)await client.updateAccount(selected.uid,body);else await client.createAccount(body);if(g!==generation)return;editing=null;await load('Akun PIC tersimpan. Login memakai email dan kata sandi PIC sendiri.');}
      catch(error){if(g===generation){phase='error';message=errorMessage(error);notify();}}
      finally{if('password' in body)body.password='';}
    }
  };
}
