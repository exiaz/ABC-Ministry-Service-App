import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {registrationInput} from '../backend/msa-registration.mjs';

const input=()=>({requestId:randomUUID(),fullName:'Relawan Fiktif',phone:'081234567890',username:'relawan.fiktif',password:'Fiktif-hanya-untuk-tes-2026'});
test('A2.2 server validation: NFC names, Indonesian phone and supplied verification boundary',()=>{
  for(const phone of ['081234567890','6281234567890','+6281234567890','(0812) 3456-7890']){const r=registrationInput({...input(),fullName:' Jose\u0301  Fiktif ',phone});assert.equal(r.fullName,'José Fiktif');assert.equal(r.phone.normalized,'+6281234567890');assert.equal(r.phone.state,'supplied');assert.equal(r.phone.verifiedAt,null);}
});
test('A2.2 rejects Unicode controls/confusables, invalid fields and client privilege claims',()=>{
  for(const patch of [{fullName:'A'},{fullName:'  '},{fullName:'A'.repeat(121)},{fullName:'Fiktif\u202E Nama'},{fullName:'Nama\nFiktif'},{fullName:'<img src=x>'},{fullName:'\ud800'},{username:'\u212Aak.Fiktif'},{username:'ｋak'},{username:'kаk'},{username:'SUPERADMIN'},{phone:''},{phone:null},{phone:'+62081234567890'},{phone:'+18887776666'},{phone:'0812x'},{password:'short'},{password:'a'.repeat(129)},{password:'valid-password-\u200b'},{requestId:'guessable'},{role:'superadmin'},{state:'active'},{identity:{state:'verified'}},{email:'hidden@example.invalid'},{mentorId:'fictional-mentor'}])assert.throws(()=>registrationInput({...input(),...patch}),e=>e.status===400);
});
