const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={'pairing:read':'Lihat cakupan dan perangkat','pairing:issue':'Terbitkan kode Mentor','pairing:revoke':'Cabut kode/perangkat'};
const key=s=>JSON.stringify([s.schoolId,s.groupId,s.serviceSessionId]);
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
      return `<section class="panel" id="admin-accounts"><h2>Akun PIC</h2><p role="status">${esc(message)}</p><button class="btn small" data-account="reload" ${busy?'disabled':''}>Muat ulang</button><p>Setiap PIC memakai email dan kata sandi sendiri. Izin berlaku hanya untuk cakupan dan tindakan yang dipilih. Perubahan cakupan diterapkan saat status Aktif; Nonaktif/Dicabut mempertahankan cakupan lama.</p>${phase==='ready'?`<form id="account-form"><h3>${selected?'Ubah izin PIC':'Buat akun PIC'}</h3>${selected?`<p>${esc(selected.email)}</p><label>Status <select name="state"><option value="active" ${selected.state==='active'?'selected':''}>Aktif</option><option value="disabled" ${selected.state==='disabled'?'selected':''}>Nonaktif</option><option value="revoked" ${selected.state==='revoked'?'selected':''}>Dicabut</option></select></label>`:'<div class="form-row"><label>Email fiktif<input name="email" type="email" required maxlength="254" placeholder="pic.pakel@abc-attendance.test" autocomplete="off"></label><label>Kata sandi awal (12–128 karakter)<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></div><p>Bagikan kata sandi secara privat. Kata sandi tidak akan ditampilkan kembali.</p>'}<fieldset><legend>Tindakan yang diizinkan</legend>${Object.entries(labels).map(([action,label])=>`<label><input type="checkbox" name="action" value="${action}" ${selected?selected.actions.includes(action)?'checked':'':action==='pairing:read'?'checked':''}> ${label}</label>`).join('<br>')}</fieldset><fieldset><legend>Sekolah, sesi dan kelompok</legend>${contexts.map((s,i)=>`<label><input type="checkbox" name="scope" value="${i}" ${selected?.grants.some(g=>key(g)===key(s))?'checked':''}> ${esc(s.schoolName)} · ${esc(s.serviceDate)} · ${esc(s.groupName)} / ${esc(s.mentorName)}</label>`).join('<br>')}</fieldset><button class="btn primary" type="submit">${selected?'Simpan perubahan':'Buat PIC'}</button>${selected?'<button class="btn" type="button" data-account="cancel">Batal mengubah</button>':''}</form>`:''}<div>${rows.map(r=>`<article class="device-card"><strong>${esc(r.email)}</strong><p>Status: ${esc(r.state)} · ${r.grants.length} cakupan</p>${['active','disabled','revoked'].includes(r.state)?`<button class="btn small" data-account="edit" data-uid="${esc(r.uid)}" ${busy?'disabled':''}>Ubah izin / status</button>`:'<p>Setup belum lengkap. Minta operator memeriksa; akun tidak dapat digunakan.</p>'}</article>`).join('')}</div></section>`;
    },
    click(button){
      if(button.dataset.account==='reload')return load();
      if(phase!=='ready')return;
      if(button.dataset.account==='edit')editing=button.dataset.uid;
      if(button.dataset.account==='cancel')editing=null;
      notify();
    },
    async submit(form){
      if(phase!=='ready'||client.state.role!=='superadmin')return;
      const selected=rows.find(r=>r.uid===editing),data=new FormData(form),actions=data.getAll('action'),grants=data.getAll('scope').map(i=>contexts[Number(i)]).map(s=>({schoolId:s.schoolId,groupId:s.groupId,serviceSessionId:s.serviceSessionId}));
      if(!actions.length||!grants.length){message='Pilih setidaknya satu tindakan dan cakupan.';notify();return;}
      if(selected&&!window.confirm('Simpan perubahan izin/status untuk '+selected.email+'? Sesi PIC lama akan berakhir. Perangkat Mentor yang sudah aktif tetap.'))return;
      const body=selected?{actions,grants,state:data.get('state'),expectedRevision:selected.revision}:{actions,grants,email:data.get('email'),password:data.get('password')};
      if(form.elements.password)form.elements.password.value='';
      const g=++generation;phase='saving';message='Menyimpan akun…';notify();
      try{if(selected)await client.updateAccount(selected.uid,body);else await client.createAccount(body);if(g!==generation)return;editing=null;await load('Akun PIC tersimpan. Login memakai email dan kata sandi PIC sendiri.');}
      catch(error){if(g===generation){phase='error';message=errorMessage(error);notify();}}
      finally{if('password' in body)body.password='';}
    }
  };
}
