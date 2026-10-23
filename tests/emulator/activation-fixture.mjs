import {randomBytes,randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource,hagai} from './device-management-source.mjs';
import {initializeOwner} from '../../backend/admin-accounts.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';
import {once} from 'node:events';
import {createRosterServer} from '../../backend/server.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';

export {hagai} from './device-management-source.mjs';
export async function activationFixture(t){
  let time=Date.parse('2026-10-28T10:00:00Z');const prior=process.env.ABC_FIRESTORE_NAMESPACE,{source,grants}=deviceManagementSource();source.serviceSessions.find(row=>row.id===hagai.serviceSessionId).date='2026-10-30';const c=await emulatorFixture({source,now:()=>time});process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;
  const f=await adminLoginFixture(t,{pairing:c.pairing});await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});await initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed:true});
  const owner=(await (await f.login()).json()).token;
  t.after(async()=>{const app=initializeApp({projectId:'demo-abc-attendance'},'stage4-cleanup-'+randomUUID());try{const rows=await c.root.collection('adminAccounts').where('role','==','pic').get();if(rows.size)await getAuth(app).deleteUsers(rows.docs.map(row=>row.id));}finally{await deleteApp(app);await c.close();if(prior===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=prior;}});
  const admin=(path,body,token=owner)=>fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Origin:f.base,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const issue=(scopes=[hagai],idempotencyKey=randomUUID(),token=owner)=>admin('/api/admin/activation-codes',{grants:scopes,idempotencyKey},token);
  const command=code=>{
    const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),target='/api/pairing/redeem',body=JSON.stringify({code,publicKey}),timestamp=String(time),nonce=randomBytes(16).toString('base64url');
    // The Admin listener intentionally serves only admin APIs. Redeem directly
    // through the same server-side pairing boundary with the exact signed body.
    return {keys,body:{code,publicKey},proof:{method:'POST',target,body,timestamp,nonce,signature:sign('sha256',proofMessage({token:code,method:'POST',target,body,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}};
  };
  const redeem=async code=>{const request=command(code);return {...await c.pairing.redeem(request.body,request.proof),keys:request.keys};};
  const server=createRosterServer({...c,mentorOrigin:'http://127.0.0.1:4176'});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
  const request=(d,method,target,body)=>{const raw=body===undefined?'':JSON.stringify(body),timestamp=String(time),nonce=randomBytes(16).toString('base64url');return {method,headers:{Authorization:'Bearer '+d.credential,'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body:raw,token:d.credential,timestamp,nonce}),{key:d.keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')},...(body===undefined?{}:{body:raw})};};
  const call=(d,target='/api/device/status',method='GET',body)=>fetch(base+target,request(d,method,target,body));
  return {...c,...f,admin,issue,redeem,command,call,request,base,owner,grants,now:()=>time,advance:ms=>{time+=ms;},setTime:value=>{time=Date.parse(value);}};
}
