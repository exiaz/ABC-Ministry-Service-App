import {PairingError} from './device-pairing.mjs';

export function requestProof(req,body=''){
  const names=['x-device-timestamp','x-device-nonce','x-device-signature'];
  if(names.some(name=>req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()===name).length!==1))return {};
  return {method:req.method,target:req.url,body,timestamp:req.headers[names[0]],nonce:req.headers[names[1]],signature:req.headers[names[2]]};
}
async function jsonBody(req,keys){
  if(req.headers.origin||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))throw new PairingError(400,'Permintaan pairing tidak valid.');
  if(Number(req.headers['content-length'])>8192){req.resume();throw new PairingError(413,'Permintaan pairing terlalu besar.');}
  let size=0;const chunks=[];
  req.setTimeout(5000,()=>req.destroy());
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>8192){req.resume();throw new PairingError(413,'Permintaan pairing terlalu besar.');}chunks.push(chunk);}
  }finally{req.setTimeout(0);}
  const raw=Buffer.concat(chunks).toString('utf8');let body;
  try{body=JSON.parse(raw);}catch{throw new PairingError(400,'Permintaan pairing tidak valid.');}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!keys.includes(key)))throw new PairingError(400,'Permintaan pairing tidak valid.');
  return {body,raw};
}
export async function adminPairingRoute({req,url,uid,pairing,stillAuthorized,send}){
  const code=/^\/api\/admin\/pairing-codes\/([a-f0-9]{64})\/revoke$/.exec(url.pathname);
  const device=/^\/api\/admin\/devices\/([A-Za-z0-9_-]{1,128})(\/revoke)?$/.exec(url.pathname);
  const issue=url.pathname==='/api/admin/pairing-codes';
  if(!code&&!device&&!issue)return false;
  if(!pairing)throw new PairingError(503,'Pairing emulator lokal tidak tersedia.');
  const method=device&&!device[2]?'GET':'POST';
  if(req.method!==method){send(405,{error:'Metode tidak diizinkan.'},{Allow:method});return true;}
  if(url.search)throw new PairingError(400,'Parameter pairing tidak valid.');
  await pairing.limit('admin',uid,20);
  if(issue){
    const {body}=await jsonBody(req,['grants','codeTtlMs','grantTtlMs']);
    send(201,await pairing.issue(uid,body,stillAuthorized));
  }else if(code){
    await jsonBody(req,[]);send(200,await pairing.revokeCode(uid,code[1],stillAuthorized));
  }else{
    if(device[2])await jsonBody(req,[]);
    send(200,await pairing.adminDevice(uid,device[1],Boolean(device[2]),stillAuthorized));
  }
  return true;
}
export async function redeemPairingRoute({req,url,pairing,send}){
  if(!pairing)throw new PairingError(503,'Pairing emulator lokal tidak tersedia.');
  if(req.method!=='POST'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'POST'});return;}
  // Use the actual socket address, never X-Forwarded-For or a client device ID.
  await pairing.limit('redeem',req.socket.remoteAddress,10);
  if(url.search)throw new PairingError(400,'Kode pairing tidak valid atau tidak berlaku.');
  const {body,raw}=await jsonBody(req,['code','publicKey']);
  send(201,await pairing.redeem(body,requestProof(req,raw)));
}
