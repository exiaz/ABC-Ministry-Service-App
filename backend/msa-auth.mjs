import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createMsaAccounts,normalizeUsername,hash,fail} from './msa-accounts.mjs';

export function createMsaAuthentication({db,root,auth,config,assertLocal,now=Date.now}){
  const sessions=new Map(),accounts=createMsaAccounts({db,root,auth,assertLocal,now});
  const prune=()=>{for(const [k,s] of sessions)if(s.expiresAt<=now())sessions.delete(k);};
  const checkToken=async token=>{
    assertLocal();const principal=await auth.verifyIdToken(token,true);assertLocal();
    if(!principal.uid||principal.firebase?.tenant||!Number.isSafeInteger(principal.exp)||principal.exp*1000<=now()||principal.iat*1000>now()||principal.auth_time*1000>now())throw Error();
    return principal;
  };
  return {
    accounts,
    async login({username,password}){
      assertLocal();prune();
      let canonical;try{canonical=normalizeUsername(username).canonical;}catch{canonical='!invalid';}
      // Shared namespace limit persists across server restarts. No forwarded IP.
      const throttled=await db.runTransaction(async tx=>{
        const refs=['global',hash(canonical)].map(k=>root.collection('msaLoginLimits').doc(k));
        const rows=await tx.getAll(...refs),window=Math.floor(now()/60000);
        const counts=rows.map(r=>r.data()?.window===window?r.data().count:0);
        if(counts[0]>=60||counts[1]>=8)return true;
        refs.forEach((r,i)=>tx.set(r,{window,count:counts[i]+1}));return false;
      });
      if(throttled)fail(429,'Login belum dapat diproses. Coba lagi nanti.');
      const start=now();
      try{
        if(typeof password!=='string'||!password||password.length>128)throw Error();
        const claim=(await root.collection('msaUsernames').doc(canonical).get()).data();
        const row=claim?.state==='ready'?(await root.collection('msaAccounts').doc(claim.uid).get()).data():null;
        const email=row?.providerAlias??'missing@msa.example.invalid';
        const response=await fetch('http://'+config.host+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(5000)
        });
        if(!response.ok)throw Error();
        const {idToken}=await response.json(),principal=await checkToken(idToken);
        if(!row||principal.uid!==row.uid||row.canonical!==canonical)throw Error();
        await accounts.profile(row.uid,row.revision);
        if(sessions.size>=1000)throw Error();
        const token=randomBytes(32).toString('base64url');
        sessions.set(hash(token),{uid:row.uid,revision:row.revision,idToken,expiresAt:Math.min(now()+1800000,principal.exp*1000)});
        return {token};
      }catch{fail(401,'Username atau kata sandi tidak valid, atau akun belum dapat digunakan.');}
      finally{await delay(Math.max(0,150-(now()-start)));}
    },
    async authorize(header){
      try{
        assertLocal();prune();
        const match=typeof header==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header),s=match&&sessions.get(hash(match[1]));
        if(!s)throw Error();
        const principal=await checkToken(s.idToken);if(principal.uid!==s.uid)throw Error();
        const profile=await accounts.profile(s.uid,s.revision);
        return {kind:'msa',uid:s.uid,revision:s.revision,profile};
      }catch{fail(401,'Sesi akun tidak berlaku. Masuk kembali.');}
    },
    logout(header){const token=typeof header==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header)?.[1];if(token)sessions.delete(hash(token));},
    close(){sessions.clear();}
  };
}
