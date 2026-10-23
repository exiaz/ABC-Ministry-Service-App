import {randomUUID} from 'node:crypto';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';
import {adminAuthConfig} from './admin-auth.mjs';

export const PIC_ACTIONS=['pairing:read','pairing:issue','pairing:revoke'];
const fail=(status,message)=>{throw Object.assign(Error(message),{status,adminAccountError:true});};
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const scopeKey=s=>JSON.stringify(SCOPE_KEYS.map(k=>s[k]));
const audit=(root,tx,event,actor,target,changes={})=>tx.create(root.collection('authorizationEvents').doc(randomUUID()),{event,actor,target,at:Date.now(),...changes});

// Marker enables strict roles for this namespace. Old isolated emulator fixtures
// retain their UID boundary until an explicit trusted migration is performed.
export async function adminPolicy(root,uid,{tx,action}={}){
  const get=ref=>tx?tx.get(ref):ref.get();
  const config=(await get(root.collection('adminSecurity').doc('owner'))).data();
  if(!config){if(!adminAuthConfig().uids.includes(uid))throw Object.assign(Error('Akses admin ditolak.'),{status:403,adminAccountError:true,legacyDenied:true});return {uid,role:'legacy-admin',revision:0};}
  const row=(await get(root.collection('adminAccounts').doc(uid))).data();
  if(!validId(config.uid)||!row||row.uid!==uid||row.state!=='active'||!Number.isSafeInteger(row.revision)||row.revision<1||!['superadmin','pic'].includes(row.role)||row.role==='superadmin'&&uid!==config.uid||row.role==='pic'&&(uid===config.uid||row.createdBy!==config.uid))fail(403,'Akun tidak aktif atau izin dicabut.');
  if(action&&row.role!=='superadmin'&&(!PIC_ACTIONS.includes(action)||!row.actions?.includes(action)))fail(403,'Tindakan ini tidak termasuk izin PIC.');
  return {uid,role:row.role,revision:row.revision,actions:row.role==='superadmin'?['accounts:manage',...PIC_ACTIONS]:row.actions};
}

export async function initializeOwner({db,root,auth,uid,email,confirmed=false}){
  if(!confirmed)fail(400,'Penetapan Superadmin memerlukan konfirmasi lokal.');
  if(!adminAuthConfig().uids.includes(uid))fail(403,'UID pemilik belum diizinkan oleh setup lokal.');
  const user=await auth.getUser(uid);
  if(user.uid!==uid||user.email!==email||user.disabled)fail(403,'Identitas pemilik tidak cocok atau nonaktif.');
  return db.runTransaction(async tx=>{
    const marker=root.collection('adminSecurity').doc('owner'),account=root.collection('adminAccounts').doc(uid);
    const [existing,row]=await tx.getAll(marker,account);
    if(existing.exists){if(existing.data().uid!==uid)fail(409,'Superadmin sudah ditetapkan untuk UID lain.');return false;}
    if(row.exists)fail(409,'Record akun sudah ada; migrasi otomatis dibatalkan.');
    tx.create(marker,{uid,createdAt:Date.now()});
    tx.create(account,{uid,email,role:'superadmin',state:'active',revision:1,createdBy:uid,createdAt:Date.now()});
    audit(root,tx,'superadmin-initialized',uid,uid);return true;
  });
}

