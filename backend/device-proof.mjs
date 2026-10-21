import {createHash,createPublicKey,verify} from 'node:crypto';

export const hash=value=>createHash('sha256').update(value).digest('hex');
export const proofMessage=({method,target,token,body='',timestamp,nonce})=>Buffer.from(['ABC-DEVICE-V1',method,target,hash(token),hash(body),timestamp,nonce].join('\n'));

export function devicePublicKey(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{100,160}$/.test(value))throw Error('Kunci perangkat tidak valid.');
  const key=createPublicKey({key:Buffer.from(value,'base64url'),format:'der',type:'spki'});
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1'||key.export({format:'der',type:'spki'}).toString('base64url')!==value)throw Error('Kunci perangkat tidak valid.');
  return key;
}

export function validDeviceProof(publicKey,request,now){
  try{
    const {timestamp,nonce,signature}=request;
    if(typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>60000||!Number.isSafeInteger(Number(timestamp))||typeof nonce!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(nonce)||typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))return false;
    return verify('sha256',proofMessage(request),{key:devicePublicKey(publicKey),dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url'));
  }catch{return false;}
}
