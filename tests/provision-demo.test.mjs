import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {provisioningConfig,hiddenInput,DEMO_ADMIN} from '../provision-demo.mjs';
const local={ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_FIREBASE_PROJECT_ID:'demo-abc-attendance',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIRESTORE_NAMESPACE:'local-demo-m2b5b'};
test('Provisioning validates both emulator configurations before SDK access and never requires a pre-existing allowlist',()=>{
  assert.equal(provisioningConfig(local).store.namespace,'local-demo-m2b5b');assert.equal(provisioningConfig(local).auth.projectId,'demo-abc-attendance');
  for(const changes of [{ABC_FIREBASE_PROJECT_ID:'real-project'},{FIRESTORE_EMULATOR_HOST:'example.com:8080'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'},{ABC_ADMIN_AUTH_MODE:undefined},{ABC_FIRESTORE_NAMESPACE:undefined},{NODE_ENV:'production'},{GOOGLE_APPLICATION_CREDENTIALS:'key.json'},{FIREBASE_TOKEN:'forbidden'},{GCLOUD_PROJECT:'other'}])assert.throws(()=>provisioningConfig({...local,...changes}));
  assert.equal(DEMO_ADMIN.email,'admin.demo@abc-attendance.test');assert.equal(DEMO_ADMIN.uid,'demo-admin-local');
});
test('Hidden terminal input never echoes characters, supports backspace and restores raw/pause state',async()=>{
  const input=new PassThrough(),output=new PassThrough();input.isTTY=true;output.isTTY=true;input.setRawMode=value=>{input.isRaw=value;};
  let printed='';output.on('data',chunk=>printed+=chunk.toString());
  const secret=randomBytes(16).toString('base64url'),pending=hiddenInput('Rahasia: ',{input,output});
  input.write(secret+'x\x7f\r');assert.equal(await pending,secret);assert.equal(printed,'Rahasia: \n');assert.equal(input.isRaw,false);assert.equal(input.isPaused(),true);
  const cancel=hiddenInput('Rahasia: ',{input,output});input.write('\x03');await assert.rejects(cancel,/dibatalkan/);assert.equal(input.isRaw,false);assert.equal(printed.includes(secret),false);input.destroy();output.destroy();
});
test('The CLI rejects password arguments and noninteractive input without printing supplied secrets',()=>{
  const secret=randomBytes(16).toString('base64url');
  for(const args of [[],['--password',secret]]){
    const result=spawnSync(process.execPath,['provision-demo.mjs',...args],{input:secret,encoding:'utf8',env:{...process.env,...local},windowsHide:true});
    assert.equal(result.status,1);assert.equal((result.stdout+result.stderr).includes(secret),false);assert.equal(result.stdout,'');assert.doesNotMatch(result.stderr,/at main|Error:/);
  }
  assert.throws(()=>hiddenInput('Password: ',{input:new PassThrough(),output:new PassThrough()}),/terminal/);
});
