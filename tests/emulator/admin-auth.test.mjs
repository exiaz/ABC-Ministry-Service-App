import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {randomUUID,randomBytes} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {createTestCredentialStore} from '../../backend/access-control.mjs';
import {createRosterRepository} from '../../backend/roster.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';

async function fixture(t){
  const previous=process.env.ABC_ADMIN_UIDS,uid='fictional-'+randomUUID();
  process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  const app=initializeApp({projectId:'demo-abc-attendance'},'test-admin-'+randomUUID()),auth=getAuth(app);
  const password=randomBytes(32).toString('base64url'),email=uid+'@example.invalid';
  const otherUid='fictional-'+randomUUID(),otherEmail=otherUid+'@example.invalid';
  await auth.createUser({uid,email,password});await auth.createUser({uid:otherUid,email:otherEmail,password});
  const adminAuthentication=await createLocalAdminAuthentication();
  const credentials=createTestCredentialStore(),mentorToken=credentials.issue({grants:[scope]});
  const data=fictionalRosterData(),before=structuredClone(data);
  const server=createRosterServer({adminAuthentication,credentials,repository:createRosterRepository(data)});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    await adminAuthentication.close();await auth.deleteUsers([uid,otherUid]);await deleteApp(app);
    if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;
    assert.deepEqual(data,before);
  });
  const base='http://127.0.0.1:'+server.address().port;
  const request=(token,route='/api/admin/session',options={})=>fetch(base+route,{...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...options.headers}});
  return {uid,email,password,otherUid,otherEmail,auth,adminAuthentication,mentorToken,base,request};
}
async function directSignIn(email,password){
  const response=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),redirect:'error'
  });
  assert.equal(response.status,200);return (await response.json()).idToken;
}
function alter(token,changes,headerChanges={}){
  const [header,payload]=token.split('.');
  return Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(header,'base64url')), ...headerChanges})).toString('base64url')+'.'+Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url')),...changes})).toString('base64url')+'.';
}

