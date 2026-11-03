import {adminPolicy} from './admin-accounts.mjs';
import {normalizeUsername,fail} from './msa-accounts.mjs';
import {randomUUID} from 'node:crypto';

// Isolated pilot only. No HTTP claim route, no Auth mutation, no role copy.
export function createLegacyUsernamePilot({db,root,auth,assertPilot,emailActor,verifyPassword,consumeAttempt,now=Date.now}){
  const links=root.collection('msaLegacyUsernameLinks'),registry=root.collection('msaUsernames');
  const actor=async header=>{
    assertPilot();const p=await emailActor(header);
    if(p.kind!=='ok'||!['superadmin','pic'].includes(p.role))fail(403,'Sesi email Admin/PIC yang sah diperlukan.');return p;
  };
  const resolve=async(canonical,{tx}={})=>{
    assertPilot();const get=ref=>tx?tx.get(ref):ref.get();
    const claim=(await get(registry.doc(canonical))).data();
    if(claim?.kind!=='legacy-admin'||claim.state!=='ready')fail(403,'Pengikatan username tidak berlaku.');
    const link=(await get(links.doc(claim.uid))).data();
    if(link?.uid!==claim.uid||link.canonical!==canonical||link.state!=='active'||link.identity?.state!=='verified')fail(403,'Pengikatan username tidak berlaku.');
    const policy=await adminPolicy(root,claim.uid,{tx});
    if(!['superadmin','pic'].includes(policy.role))fail(403,'Izin Admin/PIC tidak berlaku.');
    return {uid:claim.uid,username:link.username,linkRevision:link.revision,policy};
  };
  return {
    resolve,
    async inspect({header,username}){
      const p=await actor(header);if(p.role!=='superadmin')fail(403,'Pemeriksaan registry hanya untuk Superadmin.');
      const {canonical}=normalizeUsername(username);
      return db.runTransaction(async tx=>{
        const policy=await adminPolicy(root,p.uid,{tx});if(policy.role!=='superadmin'||policy.revision!==p.revision)fail(403,'Izin berubah.');
        const claim=await tx.get(registry.doc(canonical));await actor(header);
        return {canonical,available:!claim.exists};
      });
    },
    async claim({header,username,password,expectedUid,reason,confirmed=false}){
      const p=await actor(header),name=normalizeUsername(username);
      if(!confirmed||p.uid!==expectedUid||typeof reason!=='string'||reason.trim().length<5||reason.length>300)fail(403,'Pengikatan hanya untuk UID sesi sendiri dengan alasan dan konfirmasi eksplisit.');
      await consumeAttempt(name.canonical);
      // Provider identifier is server-derived; callers cannot choose an email/UID.
      let user,principal;
      try{user=await auth.getUser(p.uid);principal=await verifyPassword(user.email,password);if(user.disabled||principal.uid!==p.uid)throw Error();}
      catch{fail(401,'Verifikasi ulang akun ditolak.');}
      return db.runTransaction(async tx=>{
        assertPilot();const policy=await adminPolicy(root,p.uid,{tx});
        if(policy.revision!==p.revision||policy.role!==p.role)fail(403,'Izin berubah; masuk kembali sebelum mengikat username.');
        const claimRef=registry.doc(name.canonical),linkRef=links.doc(p.uid);
        const [existing,link,personal]=await tx.getAll(claimRef,linkRef,root.collection('msaAccounts').doc(p.uid));
        if(personal.exists)fail(409,'UID sudah memiliki registry personal; perlu review terpisah.');
        await actor(header);const provider=await auth.getUser(p.uid);
        assertPilot();
        if(provider.disabled||provider.email!==user.email)fail(403,'Identitas provider berubah.');
        if(existing.exists||link.exists){
          if(existing.data()?.uid===p.uid&&existing.data()?.kind==='legacy-admin'&&existing.data()?.state==='ready'&&link.data()?.canonical===name.canonical&&link.data()?.state==='active')return {uid:p.uid,username:link.data().username,alreadyBound:true};
          fail(409,'Username atau UID sudah terikat. Tidak ada penggantian otomatis.');
        }
        const at=now();
        tx.create(claimRef,{uid:p.uid,kind:'legacy-admin',state:'ready'});
        tx.create(linkRef,{uid:p.uid,canonical:name.canonical,username:name.display,state:'active',revision:1,identity:{state:'verified',method:'existing-email-session-and-password',actorUid:p.uid,verifiedAt:at}});
        tx.create(root.collection('msaAuthorizationEvents').doc(randomUUID()),{event:'legacy-username-bound',actorUid:p.uid,targetUid:p.uid,previous:{username:null},next:{username:name.display,canonical:name.canonical},reason:reason.trim(),at});
        return {uid:p.uid,username:name.display,alreadyBound:false};
      });
    }
  };
}
