import {createHash,randomUUID} from 'node:crypto';
import {adminPolicy} from './admin-accounts.mjs';

export const hash=value=>createHash('sha256').update(value).digest('hex');
export const fail=(status,message)=>{throw Object.assign(Error(message),{status,adminAccountError:true});};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const roles=['superadmin','admin','pic','volunteer'];
const states=['pending','active','rejected','suspended','disabled'];
const reserved=new Set(['admin','administrator','superadmin','root','system','support','api','msa','abc','login','register','null','undefined']);
export function normalizeUsername(value){
  if(typeof value!=='string')fail(400,'Username tidak valid.');
  const display=value.trim(),canonical=display.toLowerCase();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(display)||reserved.has(canonical))fail(400,'Username harus 3–32 karakter huruf ASCII, angka, titik, garis bawah atau tanda hubung; nama sistem dicadangkan.');
  return {display,canonical};
}
export function normalizePhone(value){
  if(value===undefined||value==='')return null;
  if(typeof value!=='string'||value.length>40||!/^[+\d ()-]+$/.test(value))fail(400,'Nomor HP Indonesia tidak valid.');
  let number=value.replace(/[ ()-]/g,'');
  if(number.startsWith('08'))number='+62'+number.slice(1);
  else if(number.startsWith('628'))number='+'+number;
  if(!/^\+628\d{8,11}$/.test(number))fail(400,'Gunakan nomor HP Indonesia dengan awalan 08, 628 atau +628.');
  return {supplied:value,normalized:number,state:'supplied',verifiedAt:null};
}
export const scopeKey=scope=>JSON.stringify([scope.organizationId,scope.programId??null,scope.eventId??null]);
const grantKey=(role,scope)=>hash(role+':'+scopeKey(scope));
const publicAccount=row=>({uid:row.uid,username:row.username,fullName:row.fullName,profile:row.profile??{},state:row.state,revision:row.revision,identity:row.origin==='a2-2'?{state:row.identity.state}:row.identity,eligibleRoles:row.eligibleRoles,phoneState:row.phone?.state??'absent',roles:row.roles,provisioning:row.provisioning});

// Shared atomic reservation for trusted A1 fixtures and isolated A2.2 intake.
export async function reserveUsername(tx,ref,claim,row,matches){
  const [r,c]=await tx.getAll(ref,claim);
  if(r.exists){if(!matches(r.data()))fail(409,'Permintaan setup berbeda.');return false;}
  if(c.exists)fail(409,'Username tidak tersedia.');
  tx.create(claim,{uid:row.uid,state:'reserved'});tx.create(ref,row);return true;
}

