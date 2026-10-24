import {fail} from './msa-accounts.mjs';
import {requestProof} from './pairing-http.mjs';

export function mentorSessionHeader(req){
  const count=req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='x-msa-session').length;
  if(count===0)return undefined;
  if(count!==1||typeof req.headers['x-msa-session']!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(req.headers['x-msa-session']))fail(401,'Sesi akun tidak berlaku. Masuk kembali.');
  return req.headers['x-msa-session'];
}
async function json(req){
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
  let size=0;const chunks=[];req.setTimeout(5000,()=>req.destroy());
  try{for await(const c of req.iterator({destroyOnReturn:false})){size+=c.length;if(size>2048){req.resume();fail(413,'Permintaan terlalu besar.');}chunks.push(c);}}finally{req.setTimeout(0);}
  const raw=Buffer.concat(chunks).toString('utf8');let value;try{value=JSON.parse(raw);}catch{fail(400,'JSON tidak valid.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data tidak valid.');return {raw,value};
}
export async function msaMentorRoute({req,url,authorization,local,adminAuthentication,pairing,mentorOrigin,send}){
  if(!url.pathname.startsWith('/api/a2-3/'))return false;
  const mentor=adminAuthentication?.a1?.mentor;
  if(!local||!mentor){send(404,{error:'Tidak ditemukan.'});return true;}
  mentor.enabled();
  if(req.headers.host!=='127.0.0.1:'+req.socket.localPort||req.headers.origin&&req.headers.origin!==mentorOrigin)fail(403,'Origin Mentor tidak diizinkan.');
  if(url.search)fail(400,'Parameter tidak diizinkan.');
  const path=url.pathname,header=mentorSessionHeader(req);
  if(path==='/api/a2-3/login'&&req.method==='POST'){
    const {value}=await json(req);if(Object.keys(value).some(k=>!['username','password'].includes(k)))fail(400,'Parameter login tidak valid.');
    send(200,await mentor.login(value));return true;
  }
  if(!header)fail(401,'Masuk dengan akun Mentor terlebih dahulu.');
  if(path==='/api/a2-3/context'&&req.method==='GET'){send(200,await mentor.context(header));return true;}
  if(path==='/api/a2-3/logout'&&req.method==='POST'){
    const {value}=await json(req);if(Object.keys(value).length)fail(400,'Parameter tidak diizinkan.');send(200,await mentor.logout(header));return true;
  }
  if(path==='/api/a2-3/device-status'&&req.method==='GET'){
    const proof=pairing&&await pairing.verifyRequest(authorization,requestProof(req));send(200,await mentor.deviceStatus(header,authorization,proof));return true;
  }
  if(path==='/api/a2-3/associate'&&req.method==='POST'){
    const {value,raw}=await json(req);if(Object.keys(value).length!==1||!Object.hasOwn(value,'requestId'))fail(400,'Parameter pengajuan perangkat tidak valid.');
    const proof=pairing&&await pairing.verifyRequest(authorization,requestProof(req,raw));send(200,await mentor.associate(header,authorization,proof,value));return true;
  }
  send(405,{error:'Metode atau tindakan tidak diizinkan.'});return true;
}
