import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {DEMO_PROJECT_ID} from './emulator-config.mjs';
import {emulatorConfig} from './emulator-config.mjs';
import {adminPolicy,createAdminAccounts} from './admin-accounts.mjs';
import {createMsaAuthentication} from './msa-auth.mjs';

const digest=token=>createHash('sha256').update(token).digest('hex');
const validUid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);

export function adminAuthConfig(env=process.env){
  if(env.ABC_ADMIN_AUTH_MODE!=='firebase-auth-emulator'||env.ABC_FIREBASE_PROJECT_ID!==DEMO_PROJECT_ID)throw Error('Autentikasi admin memerlukan mode emulator dan project demo eksplisit.');
  const host=env.FIREBASE_AUTH_EMULATOR_HOST;
  const match=/^127\.0\.0\.1:([1-9]\d{0,4})$/.exec(host??'');
  if(!match||Number(match[1])>65535)throw Error('Auth Emulator wajib memakai host dan port loopback yang valid.');
  if(env.GOOGLE_APPLICATION_CREDENTIALS||env.FIREBASE_TOKEN||env.NODE_ENV==='production')throw Error('Autentikasi emulator tidak boleh memakai konfigurasi produksi.');
  for(const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT']){
    if(env[key]&&env[key]!==DEMO_PROJECT_ID)throw Error('Konfigurasi project admin bertentangan.');
  }
  let uids;
  try{uids=JSON.parse(env.ABC_ADMIN_UIDS);}catch{throw Error('Allowlist UID admin server wajib berupa array JSON.');}
  if(!Array.isArray(uids)||!uids.every(validUid)||new Set(uids).size!==uids.length)throw Error('Allowlist UID admin server tidak valid.');
  return Object.freeze({projectId:DEMO_PROJECT_ID,host,uids:Object.freeze([...uids])});
}

export async function createConfiguredAdminAuthentication(){
  if(process.env.ABC_ADMIN_AUTH_MODE===undefined&&process.env.FIREBASE_AUTH_EMULATOR_HOST===undefined)return undefined;
  return createLocalAdminAuthentication();
}

// Emulator tokens are unsigned. Only login handles issued by this trusted
// server after emulator password sign-in are admitted (hashes only). Each
// handle carries the verified ID token and a random per-login suffix.
// This core helper exposes no HTTP route. The opt-in M2B.5A same-origin login
// calls this exact signIn path. UID claims alone cannot establish provenance,
// even after Admin SDK verification in emulator mode.
export async function createLocalAdminAuthentication(){
  const config=adminAuthConfig(),admitted=new Map();
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const app=initializeApp({projectId:config.projectId},'abc-admin-local-'+randomUUID());
  const auth=getAuth(app);
  const store=emulatorConfig(),{getFirestore}=await import('firebase-admin/firestore');
  const db=getFirestore(app);db.settings({host:store.host,ssl:false,universeDomain:'googleapis.com'});
  const root=db.collection('emulatorNamespaces').doc(store.namespace);
  let closed=false;
  const assertLocal=()=>{
    try{if(closed||JSON.stringify(adminAuthConfig())!==JSON.stringify(config)||JSON.stringify(emulatorConfig())!==JSON.stringify(store))throw Error();}
    catch{throw Object.assign(Error('Konfigurasi autentikasi admin berubah; akses ditolak.'),{status:503});}
  };
  const verify=async token=>{
    assertLocal();
    const principal=await auth.verifyIdToken(token,true);
    assertLocal();
    const now=Math.floor(Date.now()/1000);
    if(!validUid(principal.uid)||!Number.isSafeInteger(principal.exp)||!Number.isSafeInteger(principal.iat)||!Number.isSafeInteger(principal.auth_time)||principal.exp<=now||principal.iat>now||principal.auth_time>now||principal.exp<=principal.iat||principal.firebase?.tenant)throw Error('Token admin tidak berlaku.');
    return principal;
  };
  const prune=()=>{for(const [key,value] of admitted)if(value.exp<=Date.now()/1000)admitted.delete(key);};
  try{
    // Forces a real local Auth connection. No default credentials, cloud lookup,
    // fallback identity, automatic account creation or public token endpoint.
    await auth.listUsers(1);
    assertLocal();
  }catch{closed=true;await db.terminate();await deleteApp(app);throw Error('Auth Emulator lokal tidak tersedia atau konfigurasi tidak valid.');}
  const authorizeEmail=async header=>{
    try{
      assertLocal();prune();
      const match=typeof header==='string'&&header.length<=16384&&/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.(?:~[A-Za-z0-9_-]{43})?)$/.exec(header);
      if(!match)return {kind:'unauthenticated'};
      const principal=await verify(match[1].split('~')[0]);
      const policy=await adminPolicy(root,principal.uid);
      const entry=admitted.get(digest(match[1]));
      if(!entry||entry.uid!==principal.uid||entry.exp!==principal.exp||entry.revision!==policy.revision)return {kind:'unauthenticated'};
      return {kind:'ok',...policy};
    }catch(error){return {kind:error.legacyDenied?'forbidden':'unauthenticated'};}
  };
  const a1=process.env.ABC_MSA_A1==='1'?createMsaAuthentication({db,root,auth,config,emailActor:authorizeEmail,pilotEnabled:process.env.ABC_MSA_USERNAME_PILOT==='1'&&store.namespace.startsWith('test-'),assertLocal:()=>{assertLocal();if(process.env.ABC_MSA_A1!=='1')throw Error('A1 tidak aktif.');}}):undefined;
  return {
    a1,
    accounts:createAdminAccounts({db,root,auth}),
    async signIn({email,password}){
      try{
        assertLocal();
        if(typeof email!=='string'||typeof password!=='string'||!email||!password)throw Error();
        const response=await fetch('http://'+config.host+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(5000)
        });
        if(!response.ok){const error=Error();if(response.status>=500||response.status===429)error.status=503;throw error;}
        const {idToken}=await response.json(),principal=await verify(idToken);
        let policy;
        try{policy=await adminPolicy(root,principal.uid);}catch(error){if(error.adminAccountError)throw error;throw Object.assign(Error('Izin server belum tersedia.'),{status:503});}
        // Auth Emulator can return the same ID token for two password logins
        // in one second. Bind each admitted login to its own random handle.
        const session=idToken+'~'+randomBytes(32).toString('base64url');
        prune();admitted.set(digest(session),{uid:principal.uid,exp:principal.exp,revision:policy.revision});
        return session;
      }catch(error){
        const failure=Error('Login admin emulator ditolak.');
        if(error.status===503||error instanceof TypeError||['TimeoutError','AbortError'].includes(error.name)||['app/network-error','auth/internal-error'].includes(error.code))failure.status=503;
        throw failure;
      }
    },
    async authorize(header){
      if(a1&&typeof header==='string'&&/^Bearer [A-Za-z0-9_-]{43}$/.test(header)){
        try{const p=await a1.authorize(header);return p.kind==='legacy-username'?{kind:'ok',...p.policy}:{kind:'unauthenticated'};}catch{return {kind:'unauthenticated'};}
      }
      return authorizeEmail(header);
    },
    revoke(token){return typeof token==='string'&&(admitted.delete(digest(token))||a1?.logout('Bearer '+token)||false);},
    async close(){closed=true;admitted.clear();a1?.close();await db.terminate();await deleteApp(app);}
  };
}