// A1 trusted enrollment and authorization. Isolated intake/review lives in
// msa-registration; owner bootstrap, migration and reset are not exposed here.
export function createMsaAccounts({db,root,auth,assertLocal,now=Date.now}){
  const accounts=root.collection('msaAccounts'),registry=root.collection('msaUsernames');
  const event=(tx,actor,target,previous,next,reason)=>tx.create(root.collection('msaAuthorizationEvents').doc(randomUUID()),{actorUid:actor,targetUid:target,previous,next,reason,at:now()});
  const read=async(tx,uid)=>{const row=(await tx.get(accounts.doc(uid))).data();if(!row||row.uid!==uid||row.provisioning!=='ready')fail(403,'Akun tidak tersedia.');return row;};
  const active=row=>{if(row.state!=='active'||row.identity?.state!=='verified')fail(403,'Akun belum terverifikasi atau tidak aktif.');};
  const providerActive=async uid=>{try{const user=await auth.getUser(uid);return user.uid===uid&&!user.disabled;}catch{return false;}};
  const manager=async(tx,actor)=>{
    assertLocal();
    if(actor.kind==='legacy'){
      const policy=await adminPolicy(root,actor.uid,{tx});
      if(policy.role!=='superadmin'||policy.revision!==actor.revision||!await actor.check())fail(403,'Hanya Superadmin aktif yang dapat mengelola akun.');
    }else{
      const row=await read(tx,actor.uid);active(row);
      if(row.revision!==actor.revision||!await actor.check()||!row.roles.some(g=>g.role==='superadmin'&&g.status==='active'&&g.scope.organizationId===null))fail(403,'Hanya Superadmin aktif yang dapat mengelola akun.');
    }
  };
  const validateScope=async(tx,role,scope)=>{
    if(!scope||Array.isArray(scope)||Object.keys(scope).some(k=>!['organizationId','programId','eventId'].includes(k)))fail(400,'Cakupan tidak valid.');
    if(role==='superadmin'){
      if(scope.organizationId!==null||Object.keys(scope).length!==1)fail(400,'Superadmin memakai cakupan sistem eksplisit.');return {organizationId:null};
    }
    if(!id(scope.organizationId)||scope.programId!==undefined&&!id(scope.programId)||scope.eventId!==undefined&&!id(scope.eventId))fail(400,'Pilih organisasi dan cakupan yang valid.');
    const org=(await tx.get(root.collection('msaOrganizations').doc(scope.organizationId))).data();
    if(org?.state!=='active')fail(403,'Organisasi tidak diizinkan.');
    if(scope.programId&&!org.programIds?.includes(scope.programId)||scope.eventId&&!org.events?.some(e=>e.id===scope.eventId&&(!scope.programId||e.programId===scope.programId)))fail(403,'Program atau pelayanan di luar organisasi.');
    return {...scope};
  };
  return {
    // Explicit fictional marker prevents accidental reuse as a general provisioner.
    async provisionFixture(value){
      assertLocal();
      if(value?.fictional!==true||typeof value.fullName!=='string'||!value.fullName.trim()||value.fullName.length>120||typeof value.password!=='string'||value.password.length<12||value.password.length>128||!id(value.requestId))fail(400,'Fixture akun fiktif tidak valid.');
      const profile=value.profile??{};
      if(!profile||Array.isArray(profile)||typeof profile!=='object'||Object.keys(profile).some(k=>k!=='preferredName'||typeof profile[k]!=='string'||profile[k].length>80))fail(400,'Metadata profil tidak valid.');
      const username=normalizeUsername(value.username),phone=normalizePhone(value.phone),uid='msa-'+hash(root.path+':'+value.requestId).slice(0,40),alias=uid+'@msa.example.invalid';
      const ref=accounts.doc(uid),claim=registry.doc(username.canonical);
      const fresh=await db.runTransaction(async tx=>{
        return reserveUsername(tx,ref,claim,{uid,username:username.display,canonical:username.canonical,providerAlias:alias,fullName:value.fullName.trim(),profile,phone,state:'pending',identity:{state:'unverified'},eligibleRoles:[],roles:[],revision:1,provisioning:'reserved',createdAt:now()},r=>r.canonical===username.canonical&&r.fullName===value.fullName.trim());
      });
      if(!fresh)return {uid,provisioning:(await ref.get()).data().provisioning};
      try{
        await auth.createUser({uid,email:alias,password:value.password});
        await db.runTransaction(async tx=>{const r=await tx.get(ref);if(r.data()?.provisioning!=='reserved')fail(409,'Setup berubah.');tx.update(ref,{provisioning:'ready'});tx.update(claim,{state:'ready'});});
        return {uid,provisioning:'ready'};
      }catch{
        // Retain reservation/UID; never recycle a possibly created credential.
        // Explicit trusted reconciliation is required after partial failure.
        await ref.update({provisioning:'failed'});fail(503,'Setup akun gagal; reservasi dipertahankan untuk rekonsiliasi.');
      }
    },
    async list(actor,{search='',state='',role=''}={}){
      if(typeof search!=='string'||search.length>120||state&&!states.includes(state)||role&&!roles.includes(role))fail(400,'Filter akun tidak valid.');
      return db.runTransaction(async tx=>{
        await manager(tx,actor);
        const rows=await tx.get(accounts.limit(201));
        if(rows.size>200)fail(409,'Registry uji melebihi batas; pencarian berhalaman diperlukan sebelum perluasan.');
        const needle=search.trim().toLowerCase();
        const result=rows.docs.map(d=>d.data()).filter(r=>(!state||r.state===state)&&(!role||r.roles.some(g=>g.role===role&&g.status==='active'))&&(!needle||[r.username,r.fullName].some(v=>v.toLowerCase().includes(needle)))).map(publicAccount);
        const orgs=await tx.get(root.collection('msaOrganizations').where('state','==','active').limit(100));
        await manager(tx,actor);return {accounts:result,organizations:orgs.docs.map(d=>({id:d.id,name:d.data().name,programIds:d.data().programIds??[],events:d.data().events??[]}))};
      });
    },
    async change(actor,uid,value){
      if(!id(uid)||!value||Array.isArray(value)||Object.keys(value).some(k=>!['expectedRevision','requestId','reason','role','scope','status','state'].includes(k))||!id(value.requestId)||!Number.isSafeInteger(value.expectedRevision)||typeof value.reason!=='string'||value.reason.trim().length<5||value.reason.length>300)fail(400,'Perubahan memerlukan revisi, alasan dan ID permintaan yang valid.');
      const stateChange=value.state!==undefined;
      if(stateChange?(!states.includes(value.state)||value.role!==undefined||value.scope!==undefined||value.status!==undefined):(!roles.includes(value.role)||!['active','revoked'].includes(value.status)))fail(400,'Perubahan status atau peran tidak valid.');
      const fingerprint=hash(JSON.stringify([uid,value.expectedRevision,value.reason,stateChange?value.state:[value.role,value.scope,value.status]]));
      return db.runTransaction(async tx=>{
        await manager(tx,actor);
        if(uid===actor.uid)fail(403,'Perubahan izin atau status akun sendiri ditolak.');
        const receipt=root.collection('msaRoleReceipts').doc(hash(actor.uid+':'+value.requestId));
        const previousReceipt=(await tx.get(receipt)).data();
        if(previousReceipt){if(previousReceipt.fingerprint!==fingerprint)fail(409,'ID permintaan sudah digunakan.');return previousReceipt.result;}
        const row=await read(tx,uid);
        if(row.revision!==value.expectedRevision)fail(409,'Akun sudah berubah. Muat ulang sebelum mencoba lagi.');
        let nextRoles=row.roles,scope;
        if(!stateChange){
          active(row);scope=await validateScope(tx,value.role,value.scope);
          if(value.status==='active'&&!row.eligibleRoles.includes(value.role))fail(403,'Akun belum dinyatakan layak untuk peran ini.');
          const key=grantKey(value.role,scope),grant={id:key,role:value.role,scope,status:value.status};
          if(value.status==='revoked'&&!row.roles.some(g=>g.id===key))fail(400,'Penugasan peran tidak ditemukan.');
          nextRoles=[...row.roles.filter(g=>g.id!==key),grant];
        }
        const nextState=stateChange?value.state:row.state;
        if(nextState==='active'&&row.identity?.state!=='verified')fail(403,'Identitas belum terverifikasi.');
        if(nextState==='active'&&(stateChange||value.status==='active')&&!await providerActive(uid))fail(403,'Identitas provider tidak tersedia atau nonaktif.');
        if(row.roles.some(g=>g.role==='superadmin'&&g.status==='active')&&(nextState!=='active'||!nextRoles.some(g=>g.role==='superadmin'&&g.status==='active'))){
          // Shared guard plus transactional query serialize concurrent removals.
          const guard=root.collection('msaSecurity').doc('roleChanges');await tx.get(guard);
          const all=await tx.get(accounts.where('state','==','active'));
          const candidates=all.docs.filter(d=>d.id!==uid&&d.data().provisioning==='ready'&&d.data().identity?.state==='verified'&&d.data().roles.some(g=>g.role==='superadmin'&&g.status==='active'&&g.scope.organizationId===null));
          if(!(await Promise.all(candidates.map(d=>providerActive(d.id)))).some(Boolean))fail(409,'Superadmin aktif terakhir tidak dapat dinonaktifkan atau dicabut.');
        }
        await manager(tx,actor);
        const next={state:nextState,roles:nextRoles,revision:row.revision+1};
        tx.update(accounts.doc(uid),{...next,updatedAt:now()});
        tx.set(root.collection('msaSecurity').doc('roleChanges'),{at:now(),nonce:randomUUID()});
        event(tx,actor.uid,uid,{state:row.state,roles:row.roles,revision:row.revision},next,value.reason.trim());
        const result={updated:true,revision:next.revision};tx.create(receipt,{fingerprint,result});return result;
      });
    },
    async audit(actor){return db.runTransaction(async tx=>{await manager(tx,actor);const rows=await tx.get(root.collection('msaAuthorizationEvents').orderBy('at','desc').limit(100));await manager(tx,actor);return {events:rows.docs.map(d=>d.data())};});},
    async profile(uid,revision){return db.runTransaction(async tx=>{assertLocal();const row=await read(tx,uid);active(row);if(row.revision!==revision)fail(401,'Sesi akun berubah. Masuk kembali.');return publicAccount(row);});},
    async access(uid,revision,{role,scope}){
      return db.runTransaction(async tx=>{
        assertLocal();const row=await read(tx,uid);active(row);if(row.revision!==revision)fail(401,'Sesi akun berubah. Masuk kembali.');
        if(!roles.includes(role)||role==='superadmin')fail(403,'Peran operasional tidak diizinkan.');
        await validateScope(tx,role,scope);
        const allowed=row.roles.some(g=>g.status==='active'&&(g.role==='superadmin'||g.role===role&&g.scope.organizationId===scope.organizationId&&(!g.scope.programId||g.scope.programId===scope.programId)&&(!g.scope.eventId||g.scope.eventId===scope.eventId)));
        if(!allowed)fail(403,'Cakupan akses ditolak.');return {allowed:true};
      });
    }
  };
}
