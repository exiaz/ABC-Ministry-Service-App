import {randomUUID,randomBytes} from 'node:crypto';
import {msaFixture} from './msa-a1-fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
export {scope};
export const proof={method:'in-person',reference:'Pemeriksaan langsung fiktif oleh penanggung jawab',confirmed:true};
export async function registrationFixture(t){
  const previous=process.env.ABC_MSA_A2_2;process.env.ABC_MSA_A2_2='1';
  const f=await msaFixture(t,{source:fictionalRosterData(),usernamePilot:true});
  t.after(()=>{if(previous===undefined)delete process.env.ABC_MSA_A2_2;else process.env.ABC_MSA_A2_2=previous;});
  const value=()=>({requestId:randomUUID(),fullName:'Relawan Fiktif',phone:'081234567890',username:'reg-'+randomUUID().slice(0,8),password:randomBytes(24).toString('base64url')});
  const register=async(v=value())=>{
    const response=await f.request('/api/a2-2/register',v,''),body=await response.json(),claim=(await f.root.collection('msaUsernames').doc(v.username.trim().toLowerCase()).get()).data();
    if(claim&&!f.created.includes(claim.uid))f.created.push(claim.uid);return {...v,uid:claim?.uid,response,body};
  };
  const call=(uid,op,v,session=f.token)=>f.request('/api/a2-2/accounts/'+uid+(op?'/'+op:''),v,session);
  const review=(u,patch={},session=f.token)=>call(u.uid,'review',{expectedRevision:1,requestId:randomUUID(),reason:'Tinjauan identitas fiktif untuk pengujian',decision:'approve',scope,evidence:proof,...patch},session);
  const link=(u,patch={},session=f.token)=>call(u.uid,'link',{expectedRevision:2,requestId:randomUUID(),reason:'Penautan identitas Mentor fiktif telah diperiksa',mentorId:'fictional-mentor',scope,evidence:proof,...patch},session);
  const actor={kind:'legacy',uid:f.uid,revision:1,check:async()=>true};
  const verifyPassword=async(email,password)=>{
    const r=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
    if(!r.ok)throw Error('Verifikasi fiktif ditolak.');return {uid:(await r.json()).localId};
  };
  return {...f,value,register,call,review,link,actor,verifyPassword};
}
