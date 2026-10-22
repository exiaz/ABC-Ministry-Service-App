export class AdminSessionError extends Error{
  constructor(status,message){super(message);this.status=status;}
}
export function requireAdminOrigin(req){
  const host='127.0.0.1:'+req.socket.localPort;
  if(req.headers.host!==host||req.headers.origin&&req.headers.origin!=='http://'+host)throw new AdminSessionError(403,'Origin admin tidak diizinkan.');
}
async function body(req,keys){
  requireAdminOrigin(req);
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))throw new AdminSessionError(400,'Permintaan admin harus berupa JSON.');
  if(Number(req.headers['content-length'])>4096){req.resume();throw new AdminSessionError(413,'Permintaan admin terlalu besar.');}
  let size=0;const chunks=[];
  req.setTimeout(5000,()=>req.destroy());
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;if(size>4096){req.resume();throw new AdminSessionError(413,'Permintaan admin terlalu besar.');}chunks.push(chunk);
    }
  }finally{req.setTimeout(0);}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AdminSessionError(400,'JSON admin tidak valid.');}
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!keys.includes(k)))throw new AdminSessionError(400,'Parameter admin tidak valid.');
  return value;
}
export function createAdminSessionRoutes(){
  // One loopback listener, bounded process-local attempt window. No client IP,
  // role or UID header is trusted; a restart resets only this local limiter.
  let window=0,attempts=0;
  return {
    async login({req,url,adminAuthentication,send}){
      requireAdminOrigin(req);
      if(req.method!=='POST'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'POST'});return;}
      if(url.search)throw new AdminSessionError(400,'Parameter login tidak valid.');
      const current=Math.floor(Date.now()/60000);if(current!==window){window=current;attempts=0;}
      if(++attempts>10)throw new AdminSessionError(429,'Terlalu banyak percobaan masuk. Tunggu satu menit.');
      let values=await body(req,['email','password']);
      if(typeof values.email!=='string'||!values.email.trim()||values.email.length>254||typeof values.password!=='string'||!values.password||values.password.length>512)throw new AdminSessionError(400,'Email dan kata sandi wajib diisi.');
      let token;
      try{token=await adminAuthentication.signIn({email:values.email.trim(),password:values.password});}
      catch(error){if(error.status===503)throw new AdminSessionError(503,'Auth Emulator belum tersedia. Coba lagi setelah koneksi pulih.');throw new AdminSessionError(401,'Email, kata sandi, atau izin admin tidak valid.');}
      finally{values=null;}
      const principal=await adminAuthentication.authorize('Bearer '+token);
      if(principal.kind!=='ok'){adminAuthentication.revoke(token);throw new AdminSessionError(401,'Sesi admin tidak dapat diverifikasi.');}
      send(200,{token,uid:principal.uid,mode:'emulator-lokal'});
    },
    async logout({req,url,authorization,adminAuthentication,send}){
      if(req.method!=='POST'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'POST'});return;}
      if(url.search)throw new AdminSessionError(400,'Parameter keluar tidak valid.');
      await body(req,[]);
      adminAuthentication.revoke(authorization.slice(7));
      send(200,{signedOut:true});
    }
  };
}
