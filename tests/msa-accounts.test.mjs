import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsername,normalizePhone} from '../backend/msa-accounts.mjs';

test('A1 username ASCII boundaries, case normalization and reserved names',()=>{
  assert.deepEqual(normalizeUsername(' Kak.Louis '),{display:'Kak.Louis',canonical:'kak.louis'});
  for(const name of ['ab','a'.repeat(33),'_abc','ｋak','kаk','a b','ADMIN','root','api','abc',null])assert.throws(()=>normalizeUsername(name));
  for(const name of ['abc1','a'.repeat(32),'kak_louis-1.2'])assert.ok(normalizeUsername(name));
});
test('A1 phone normalization never marks supplied contact verified',()=>{
  for(const number of ['081234567890','6281234567890','+6281234567890','(0812) 3456-7890']){
    const phone=normalizePhone(number);assert.equal(phone.normalized,'+6281234567890');assert.equal(phone.state,'supplied');assert.equal(phone.verifiedAt,null);
  }
  for(const number of ['81234567890','+62081234567890','+19876543210','0812abc','081234567890 ext1','+62812','+628'+'1'.repeat(13)])assert.throws(()=>normalizePhone(number));
  assert.equal(normalizePhone(''),null);
});

test('A1 rejects non-ASCII characters before Unicode lowercase can turn Kelvin sign into ASCII k',()=>{
  assert.throws(()=>normalizeUsername('\u212Aak.Fiktif'),e=>e.status===400);
  assert.throws(()=>normalizeUsername('ka\u212A.fiktif'),e=>e.status===400);
  assert.deepEqual(normalizeUsername(' KAK.Fiktif '),{display:'KAK.Fiktif',canonical:'kak.fiktif'});
});
