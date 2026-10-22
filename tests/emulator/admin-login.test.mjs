import test from 'node:test';
import assert from 'node:assert/strict';
import {adminLoginFixture} from './admin-login-fixture.mjs';
test('HTTP login admits only allowed emulator accounts; logout invalidates the exact admitted bearer',async t=>{
  const f=await adminLoginFixture(t);
  for(const values of [{email:f.email,password:'fictional-wrong'},{email:f.otherEmail,password:f.password},{email:'missing@example.invalid',password:f.password}]){
    const r=await f.login(values);assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'Email, kata sandi, atau izin admin tidak valid.'});
  }
  const login=await f.login();assert.equal(login.status,200);assert.equal(login.headers.get('cache-control'),'no-store');assert.equal(login.headers.get('set-cookie'),null);assert.equal(login.headers.get('access-control-allow-origin'),null);
  const {token,uid}=await login.json();assert.equal(uid,f.uid);
  const r=await f.request(token);assert.equal(r.status,200);assert.deepEqual(await r.json(),{uid:f.uid,mode:'emulator-lokal'});
  const logout=await f.request(token,'/api/admin/logout','POST');assert.equal(logout.status,200);assert.equal((await f.request(token)).status,401);
  // Signing in directly to Auth Emulator does not admit its token into this API.
  const raw=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email,password:f.password,returnSecureToken:true})});
  assert.equal(raw.status,200);const direct=(await raw.json()).idToken;
  assert.equal((await f.request(direct)).status,401);
});
test('Expired, disabled, revoked and locally revoked admin sessions reject further protected requests',async t=>{
  const f=await adminLoginFixture(t),login=await f.login();assert.equal(login.status,200);const {token}=await login.json(),now=Date.now;
  try{Date.now=()=>now()+3700000;assert.equal((await f.request(token)).status,401);}finally{Date.now=now;}
  const next=await f.login();assert.equal(next.status,200);const current=(await next.json()).token;
  await f.auth.updateUser(f.uid,{disabled:true});assert.equal((await f.request(current)).status,401);await f.auth.updateUser(f.uid,{disabled:false});
  // Firebase revocation timestamps have second precision, as in M2B.1.
  await new Promise(resolve=>setTimeout(resolve,1100));await f.auth.revokeRefreshTokens(f.uid);
  assert.equal((await f.request(current)).status,401);
});
test('Authorization lost during session verification denies the response and returns no admin data',async t=>{
  const f=await adminLoginFixture(t),r=await f.login();assert.equal(r.status,200);const {token}=await r.json(),authorize=f.adminAuthentication.authorize;
  let calls=0;f.adminAuthentication.authorize=async header=>{const result=await authorize(header);if(++calls===1)f.adminAuthentication.revoke(token);return result;};
  const response=await f.request(token);assert.equal(response.status,401);assert.equal((await response.json()).uid,undefined);
});
