import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createLocalMsaSetup,wrapLocalMsaSetup,nativePasswordDialog} from '../local-msa-setup.mjs';
import {listen,waitFor} from '../local-demo.mjs';
import http from 'node:http';
import {fixtureNativeDialog} from './fixtures/msa-native-dialog.mjs';

test('Local setup accepts only native input, fixed fixture UID/role, CSRF and current-password reauthentication',async()=>{
  let time=100000,role='superadmin',resolvedUid='owner-test',updates=0,prompts=0,provide;
  const password=randomBytes(24).toString('hex'),current=randomBytes(24).toString('hex');
  const context={config:{namespace:'test-auth-pilot-fixture'}},accounts=new Map([['momor1n',{uid:'owner-test',email:'owner@example.invalid',role:'superadmin'}],['pic.pilot',{uid:'pic-test',email:'pic@example.invalid',role:'pic'}]]);
  const setup=createLocalMsaSetup({context,accounts,check:()=>{},now:()=>time,prompt:async()=>{prompts++;return new Promise(resolve=>provide=resolve);},
    auth:{getUser:async uid=>({email:accounts.get(uid==='owner-test'?'momor1n':'pic.pilot').email}),updateUser:async uid=>{assert.ok(['owner-test','pic-test'].includes(uid));updates++;},revokeRefreshTokens:async()=>{}},
    authentication:{revoke:()=>{},a1:{legacyPilot:{resolve:async username=>({uid:username==='pic.pilot'?'pic-test':resolvedUid,policy:{role:username==='pic.pilot'?'pic':role}})},login:async value=>{if(value.password!==current)throw Object.assign(Error('Denied'),{status:401});return {uid:'owner-test',token:'opaque-test-only'};}}}});
  const server=await listen(wrapLocalMsaSetup(http.createServer((q,s)=>{s.writeHead(404);s.end();}),setup),0),origin='http://127.0.0.1:'+server.address().port;
  const headers={Origin:origin,'Content-Type':'application/json','X-MSA-Local-Setup':'1'};
  const request=async(value,extra={})=>{const r=await fetch(origin+'/api/local-account-setup',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(value)});await r.text();return r.status;};
  const status=async username=>(await fetch(origin+'/api/local-account-setup?username='+username,{headers})).json();
  const settle=async value=>{provide({...value});await waitFor(async()=>(await status('momor1n')).state!=='pending');};
  try{
    assert.equal(await request({username:'momor1n'},{Origin:'https://example.invalid'}),403);
    assert.equal(await request({username:'momor1n',password}),400);assert.equal(prompts,0);assert.equal(updates,0);
    assert.equal(await request({username:'momor1n',uid:'other'}),400);
    assert.equal(await request({username:'momor1n'}),202);assert.equal(updates,0);
    assert.equal(await request({username:'pic.pilot'}),409);
    resolvedUid='other';await settle({password});assert.equal(updates,0);resolvedUid='owner-test';
    assert.equal(await request({username:'momor1n'}),202);role='pic';await settle({password});assert.equal(updates,0);role='superadmin';time+=60000;
    assert.equal(await request({username:'momor1n'}),202);await settle({password});assert.equal(updates,1);
    assert.equal(await request({username:'momor1n'}),202);await settle({password});assert.equal(updates,1); // Current password required.
    assert.equal(await request({username:'momor1n'}),202);await settle({password:current,currentPassword:current});assert.equal(updates,2);
    assert.equal(await request({username:'pic.pilot'}),202);provide({password:current});await waitFor(async()=>(await status('pic.pilot')).state!=='pending');assert.equal(updates,2); // Must be separate.
  }finally{await setup.close();await new Promise(resolve=>server.close(resolve));}
});

test('Actual Windows native password dialog stays open for local input and abort closes only its owned process',{skip:process.platform!=='win32',timeout:20000},async()=>{
  const abort=new AbortController(),start=Date.now();let settled=false;
  const result=nativePasswordDialog({username:'momor1n',established:false,signal:abort.signal}).then(()=>{settled=true;return false;},()=>{settled=true;return true;});
  try{await new Promise(resolve=>setTimeout(resolve,3000));assert.equal(settled,false);}
  finally{abort.abort();assert.equal(await result,true);assert.ok(Date.now()-start>=2900);}
});

test('Native WPF Save handles distinct Unicode passwords and current-password input without logging secrets',{skip:process.platform!=='win32',timeout:20000},async()=>{
  const password='Uji-密碼-é-'+randomBytes(20).toString('hex'),currentPassword=randomBytes(24).toString('hex');
  const value=await fixtureNativeDialog({username:'momor1n',established:true,password,currentPassword});
  assert.ok(value.password===password);assert.ok(value.currentPassword===currentPassword);value.password='';value.currentPassword='';
});