export function createAdminAccounts({db,root,auth}){
  const owner=async(uid,tx,check)=>{
    const p=await adminPolicy(root,uid,{tx});
    if(p.role!=='superadmin')fail(403,'Hanya Superadmin yang dapat mengelola akun PIC.');
    if(!await check())fail(401,'Sesi Superadmin tidak berlaku.');return p;
  };
  const project=row=>({uid:row.uid,email:row.email,state:row.state,revision:row.revision,actions:row.actions??[],grants:row.grants??[],updatedAt:row.updatedAt??row.createdAt});
  const validate=async(tx,uid,value)=>{
    if(!value||!Array.isArray(value.actions)||!value.actions.length||value.actions.some(a=>!PIC_ACTIONS.includes(a))||new Set(value.actions).size!==value.actions.length||!Array.isArray(value.grants)||!value.grants.length||value.grants.length>16||value.grants.some(s=>!validRosterScope(s)||Object.keys(s).length!==3)||new Set(value.grants.map(scopeKey)).size!==value.grants.length)fail(400,'Pilih tindakan dan cakupan PIC yang valid.');
    const permission=(await tx.get(root.collection('adminPairingPermissions').doc(uid))).data();
    if(!permission?.active||value.grants.some(s=>!permission.grants.some(p=>scopeKey(s)===scopeKey(p))))fail(403,'Cakupan PIC melampaui izin Superadmin.');
    for(const s of value.grants){
      const [school,group,visit]=(await tx.getAll(root.collection('schools').doc(s.schoolId),root.collection('groups').doc(s.groupId),root.collection('serviceSessions').doc(s.serviceSessionId))).map(d=>d.data());
      if(school?.id!==s.schoolId||group?.id!==s.groupId||group.schoolId!==s.schoolId||visit?.id!==s.serviceSessionId||visit.schoolId!==s.schoolId||!visit.groupIds?.includes(s.groupId))fail(400,'Sekolah, kelompok atau sesi tidak sesuai.');
    }
    return {actions:[...value.actions],grants:value.grants.map(s=>Object.fromEntries(SCOPE_KEYS.map(k=>[k,s[k]])))};
  };
  return {
    async list(uid,check){
      return db.runTransaction(async tx=>{
        await owner(uid,tx,check);const rows=await tx.get(root.collection('adminAccounts').where('role','==','pic'));await owner(uid,tx,check);
        return {accounts:rows.docs.map(d=>project(d.data()))};
      });
    },
    async create(uid,value,check){
      if(!value||Object.keys(value).some(k=>!['email','password','actions','grants'].includes(k))||typeof value.email!=='string'||!/^[-a-zA-Z0-9_.+]+@(?:[a-zA-Z0-9-]+\.)*(?:test|example\.invalid)$/.test(value.email)||value.email.length>254||typeof value.password!=='string'||value.password.length<12||value.password.length>128)fail(400,'Gunakan email fiktif .test/example.invalid dan kata sandi 12–128 karakter.');
      const id='pic-'+randomUUID(),ref=root.collection('adminAccounts').doc(id);let created=false;
      try{
        await db.runTransaction(async tx=>{await owner(uid,tx,check);const permissions=await validate(tx,uid,value);await owner(uid,tx,check);tx.create(ref,{uid:id,email:value.email,role:'pic',state:'setup-pending',revision:1,createdBy:uid,createdAt:Date.now(),...permissions});});
        await auth.createUser({uid:id,email:value.email,password:value.password,disabled:true});created=true;
        if(!await check())fail(401,'Sesi Superadmin berakhir.');
        await auth.updateUser(id,{disabled:false});
        await db.runTransaction(async tx=>{
          await owner(uid,tx,check);const permissions=await validate(tx,uid,value);
          await owner(uid,tx,check);
          tx.update(ref,{...permissions,state:'active'});tx.set(root.collection('adminPairingPermissions').doc(id),{active:true,grants:permissions.grants});audit(root,tx,'pic-created',uid,id);
        });
        return {uid:id};
      }catch(error){
        // Auth and Firestore have no shared transaction. A failed setup must
        // remain denied; no deletion, credential disclosure or success fallback.
        if(created)await auth.updateUser(id,{disabled:true}).catch(()=>{});
        await db.runTransaction(async tx=>{const row=await tx.get(ref);if(row.exists){tx.update(ref,{state:'setup-failed',revision:2});tx.set(root.collection('adminPairingPermissions').doc(id),{active:false,grants:row.data().grants});}});
        if(error.adminAccountError)throw error;fail(503,'Akun belum berhasil dibuat. Periksa email yang mungkin sudah dipakai dan koneksi emulator.');
      }
    },
    async update(uid,id,value,check){
      if(!validId(id)||!value||Object.keys(value).some(k=>!['expectedRevision','state','actions','grants'].includes(k))||!Number.isSafeInteger(value.expectedRevision)||!['active','disabled','revoked'].includes(value.state))fail(400,'Perubahan akun tidak valid.');
      await db.runTransaction(async tx=>{
        await owner(uid,tx,check);const ref=root.collection('adminAccounts').doc(id),row=(await tx.get(ref)).data();
        if(row?.role!=='pic'||row.createdBy!==uid)fail(403,'Akun ini tidak dapat dikelola.');
        if(row.state==='setup-failed'||row.state==='setup-pending')fail(409,'Setup akun belum lengkap; minta operator memeriksanya.');
        if(row.revision!==value.expectedRevision)fail(409,'Akun sudah berubah. Muat ulang sebelum mencoba lagi.');
        const permissions=value.state==='active'?await validate(tx,uid,value):{actions:row.actions,grants:row.grants};
        await owner(uid,tx,check);
        tx.update(ref,{...permissions,state:value.state,revision:row.revision+1,updatedAt:Date.now()});
        tx.set(root.collection('adminPairingPermissions').doc(id),{active:value.state==='active',grants:permissions.grants});audit(root,tx,'pic-'+value.state,uid,id,{previous:{state:row.state,actions:row.actions,grants:row.grants,revision:row.revision},next:{state:value.state,...permissions,revision:row.revision+1}});
      });
      // Membership revision is authoritative immediately, including if Auth
      // revocation is unavailable. Other PICs and paired devices are untouched.
      return {updated:true};
    }
  };
}
