import {randomBytes,randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {registrationFixture} from './msa-a2-2-fixture.mjs';
import {fictionalRosterData} from '../fixtures/roster.mjs';
import {jakartaToday} from '../../dates.js';
import {createRosterServer} from '../../backend/server.mjs';
import {createPrototypeServer} from '../../server.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';
export const primary={schoolId:'s1',groupId:'g1',serviceSessionId:'fictional-a23-current'};
export const backup={...primary,groupId:'g2'};
export async function mentorAccountFixture(t){
  const prior=process.env.ABC_MSA_A2_3;process.env.ABC_MSA_A2_3='1';
  const source=fictionalRosterData();source.serviceSessions.push({id:primary.serviceSessionId,schoolId:'s1',date:jakartaToday(),groupIds:['g1','g2']});source.defaultMentorAssignments.push({id:'fictional-backup-default',groupId:'g2',mentorId:'fictional-substitute',effectiveFrom:'2026-01-01'});source.students.push({id:'fictional-backup-student',name:'Siswa Backup Fiktif',schoolClass:'4A',schoolId:'s1',groupId:'g2',active:true});
  const f=await registrationFixture(t,{source});
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants:[primary,backup]});
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));const mentorBase='http://127.0.0.1:'+port;
  const server=createRosterServer({...f,mentorOrigin:mentorBase});server.listen(0,'127.0.0.1');await once(server,'listening');const apiBase='http://127.0.0.1:'+server.address().port;
  const shell=createPrototypeServer({mentorMode:true,apiOrigin:apiBase});shell.listen(port,'127.0.0.1');await once(shell,'listening');
  t.after(async()=>{for(const s of [shell,server])await new Promise(resolve=>{s.close(resolve);s.closeAllConnections();});if(prior===undefined)delete process.env.ABC_MSA_A2_3;else process.env.ABC_MSA_A2_3=prior;});
  const account=async({scope=primary,mentorId='fictional-mentor'}={})=>{
    const u=await f.register();if((await f.review(u,{scope})).status!==200)throw Error('Review fixture gagal.');if((await f.link(u,{scope,mentorId})).status!==200)throw Error('Link fixture gagal.');return u;
  };
  const personalRequest=(path,body,token,headers={})=>fetch(apiBase+path,{method:body===undefined?'GET':'POST',headers:{Origin:mentorBase,'Content-Type':'application/json',...(token?{'X-MSA-Session':'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const login=async u=>{const response=await personalRequest('/api/a2-3/login',{username:u.username,password:u.password});return {response,...await response.json()};};
  const issue=async(scope=primary)=>{const r=await f.request('/api/admin/activation-codes',{grants:[scope],idempotencyKey:randomUUID()});if(r.status!==201)throw Error('Kode fixture gagal.');return (await r.json()).codes[0].code;};
  const activate=async(scope=primary)=>{
    const code=await issue(scope),keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),body={code,publicKey},raw=JSON.stringify(body),target='/api/pairing/redeem',timestamp=String(Date.now()),nonce=randomBytes(16).toString('base64url');
    const proof={method:'POST',target,body:raw,timestamp,nonce,signature:sign('sha256',proofMessage({method:'POST',target,body:raw,token:code,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};return {...await f.pairing.redeem(body,proof),keys};
  };
  const signed=(d,target,method='GET',body,token)=>{
    const raw=body===undefined?'':JSON.stringify(body),timestamp=String(Date.now()),nonce=randomBytes(16).toString('base64url');
    return {method,headers:{Origin:mentorBase,Authorization:'Bearer '+d.credential,'Content-Type':'application/json',...(token?{'X-MSA-Session':'Bearer '+token}:{}),'X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body:raw,token:d.credential,timestamp,nonce}),{key:d.keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')},...(body===undefined?{}:{body:raw})};
  };
  const call=(d,target='/api/device/status',method='GET',body,token)=>fetch(apiBase+target,signed(d,target,method,body,token));
  const associate=(d,token,requestId=randomUUID())=>call(d,'/api/a2-3/associate','POST',{requestId},token);
  const target=(scope=primary,path='/api/attendance')=>path+'?'+new URLSearchParams(scope);
  return {...f,source,apiBase,mentorBase,server,shell,account,personalRequest,login,issue,activate,signed,call,associate,target};
}
