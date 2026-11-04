import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecureMentor} from '../secure-mentor.js';
const primary={schoolId:'s1',groupId:'g13',serviceSessionId:'fictional-visit',schoolName:'Sekolah Fiktif',groupName:'Hagai',serviceDate:'2026-11-01',mentorId:'mentor-one',mentorName:'Mentor Satu'};
const backup={...primary,groupId:'g1',groupName:'Hosea',accessKind:'backup'};
const otherPrimary={...primary,groupId:'g99',serviceSessionId:'fictional-other-visit'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Home card selection tells whether its group is open, another group is selected, and whether the device can open it at all',async()=>{
  const client={state:{phase:'active',assignment:primary},async readContexts(){return {contexts:[primary,backup]};},async readRoster(s){return {...s,students:[]};},async readAttendance(s){return {...s,batchId:null,state:'not-started',revision:0,updatedAt:null,finalizedAt:null,records:[]};}};
  const panel=createSecureMentor({client,render:()=>{},icon:()=>'',steps:()=>'',art:()=>'',openModal:()=>{},closeModal:()=>{}});
  assert.equal(panel.selection(primary).canOpen,true,'contexts not loaded yet: the card stays a plain link');
  await panel.refresh();await tick();
  assert.deepEqual(panel.selection(primary),{other:false,canOpen:true,locked:false});
  panel.action('select-group','g1',primary.serviceSessionId);await tick();
  assert.equal(panel.selection(primary).other,true);
  assert.equal(panel.selection(primary).canOpen,true);
  assert.equal(panel.selection(otherPrimary).canOpen,false,'a group this device is not activated for cannot be opened from its card');
});
