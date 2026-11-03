import {msaFetch,isMsaPortal,portalMarker} from './msa-session.js';
// Legacy bearer lives only in this closure. Portal UI uses a marker for its
// server cookie adapter; every operation still verifies backend authority.
export function createAdminClient(onChange,{request=msaFetch}={}){
  let token=null,logoutToken=null,generation=0,state={phase:'signed-out',message:'Gunakan email dan kata sandi akun Anda.'};
  const publish=next=>{state=next;onChange({...state});};
  const call=(path,options={})=>request(path,{...options,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
  const denied=()=>{generation++;token=null;publish({phase:'expired',message:'Sesi berakhir atau izin dicabut. Masuk kembali.'});};
  const session=async(value,g)=>{
    const response=await call('/api/admin/session',{headers:{Authorization:'Bearer '+value}});
    if(g!==generation)return null;
    if([401,403].includes(response.status)){denied();return null;}
    if(!response.ok)throw Error();
    const result=await response.json();
    if(g!==generation)return null;
    if(typeof result?.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.uid)||result.mode!=='emulator-lokal')throw Error();
    return {uid:result.uid,mode:result.mode,...(result.msaA1===true?{msaA1:true}:{}),...(result.role?{role:result.role,actions:result.actions??[]}: {})};
  };
  async function deviceRequest(path,body){
    if(!token||logoutToken||state.phase!=='active')throw Error('Sesi admin belum aktif.');
    const g=generation;
    const response=await call(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(g!==generation||state.phase!=='active')throw Error('Sesi admin berubah.');
    if(response.status===401){denied();throw Error('Sesi admin berakhir.');}
    if(!response.ok){const error=Error(response.status===403?'Izin Anda tidak mencakup permintaan ini.':response.status===409?'Data sudah berubah. Muat ulang sebelum mencoba lagi.':response.status===400?'Periksa email fiktif, kata sandi, tindakan dan cakupan yang dipilih.':response.status===429?'Terlalu banyak permintaan. Coba lagi nanti.':'Permintaan belum berhasil. Periksa koneksi dan kemungkinan email sudah dipakai.');error.status=response.status;
      if(response.status===409){try{const value=await response.json();if(g===generation&&value.duplicateSubmission===true){
        if(/^[a-f0-9]{64}$/.test(value.pairingId)&&Number.isSafeInteger(value.expiresAt))Object.assign(error,{duplicateSubmission:true,pairingId:value.pairingId,expiresAt:value.expiresAt});
        else if(path==='/api/admin/activation-codes'&&Array.isArray(value.codes)&&value.codes.length>0&&value.codes.length<=16&&value.codes.every(row=>/^[a-f0-9]{64}$/.test(row.pairingId)&&Number.isSafeInteger(row.expiresAt)))Object.assign(error,{duplicateSubmission:true,codes:value.codes.map(row=>({pairingId:row.pairingId,createdAt:row.createdAt,expiresAt:row.expiresAt,state:row.state,assignment:row.assignment}))});
      }}catch{}}
      throw error;}
    const value=await response.json();
    if(g!==generation||state.phase!=='active')throw Error('Sesi admin berubah.');
    return value;
  }
  const deviceId=id=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('ID perangkat tidak valid.');return id;};
  return {
    get state(){return {...state};},
    readBackups(){return deviceRequest('/api/admin/backup-assignments');},
    saveBackup(body){return deviceRequest('/api/admin/backup-assignments',body);},
    closeBackup(id,body){if(!/^[a-f0-9]{64}$/.test(id))throw Error('ID penugasan tidak valid.');return deviceRequest('/api/admin/backup-assignments/'+id+'/close',body);},
    readAccounts(){return deviceRequest('/api/admin/accounts');},
    createAccount(body){return deviceRequest('/api/admin/accounts',body);},
    updateAccount(id,body){return deviceRequest('/api/admin/accounts/'+deviceId(id),body);},
    readPairingContext(){return deviceRequest('/api/admin/pairing-context');},
    readServices(){return deviceRequest('/api/admin/service-sessions');},
    saveService(body){return deviceRequest('/api/admin/service-sessions',body);},
    readDevices(){return deviceRequest('/api/admin/devices');},
    issuePairingCode(body){return deviceRequest('/api/admin/pairing-codes',body);},
    issueActivationCodes(body){return deviceRequest('/api/admin/activation-codes',body);},
    readActivationCodes(){return deviceRequest('/api/admin/activation-codes');},
    revokeDevice(id){return deviceRequest('/api/admin/devices/'+deviceId(id)+'/revoke',{});},
    revokePairingCode(id){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('ID kode tidak valid.');return deviceRequest('/api/admin/pairing-codes/'+id+'/revoke',{});},
    async resumePortal(){
      const g=++generation;token='portal-session';
      try{const identity=await session(token,g);if(g===generation&&identity)publish({phase:'active',message:'Identitas dan izin admin diverifikasi server.',...identity});}
      catch{denied();}
    },
    async login(email,password,{username=false}={}){
      if(['loading','checking','signing-out'].includes(state.phase)||token||logoutToken)return;
      const g=++generation;token=null;publish({phase:'loading',message:'Memeriksa akun dan izin admin…'});
      try{
        const response=await call(username?'/api/a1/login':'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(username?{username:email,password}:{email,password})});
        password='';
        if(g!==generation)return;
        if(!response.ok){publish({phase:[401,403].includes(response.status)?'invalid':'error',message:[401,403].includes(response.status)?(username?'Username atau kata sandi tidak sesuai, atau akun belum diizinkan sebagai Admin.':'Email atau kata sandi tidak sesuai, atau akun belum diizinkan sebagai Admin. Periksa kembali isian Anda.'):response.status===429?'Terlalu banyak percobaan. Tunggu satu menit sebelum masuk lagi.':'Server Admin belum siap atau setup belum selesai. Buka Start MSA.cmd, tunggu "Demo siap", lalu coba lagi.'});return;}
        const result=await response.json();
        if(g!==generation)return;
        const portalResult=isMsaPortal()&&result?.token===portalMarker;
        if(!portalResult&&(typeof result?.token!=='string'||result.token.length>16384||!(username?/^[A-Za-z0-9_-]{43}$/:/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.(?:~[A-Za-z0-9_-]{43})?$/).test(result.token)))throw Error();
        token=result.token;
        const identity=await session(token,g);
        if(g!==generation||!identity)return;
        if(identity.uid!==result.uid)throw Error();
        publish({phase:'active',message:'Identitas dan izin admin diverifikasi server.',...identity});
      }catch{if(g===generation)publish({phase:'error',canVerify:!!token,message:token?'Sesi belum dapat diverifikasi. Periksa kembali sesi setelah server pulih.':'Server Admin tidak dapat dihubungi. Buka Start MSA.cmd dan tunggu "Demo siap", lalu coba masuk lagi.'});}
      finally{password='';}
    },
    async verify(){
      if(!token||logoutToken||!['active','error'].includes(state.phase))return;
      const g=++generation,value=token;publish({phase:'checking',message:'Memeriksa sesi admin…'});
      try{const identity=await session(value,g);if(g===generation&&identity)publish({phase:'active',message:'Identitas dan izin admin diverifikasi server.',...identity});}
      catch{if(g===generation)publish({phase:'error',canVerify:true,message:'Izin belum dapat diperiksa. Dashboard ditutup sampai server tersedia.'});}
    },
    async logout(){
      if(state.phase==='signing-out')return;
      const g=++generation;logoutToken=logoutToken??token;token=null;
      publish({phase:'signing-out',message:'Keluar dan mencabut sesi server…'});
      if(!logoutToken){publish({phase:'signed-out',message:'Anda telah keluar.'});return;}
      try{
        const response=await call('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+logoutToken},body:'{}'});
        if(g!==generation)return;
        if(![401,403].includes(response.status)){
          if(!response.ok||(await response.json()).signedOut!==true)throw Error();
        }
        logoutToken=null;publish({phase:'signed-out',message:'Anda telah keluar. Sesi server tidak berlaku lagi.'});
      }catch{if(g===generation)publish({phase:'logout-error',message:'Keluar lokal. Pencabutan sesi server belum terkonfirmasi; coba keluar lagi.'});}
    }
  };
}
