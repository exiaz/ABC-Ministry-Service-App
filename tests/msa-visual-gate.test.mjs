import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualPilotGate} from '../backend/msa-visual-gate.mjs';

const fixture=()=>({ABC_MSA_VISUAL_V1A:'1',ABC_MSA_A1:'1',ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIREBASE_PROJECT_ID:'demo-abc-attendance',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8280',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9299',ABC_FIRESTORE_NAMESPACE:'test-visual-fictional',ABC_ADMIN_UIDS:'["fictional-owner"]'});
const denied=fn=>assert.throws(fn,e=>e.status===404);

test('Visual pilot gate defaults closed and requires both fictional emulators',()=>{
  const good=fixture();assert.equal(createVisualPilotGate(good).enabled(),true);
  for(const [key,value] of [['ABC_MSA_VISUAL_V1A',undefined],['ABC_MSA_A1','0'],['ABC_FIRESTORE_NAMESPACE','production'],['NODE_ENV','production'],['FIRESTORE_EMULATOR_HOST','localhost:8280'],['FIREBASE_AUTH_EMULATOR_HOST','example.com:9299'],['ABC_FIREBASE_PROJECT_ID','real-project'],['GOOGLE_APPLICATION_CREDENTIALS','key.json']]){
    const env=fixture();if(value===undefined)delete env[key];else env[key]=value;denied(()=>createVisualPilotGate(env));
  }
});
test('Visual pilot gate rejects configuration drift after startup',()=>{
  const env=fixture(),gate=createVisualPilotGate(env);env.ABC_FIRESTORE_NAMESPACE='test-other';denied(()=>gate.enabled());
  env.ABC_FIRESTORE_NAMESPACE='test-visual-fictional';env.ABC_MSA_VISUAL_V1A='0';denied(()=>gate.enabled());
});
