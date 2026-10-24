import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {msaFixture} from './msa-a1-fixture.mjs';
import {deviceManagementSource,hagai} from './device-management-source.mjs';

export async function pilotFixture(t){
  const {source,grants}=deviceManagementSource(),f=await msaFixture(t,{usernamePilot:true,source});
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});
  const email='pic-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url');
  const created=await f.request('/api/admin/accounts',{email,password,actions:['pairing:read'],grants:[hagai]});assert.equal(created.status,201);const {uid}=await created.json();f.created.push(uid);
  const token=await f.adminAuthentication.signIn({email,password});
  const binding=(uid,header,password,username)=>({expectedUid:uid,header:'Bearer '+header,password,username,reason:'Pengikatan akun fiktif terisolasi',confirmed:true});
  return {...f,pic:{uid,email,password,token},binding,pilot:f.adminAuthentication.a1.legacyPilot};
}
