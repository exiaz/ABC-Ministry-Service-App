import {prepareDevice,storeDevice,loadDevice,removeDevice,bytes64} from './device-storage.js';
const encoder=new TextEncoder();
const hex=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
export async function deviceHeaders(keys,token,method,target,body=''){
  const timestamp=String(Date.now()),nonce=bytes64(crypto.getRandomValues(new Uint8Array(16)));
  const message=['ABC-DEVICE-V1',method,target,await hex(token),await hex(body),timestamp,nonce].join('\n');
  const signature=bytes64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,encoder.encode(message)));
  return {'X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':signature};
}
export function createPairingClient(apiOrigin,onChange){
  if(!/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.test(apiOrigin)||Number(new URL(apiOrigin).port)>65535)throw Error('Alamat API emulator lokal tidak valid.');
  let state={phase:'checking',message:'Memeriksa izin perangkat…'},busy=false,generation=0;
  const publish=next=>{state=next;onChange({...state});};
  const deny=message=>{generation++;publish({phase:'revoked',message});};
  const channel=globalThis.BroadcastChannel?new BroadcastChannel('abc-mentor-device-changes'):null;
  if(channel)channel.onmessage=()=>{generation++;publish({phase:'inactive',message:'Izin lokal berubah pada tab lain. Periksa kembali sebelum melanjutkan.'});};
  const request=(target,options)=>fetch(apiOrigin+target,{...options,mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
  const validSession=s=>s&&typeof s.deviceId==='string'&&/^[a-f0-9-]{36}$/.test(s.deviceId)&&typeof s.credential==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s.credential)&&Number.isSafeInteger(s.expiresAt);
  async function protectedRead(target){
    const current=generation;
    try{
      if(state.phase!=='active')throw Error();
      const record=await loadDevice(apiOrigin);
      if(current!==generation||!validSession(record?.session))throw Error();
      if(record.session.expiresAt<=Date.now()){
        deny('Masa akses perangkat telah berakhir. Minta kode aktivasi baru kepada admin.');throw Error();
      }
      const response=await request(target,{headers:{Authorization:'Bearer '+record.session.credential,...await deviceHeaders(record.keys,record.session.credential,'GET',target)}});
      if(current!==generation||state.phase!=='active')throw Error();
      if(response.status===401){deny('Akses perangkat dicabut, tidak valid, atau telah berakhir. Hubungi admin.');throw Error();}
      if(!response.ok){const error=Error(response.status===403?'Cakupan sekolah, kelompok, atau pelayanan tidak diizinkan.':'Daftar dari API belum dapat dimuat. Coba lagi setelah koneksi tersedia.');error.status=response.status;throw error;}
      const value=await response.json();
      if(current!==generation||state.phase!=='active')throw Error();
      return value;
    }catch(error){
      if(error.status===403)throw error;
      throw Error('Daftar dari API belum dapat dimuat. Tidak menggunakan data demo atau penyimpanan lokal.');
    }
  }
  async function verify(record,current){
    if(!validSession(record.session))throw Error('Izin perangkat tidak dapat dibaca. Hapus izin lokal lalu aktivasi ulang.');
    const {keys,session}=record;
    if(session.expiresAt<=Date.now()){deny('Masa akses perangkat telah berakhir. Minta kode aktivasi baru kepada admin.');return;}
    const target='/api/device/status';
    const response=await request(target,{headers:{Authorization:'Bearer '+session.credential,...await deviceHeaders(keys,session.credential,'GET',target)}});
    if(current!==generation)return;
    if(response.status===401||response.status===403){deny('Akses perangkat dicabut atau telah berakhir. Hubungi admin untuk aktivasi ulang.');return;}
    if(!response.ok)throw Error('API lokal belum dapat memeriksa izin. Pastikan emulator dan server API aktif, lalu coba lagi.');
    const status=await response.json();
    if(current!==generation)return;
    if(status.deviceId!==session.deviceId||status.state!=='active'||status.expiresAt!==session.expiresAt)throw Error('Status perangkat tidak sesuai. Hubungi admin.');
    publish({phase:'active',message:'Perangkat aktif · API emulator lokal',expiresAt:status.expiresAt});
  }
  return {
    get state(){return {...state};},
    readContexts(){return protectedRead('/api/roster-context');},
    readRoster(scope){
      const keys=['schoolId','groupId','serviceSessionId'];
      if(!scope||!keys.every(k=>typeof scope[k]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(scope[k])))return Promise.reject(Error('Pilihan roster tidak valid.'));
      return protectedRead('/api/roster?'+new URLSearchParams(Object.fromEntries(keys.map(k=>[k,scope[k]]))));
    },
    async restore(){
      if(busy)return;busy=true;const current=generation;
      try{
        if(state.phase!=='active')publish({phase:'checking',message:'Memeriksa izin perangkat…'});
        const record=await loadDevice(apiOrigin);
        if(current!==generation)return;
        if(!record)publish({phase:'inactive',message:'Perangkat belum diaktifkan. Minta kode sekali pakai dari admin.'});
        else await verify(record,current);
      }catch{if(current===generation)publish({phase:'unavailable',message:'Izin perangkat belum dapat diperiksa. Pastikan browser mendukung IndexedDB dan server lokal aktif. Tidak ada akses API yang diberikan.'});}
      finally{busy=false;}
    },
    async activate(code){
      if(busy)return;busy=true;const current=generation;
      publish({phase:'pairing',message:'Mengaktifkan perangkat…'});
      try{
        if(!/^[A-Za-z0-9_-]{22}$/.test(code))throw Error('Kode tidak valid, sudah dipakai, atau kedaluwarsa. Minta kode baru kepada admin.');
        const keys=await prepareDevice(),target='/api/pairing/redeem',body=JSON.stringify({code,publicKey:keys.publicKey});
        const response=await request(target,{method:'POST',body,headers:{'Content-Type':'application/json',...await deviceHeaders(keys,code,'POST',target,body)}});
        if(current!==generation)return;
        if(response.status===400)throw Error('Kode tidak valid, sudah dipakai, atau kedaluwarsa. Minta kode baru kepada admin.');
        if(response.status===429)throw Error('Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.');
        if(!response.ok)throw Error('Aktivasi belum berhasil. Pastikan API lokal dan emulator aktif. Jika kode sudah terpakai, minta kode baru.');
        const session=await response.json();
        if(!validSession(session))throw Error('Respons aktivasi tidak sesuai. Hubungi admin untuk kode baru.');
        await storeDevice(keys,session,apiOrigin);
        channel?.postMessage('changed');
        if(current!==generation){await removeDevice();return;}
        await verify({keys,session},current);
      }catch(error){if(current===generation)publish({phase:'invalid',message:error instanceof TypeError||error?.name==='TimeoutError'?'Aktivasi belum dapat terhubung. Periksa server lokal; kode mungkin sudah terpakai jika respons terputus.':safeMessage(error)});}
      finally{code='';busy=false;}
    },
    async remove(){
      generation++;
      try{await removeDevice();channel?.postMessage('changed');publish({phase:'inactive',message:'Izin lokal dihapus. Catatan absensi fiktif tetap disimpan. Penghapusan ini tidak mencabut perangkat di server.'});}
      catch{publish({phase:'unavailable',message:'Izin lokal belum dapat dihapus. Tutup tab lain dan coba lagi.'});}
    }
  };
}
function safeMessage(error){
  // Errors from browser/crypto/storage must never disclose requests or secrets.
  const allowed=['Kode tidak valid','Terlalu banyak percobaan','Aktivasi belum berhasil','Respons aktivasi tidak sesuai','Browser ini belum mendukung','Kunci perangkat tidak dapat'];
  return allowed.some(prefix=>error?.message?.startsWith(prefix))?error.message:'Penyimpanan atau aktivasi gagal. Jangan gunakan izin sementara; hubungi admin untuk kode baru.';
}
