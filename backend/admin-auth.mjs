import {createHash,randomUUID} from 'node:crypto';
import {DEMO_PROJECT_ID} from './emulator-config.mjs';

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

// Emulator tokens are unsigned. Only exact tokens obtained by this trusted
// server process through emulator password sign-in are admitted (hashes only).
// Neither login nor admission is exposed over HTTP. UID claims alone cannot
// establish provenance, even after Admin SDK verification in emulator mode.
export async function createLocalAdminAuthentication(){
  const config=adminAuthConfig(),allowed=new Set(config.uids),admitted=new Map();
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const app=initializeApp({projectId:config.projectId},'abc-admin-local-'+randomUUID());
  const auth=getAuth(app);
  let closed=false;
  const assertLocal=()=>{
    if(closed||JSON.stringify(adminAuthConfig())!==JSON.stringify(config))throw Error('Konfigurasi autentikasi admin berubah; akses ditolak.');
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
  }catch{closed=true;await deleteApp(app);throw Error('Auth Emulator lokal tidak tersedia atau konfigurasi tidak valid.');}
  return {
    async signIn({email,password}){
      try{
        assertLocal();
        if(typeof email!=='string'||typeof password!=='string'||!email||!password)throw Error();
        const response=await fetch('http://'+config.host+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(5000)
        });
        if(!response.ok)throw Error();
        const {idToken}=await response.json(),principal=await verify(idToken);
        if(!allowed.has(principal.uid))throw Error();
        prune();admitted.set(digest(idToken),{uid:principal.uid,exp:principal.exp});
        return idToken;
      }catch{throw Error('Login admin emulator ditolak.');}
    },
    async authorize(header){
      try{
        assertLocal();prune();
        const match=typeof header==='string'&&header.length<=16384&&/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)$/.exec(header);
        if(!match)return {kind:'unauthenticated'};
        const principal=await verify(match[1]);
        if(!allowed.has(principal.uid))return {kind:'forbidden'};
        const entry=admitted.get(digest(match[1]));
        if(!entry||entry.uid!==principal.uid||entry.exp!==principal.exp)return {kind:'unauthenticated'};
        return {kind:'ok',uid:principal.uid};
      }catch{return {kind:'unauthenticated'};}
    },
    revoke(token){return typeof token==='string'&&admitted.delete(digest(token));},
    async close(){closed=true;admitted.clear();await deleteApp(app);}
  };
}