test('Local admin authentication and authorization against real Auth Emulator',async t=>{
  const original=net.Socket.prototype.connect,attempts=[];
  net.Socket.prototype.connect=function(...args){
    const values=Array.isArray(args[0])?args[0]:args,first=values[0];
    const host=first&&typeof first==='object'?first.host:typeof values[1]==='string'?values[1]:undefined;
    if(host&&!['127.0.0.1','::1','localhost'].includes(host)){attempts.push(host);throw Error('Koneksi non-loopback dilarang oleh tes.');}
    return original.apply(this,args);
  };
  t.after(()=>{net.Socket.prototype.connect=original;assert.deepEqual(attempts,[]);});

  await t.test('Allowlisted UID and server-admitted ID token can access only read-only session; mentor scope is preserved',async t=>{
    const f=await fixture(t);
    assert.equal((await f.request(await directSignIn(f.email,f.password))).status,401);
    const token=await f.adminAuthentication.signIn(f);
    const response=await f.request(token);assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{uid:f.uid,mode:'emulator-lokal'});
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    assert.equal((await f.request(token,'/api/admin/session',{method:'POST'})).status,405);
    assert.equal((await f.request(token,'/api/admin/devices',{method:'POST'})).status,404);
    assert.equal((await f.request(undefined,'/api/admin/devices',{method:'POST'})).status,401);
    assert.equal((await f.request(token,'/api/roster?'+new URLSearchParams(scope))).status,401);
    assert.equal((await f.request(f.mentorToken,'/api/roster?'+new URLSearchParams(scope))).status,200);
    assert.equal((await f.request(f.mentorToken)).status,401);
    for(const target of ['/backend/admin-auth.mjs','/firebase.json','/tests/emulator/admin-auth.test.mjs'])assert.equal((await f.request(token,target)).status,404);
  });
  await t.test('Authentication and custom admin claims never grant privileges to a UID outside the server allowlist',async t=>{
    const f=await fixture(t);await f.auth.setCustomUserClaims(f.otherUid,{admin:true,role:'admin'});
    const token=await directSignIn(f.otherEmail,f.password);
    assert.equal((await f.request(token)).status,403);
    await assert.rejects(f.adminAuthentication.signIn({email:f.otherEmail,password:f.password}),/Login admin emulator ditolak/);
    await assert.rejects(f.adminAuthentication.signIn({email:f.email,password:'fictional-wrong-password'}),/Login admin emulator ditolak/);
  });
  await t.test('Missing, malformed, expired, forged, wrong-project and browser-supplied identities fail closed',async t=>{
    const f=await fixture(t),token=await f.adminAuthentication.signIn(f),other=await directSignIn(f.otherEmail,f.password);
    for(const invalid of [undefined,'ABC2026','not-a-jwt',token+'forged',alter(token,{exp:1}),alter(token,{aud:'real-project'}),alter(token,{iss:'https://securetoken.google.com/real-project'}),alter(token,{admin:true}),alter(other,{sub:f.uid,user_id:f.uid}),alter(token,{iat:Math.floor(Date.now()/1000)+600}),alter(token,{}, {alg:'RS256'})]){
      assert.equal((await f.request(invalid)).status,401);
    }
    assert.equal((await f.request(undefined,'/api/admin/session?token='+encodeURIComponent(token),{headers:{Cookie:'adminUnlocked=true; token='+token,'X-Admin':'true','X-Role':'admin','X-Demo-Code':'ABC2026'}})).status,401);
    const duplicate=await new Promise((resolve,reject)=>{
      const req=http.get(f.base+'/api/admin/session',{headers:{Authorization:['Bearer '+token,'Bearer '+token]}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);
    });assert.equal(duplicate,401);
    assert.equal((await f.request(token,'/api/admin/session?role=admin')).status,400);
  });
  await t.test('Revoked, disabled and deleted emulator accounts lose admin access',async t=>{
    const f=await fixture(t),token=await f.adminAuthentication.signIn(f);
    await f.auth.updateUser(f.uid,{disabled:true});assert.equal((await f.request(token)).status,401);
    await f.auth.updateUser(f.uid,{disabled:false});assert.equal((await f.request(token)).status,200);
    // Firebase revocation timestamps have second precision.
    await new Promise(resolve=>setTimeout(resolve,1100));
    await f.auth.revokeRefreshTokens(f.uid);assert.equal((await f.request(token)).status,401);
    await f.auth.deleteUser(f.uid);assert.equal((await f.request(token)).status,401);
  });
  await t.test('Actual admitted token expires, local revoke and a fresh authentication instance invalidate admission',async t=>{
    const f=await fixture(t),token=await f.adminAuthentication.signIn(f),originalNow=Date.now;
    try{Date.now=()=>originalNow()+3700000;assert.equal((await f.request(token)).status,401);}finally{Date.now=originalNow;}
    const fresh=await createLocalAdminAuthentication();
    try{assert.equal((await fresh.authorize('Bearer '+token)).kind,'unauthenticated');}finally{await fresh.close();}
    assert.equal(f.adminAuthentication.revoke(token),false); // expired entry was pruned
    const next=await f.adminAuthentication.signIn(f);assert.equal(f.adminAuthentication.revoke(next),true);
    assert.equal((await f.request(next)).status,401);
  });
  await t.test('Configuration drift and missing emulator reject requests without cloud fallback',async t=>{
    const f=await fixture(t),token=await f.adminAuthentication.signIn(f),host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
    try{
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;assert.equal((await f.request(token)).status,401);
      await assert.rejects(createLocalAdminAuthentication());
      process.env.FIREBASE_AUTH_EMULATOR_HOST='identitytoolkit.googleapis.com:443';assert.equal((await f.request(token)).status,401);
      await assert.rejects(createLocalAdminAuthentication());
      const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;
      await new Promise(resolve=>socket.close(resolve));process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:'+port;
      await assert.rejects(createLocalAdminAuthentication(),/Auth Emulator lokal tidak tersedia/);
    }finally{process.env.FIREBASE_AUTH_EMULATOR_HOST=host;}
  });
});
