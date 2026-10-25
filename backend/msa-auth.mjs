import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createMsaAccounts,normalizeUsername,hash,fail} from './msa-accounts.mjs';
import {createLegacyUsernamePilot} from './msa-legacy-usernames.mjs';
import {createMsaRegistration} from './msa-registration.mjs';
import {createMsaMentorAuthentication} from './msa-mentor-devices.mjs';
import {createMsaRecovery} from './msa-recovery.mjs';

export function createMsaAuthentication({db,root,auth,config,assertLocal,emailActor,pilotEnabled=false,registrationEnabled=false,repository,mentorAccounts,now=Date.now}){
  const sessions=new Map(),accounts=createMsaAccounts({db,root,auth,assertLocal,now});
  const prune=()=>{for(const [k,s] of sessions)if(s.expiresAt<=now())sessions.delete(k);};
  const checkToken=async token=>{
    assertLocal();const principal=await auth.verifyIdToken(token,true);assertLocal();
    if(!principal.uid||principal.firebase?.tenant||!Number.isSafeInteger(principal.exp)||principal.exp*1000<=now()||principal.iat*1000>now()||principal.auth_time*1000>now())throw Error();
    return principal;
  };
  const consumeAttempt=async canonical=>{
    assertLocal();
    const throttled=await db.runTransaction(async tx=>{
      const refs=['global',hash(canonical)].map(k=>root.collection('msaLoginLimits').doc(k));
      const rows=await tx.getAll(...refs),window=Math.floor(now()/60000);
      const counts=rows.map(r=>r.data()?.window===window?r.data().count:0);
      if(counts[0]>=60||counts[1]>=8)return true;
      refs.forEach((r,i)=>tx.set(r,{window,count:counts[i]+1}));return false;
    });
    if(throttled)fail(429,'Login belum dapat diproses. Coba lagi nanti.');
  };
  const verifyPassword=async(email,password)=>{
    assertLocal();if(typeof password!=='string'||!password||password.length>128)throw Error();
    const response=await fetch('http://'+config.host+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(5000)
    });
    if(!response.ok)throw Error();
    const {idToken}=await response.json(),principal=await checkToken(idToken);return {...principal,idToken};
  };
  const assertPilot=()=>{assertLocal();if(!pilotEnabled||process.env.ABC_MSA_USERNAME_PILOT!=='1'||!root.id.startsWith('test-'))fail(503,'Pilot username hanya tersedia pada namespace tes terisolasi.');};
  const legacyPilot=pilotEnabled?createLegacyUsernamePilot({db,root,auth,assertPilot,emailActor,verifyPassword,consumeAttempt,now}):undefined;
  const registration=registrationEnabled?createMsaRegistration({db,root,auth,repository,verifyPassword,now,assertEnabled:()=>{assertLocal();if(process.env.ABC_MSA_A2_2!=='1'||!root.id.startsWith('test-'))fail(503,'Pendaftaran uji tidak aktif.');}}):undefined;
  const api={
    accounts,legacyPilot,registration,
    async login({username,password}){
      assertLocal();prune();
      let canonical;try{canonical=normalizeUsername(username).canonical;}catch{canonical='!invalid';}
      // Shared namespace limit persists across server restarts. No forwarded IP.
      await consumeAttempt(canonical);
      const start=now();
      try{
        if(typeof password!=='string'||!password||password.length>128)throw Error();
        const claim=(await root.collection('msaUsernames').doc(canonical).get()).data();
        const bound=claim?.kind==='legacy-admin'?await legacyPilot?.resolve(canonical):null;
        if(claim?.kind==='legacy-admin'&&!bound)throw Error();
        const row=bound?null:claim?.state==='ready'?(await root.collection('msaAccounts').doc(claim.uid).get()).data():null;
        const email=bound?(await auth.getUser(bound.uid)).email:row?.providerAlias??'missing@msa.example.invalid';
        const principal=await verifyPassword(email,password),uid=bound?.uid??row?.uid;
        if(!uid||principal.uid!==uid||!bound&&row.canonical!==canonical)throw Error();
        if(!bound)await accounts.profile(uid,row.revision);
        if(sessions.size>=1000)throw Error();
        const token=randomBytes(32).toString('base64url');
        sessions.set(hash(token),{uid,revision:bound?.policy.revision??row.revision,idToken:principal.idToken,expiresAt:Math.min(now()+1800000,principal.exp*1000),...(bound?{source:'legacy-admin',canonical,linkRevision:bound.linkRevision}:{})});
        return {token,uid};
      }catch{fail(401,'Username atau kata sandi tidak valid, atau akun belum dapat digunakan.');}
      finally{await delay(Math.max(0,150-(now()-start)));}
    },
    async authorize(header){
      try{
        assertLocal();prune();
        const match=typeof header==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header),s=match&&sessions.get(hash(match[1]));
        if(!s)throw Error();
        const principal=await checkToken(s.idToken);if(principal.uid!==s.uid)throw Error();
        if(s.source==='legacy-admin'){
          const bound=await legacyPilot.resolve(s.canonical);
          if(bound.uid!==s.uid||bound.policy.revision!==s.revision||bound.linkRevision!==s.linkRevision)throw Error();
          return {kind:'legacy-username',uid:s.uid,revision:s.revision,policy:bound.policy,username:bound.username};
        }
        const profile=await accounts.profile(s.uid,s.revision);
        return {kind:'msa',uid:s.uid,revision:s.revision,profile,expiresAt:s.expiresAt};
      }catch{fail(401,'Sesi akun tidak berlaku. Masuk kembali.');}
    },
    logout(header){const token=typeof header==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header)?.[1];return !!token&&sessions.delete(hash(token));},
    close(){sessions.clear();}
  };
  if(mentorAccounts&&process.env.ABC_MSA_A2_3==='1'&&process.env.ABC_MSA_A2_2==='1'&&root.id.startsWith('test-'))api.mentor=createMsaMentorAuthentication({a1:api,devices:mentorAccounts});
  if(api.mentor&&registration&&process.env.ABC_MSA_A2_4A==='1')api.deviceLifecycle={
    enabled:mentorAccounts.lifecycle.enabled,
    list:(actor,uid)=>mentorAccounts.lifecycle.list(uid,(tx,b)=>registration.authorizeDeviceManagement(tx,actor,uid,'pairing:read',b)),
    revoke:(actor,uid,deviceId,value)=>mentorAccounts.lifecycle.revoke(uid,deviceId,value,actor.uid,(tx,b)=>registration.authorizeDeviceManagement(tx,actor,uid,'pairing:revoke',b))
  };
  if(api.deviceLifecycle&&process.env.ABC_MSA_A2_4B==='1')api.recovery=createMsaRecovery({db,root,auth,registration,now,assertEnabled:()=>{assertLocal();mentorAccounts.lifecycle.enabled();registration.enabled();}});
  return api;
}
