import {once} from 'node:events';
import {generateKeyPairSync,sign,randomBytes,randomUUID} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource,hagai} from './device-management-source.mjs';
export {deviceManagementSource,hagai} from './device-management-source.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';
export async function deviceManagementFixture(t,{mentorOrigin}={}){
  let time=Date.now();const {source,grants}=deviceManagementSource(),c=await emulatorFixture({source,now:()=>time});
  const f=await adminLoginFixture(t,{pairing:c.pairing});
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});
  const mentorApi=createRosterServer({...c,mentorOrigin});mentorApi.listen(0,'127.0.0.1');await once(mentorApi,'listening');
  t.after(()=>new Promise(resolve=>{mentorApi.close(resolve);mentorApi.closeAllConnections();}));
  t.after(()=>c.close());
  const mentorBase='http://127.0.0.1:'+mentorApi.address().port;
  const response=await f.login();if(response.status!==200)throw Error('Login fixture gagal.');const token=(await response.json()).token;
  const admin=(target,body,authorization='Bearer '+token)=>fetch(f.base+target,{method:body===undefined?'GET':'POST',headers:{Authorization:authorization,Origin:f.base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(target==='/api/admin/pairing-codes'?{idempotencyKey:randomUUID(),...body}:body)})});
  const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  const headers=(token,method,target,body='')=>{const timestamp=String(time),nonce=randomBytes(16).toString('base64url');return {'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body,token,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
  const redeem=code=>{const target='/api/pairing/redeem',body=JSON.stringify({code,publicKey});return fetch(mentorBase+target,{method:'POST',body,headers:headers(code,'POST',target,body)});};
  const mentor=(credential,scope=hagai)=>{const target='/api/roster?'+new URLSearchParams(scope);return fetch(mentorBase+target,{headers:{...headers(credential,'GET',target),Authorization:'Bearer '+credential}});};
  return {...f,...c,admin,mentorApi,mentorBase,redeem,mentor,grants,token,advance:ms=>{time+=ms;},now:()=>time};
}
