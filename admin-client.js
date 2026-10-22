// Bearer lives only in this closure. No storage, cookie, refresh token, demo flag
// or decoded client claim supplies authority; every operation verifies backend.
export function createAdminClient(onChange,{request=fetch}={}){
  let token=null,logoutToken=null,generation=0,state={phase:'signed-out',message:'Masuk dengan akun admin fiktif yang diizinkan server.'};
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
    return {uid:result.uid,mode:result.mode};
  };
  async function deviceRequest(path,body){
    if(!token||logoutToken||state.phase!=='active')throw Error('Sesi admin belum aktif.');
    const g=generation;
    const response=await call(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(g!==generation||state.phase!=='active')throw Error('Sesi admin berubah.');
    if(response.status===401){denied();throw Error('Sesi admin berakhir.');}
    if(!response.ok){const error=Error(response.status===403?'Izin pengelolaan perangkat tidak mencakup permintaan ini.':response.status===429?'Terlalu banyak permintaan. Coba lagi nanti.':'Permintaan perangkat belum berhasil. Periksa koneksi.');error.status=response.status;throw error;}
    const value=await response.json();
    if(g!==generation||state.phase!=='active')throw Error('Sesi admin berubah.');
    return value;
  }
  const deviceId=id=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('ID perangkat tidak valid.');return id;};
  return {
    get state(){return {...state};},
    readPairingContext(){return deviceRequest('/api/admin/pairing-context');},
    readDevices(){return deviceRequest('/api/admin/devices');},
    issuePairingCode(body){return deviceRequest('/api/admin/pairing-codes',body);},
    revokeDevice(id){return deviceRequest('/api/admin/devices/'+deviceId(id)+'/revoke',{});},
    revokePairingCode(id){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('ID kode tidak valid.');return deviceRequest('/api/admin/pairing-codes/'+id+'/revoke',{});},
    async login(email,password){
      if(['loading','checking','signing-out'].includes(state.phase)||token||logoutToken)return;
      const g=++generation;token=null;publish({phase:'loading',message:'Memeriksa akun dan izin admin…'});
      try{
        const response=await call('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
        password='';
        if(g!==generation)return;
        if(!response.ok){publish({phase:[401,403].includes(response.status)?'invalid':'error',message:[401,403].includes(response.status)?'Email, kata sandi, atau izin admin tidak valid.':response.status===429?'Terlalu banyak percobaan. Tunggu satu menit.':'Login belum berhasil. Periksa server lokal lalu coba lagi.'});return;}
        const result=await response.json();
        if(g!==generation)return;
        if(typeof result?.token!=='string'||result.token.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.$/.test(result.token))throw Error();
        token=result.token;
        const identity=await session(token,g);
        if(g!==generation||!identity)return;
        if(identity.uid!==result.uid)throw Error();
        publish({phase:'active',message:'Identitas dan izin admin diverifikasi server.',...identity});
      }catch{if(g===generation)publish({phase:'error',canVerify:!!token,message:'Sesi belum dapat diverifikasi. Periksa koneksi lalu coba lagi.'});}
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
