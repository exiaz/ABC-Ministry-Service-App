import {once} from 'node:events';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {SCHOOL_CONFIG,GROUP_CONFIG} from '../../group-config.js';
import {INITIAL_DEFAULTS} from '../../mentor-config.js';
import {createRosterServer} from '../../backend/server.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';
export const hagai={schoolId:'s1',groupId:'g13',serviceSessionId:'demo-pakel-2026-10-09'};
export function deviceManagementSource(){
  const dates={s1:'2026-10-09',s2:'2026-10-16',s3:'2026-10-30'},sessionIds={s1:hagai.serviceSessionId,s2:'demo-airlangga-2026-10-16',s3:'demo-kertajaya-2026-10-30'};
  const source={schools:SCHOOL_CONFIG.map(({id,name})=>({id,name})),groups:GROUP_CONFIG.map(({id,name,schoolId})=>({id,name,schoolId})),mentors:[...new Map(INITIAL_DEFAULTS.map(m=>[m.mentorId,{id:m.mentorId,name:m.name}])).values()],defaultMentorAssignments:INITIAL_DEFAULTS.map(m=>({id:'fictional-default-'+m.groupId,groupId:m.groupId,mentorId:m.mentorId,effectiveFrom:'2026-01-01'})),serviceSessions:SCHOOL_CONFIG.map(s=>({id:sessionIds[s.id],schoolId:s.id,date:dates[s.id],groupIds:GROUP_CONFIG.filter(g=>g.schoolId===s.id).map(g=>g.id)})),sessions:[],students:[{id:'fictional-hagai',schoolId:'s1',groupId:'g13',name:'Siswa Hagai Fiktif',schoolClass:'4A',active:true}],studentPrivateProfiles:{'fictional-hagai':{guardianName:'PRIVAT_DILARANG',address:'PRIVAT_DILARANG'}}};
  const grants=GROUP_CONFIG.map(g=>({schoolId:g.schoolId,groupId:g.id,serviceSessionId:sessionIds[g.schoolId]}));return {source,grants};
}
export async function deviceManagementFixture(t,{mentorOrigin}={}){
  let time=Date.now();const {source,grants}=deviceManagementSource(),c=await emulatorFixture({source,now:()=>time});
  const f=await adminLoginFixture(t,{pairing:c.pairing});
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});
  const mentorApi=createRosterServer({...c,mentorOrigin});mentorApi.listen(0,'127.0.0.1');await once(mentorApi,'listening');
  t.after(()=>new Promise(resolve=>{mentorApi.close(resolve);mentorApi.closeAllConnections();}));
  t.after(()=>c.close());
  const mentorBase='http://127.0.0.1:'+mentorApi.address().port;
  const response=await f.login();if(response.status!==200)throw Error('Login fixture gagal.');const token=(await response.json()).token;
  const admin=(target,body,authorization='Bearer '+token)=>fetch(f.base+target,{method:body===undefined?'GET':'POST',headers:{Authorization:authorization,Origin:f.base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  const headers=(token,method,target,body='')=>{const timestamp=String(time),nonce=randomBytes(16).toString('base64url');return {'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body,token,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
  const redeem=code=>{const target='/api/pairing/redeem',body=JSON.stringify({code,publicKey});return fetch(mentorBase+target,{method:'POST',body,headers:headers(code,'POST',target,body)});};
  const mentor=(credential,scope=hagai)=>{const target='/api/roster?'+new URLSearchParams(scope);return fetch(mentorBase+target,{headers:{...headers(credential,'GET',target),Authorization:'Bearer '+credential}});};
  return {...f,...c,admin,mentorApi,mentorBase,redeem,mentor,grants,token,advance:ms=>{time+=ms;},now:()=>time};
}
