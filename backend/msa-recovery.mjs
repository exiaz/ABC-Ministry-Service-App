import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {hash,fail,normalizeUsername} from './msa-accounts.mjs';

// The isolated pilot has one process. Fence uncertain provider operations to that
// process; another process must never resume a possibly live Firebase writer.
const worker=randomUUID(),running=new Set();
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>names.includes(k));
const text=v=>typeof v==='string'&&v.trim().length>=5&&v.length<=300&&!/[\p{Cc}\p{Cf}]/u.test(v);
export const recoveryPassword=v=>typeof v==='string'&&v.length>=12&&v.length<=128&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v);
const generic={received:true,message:'Jika akun memenuhi syarat, permintaan akan ditinjau. Hubungi penanggung jawab untuk pemeriksaan identitas. Jangan berikan kata sandi Anda.'};
const denied=()=>fail(403,'Pemulihan tidak berlaku atau perlu pemeriksaan penanggung jawab.');

export function createMsaRecovery({db,root,auth,assertEnabled,registration,now=Date.now}){
  const col=n=>root.collection(n),requests=col('msaRecoveryRequests'),accounts=col('msaAccounts');
  const enabled=()=>{assertEnabled();if(process.env.ABC_MSA_A2_4B!=='1'||!root.id.startsWith('test-'))fail(503,'Pemulihan uji tidak aktif.');};
  const eligible=async(tx,a)=>{
    if(!a||a.origin!=='a2-2'||a.provisioning!=='ready'||a.state!=='active'||a.identity?.state!=='verified'||a.roles?.some(g=>g.role==='superadmin'))denied();
    const [legacy,owner]=await tx.getAll(col('adminAccounts').doc(a.uid),col('adminSecurity').doc('owner'));
    if(legacy.exists||owner.data()?.uid===a.uid)denied();
  };
  const rate=async(kind,key,max)=>{
    enabled();await db.runTransaction(async tx=>{
      const refs=['global',hash(key)].map(k=>col('msaRecoveryLimits').doc(kind+'-'+k)),rows=await tx.getAll(...refs),window=Math.floor(now()/60000),counts=rows.map(r=>r.data()?.window===window?r.data().count:0);
      if(counts[0]>=120||counts[1]>=max)fail(429,'Permintaan belum dapat diproses. Coba lagi nanti.');
      refs.forEach((r,i)=>tx.set(r,{window,count:counts[i]+1}));
    });
  };
  const event=(tx,r,operation,actorUid,extra={})=>tx.create(col('msaRecoveryEvents').doc(randomUUID()),{requestId:r.id,targetUid:r.uid,operation,actorUid,at:now(),...extra});
  const read=async(tx,id)=>{
    if(!/^[a-f0-9]{64}$/.test(id??''))denied();
    const r=(await tx.get(requests.doc(id))).data();if(!r)denied();return r;
  };
  const authorize=(tx,actor,a,r,onlySuperadmin=false)=>registration.authorizeRecoveryReview(tx,actor,a,r?.delegation,onlySuperadmin);
  const project=r=>({id:r.id,uid:r.uid,username:r.username,state:r.state,revision:r.revision,accountRevision:r.accountRevision,createdAt:r.createdAt,expiresAt:r.expiresAt??null});
  return {
    enabled,
    async request(value){
      enabled();const start=Date.now();let canonical;try{canonical=normalizeUsername(value?.username).canonical;}catch{canonical='!invalid';}
      await rate('request',canonical,8);
      if(!keys(value,['username','requestId'])||!uuid(value.requestId))fail(400,'Pengajuan tidak valid.');
      if(canonical==='!invalid')normalizeUsername(value.username);
      try{
        await db.runTransaction(async tx=>{
          enabled();const claim=(await tx.get(col('msaUsernames').doc(canonical))).data();
          if(!claim?.uid||claim.state!=='ready'||claim.kind==='legacy-admin')return;
          const a=(await tx.get(accounts.doc(claim.uid))).data();
          try{await eligible(tx,a);}catch(e){if(e.status===403)return;throw e;}
          if(a.recoveryLock)return;
          const id=hash(canonical+':'+value.requestId),prior=await tx.get(requests.doc(id));
          // One unresolved request per UID; public repeats never revoke approval.
          const unresolved=await tx.get(requests.where('uid','==',a.uid).where('state','in',['pending','approved','resetting']).limit(1));
          if(prior.exists||!unresolved.empty)return;
          const r={id,uid:a.uid,username:a.username,state:'pending',revision:1,accountRevision:a.revision,createdAt:now()};
          tx.create(requests.doc(id),r);event(tx,r,'requested',null);
        });return generic;
      }finally{await delay(Math.max(0,150-(Date.now()-start)));}
    },
    async queue(actor){
      enabled();await rate('review',actor.uid,120);
      return db.runTransaction(async tx=>{
        const power=await authorize(tx,actor),query=power.superadmin?requests:requests.where('delegation.reviewerUid','==',actor.uid),rows=await tx.get(query.limit(201));
        if(rows.size>200)fail(409,'Batas antrean uji tercapai.');const result=[];
        for(const d of rows.docs){const r=d.data(),a=(await tx.get(accounts.doc(r.uid))).data();try{await authorize(tx,actor,a,r);result.push({...project(r),accountRevision:a.revision});}catch(e){if(e.status!==403)throw e;}}
        enabled();return {superadmin:power.superadmin,requests:result};
      });
    },
    async review(actor,id,value){
      enabled();await rate('review',actor.uid,120);
      if(!keys(value,['requestId','expectedRevision','expectedAccountRevision','reason','decision','evidence','confirmed','reviewerUid'])||!uuid(value.requestId)||!Number.isSafeInteger(value.expectedRevision)||!Number.isSafeInteger(value.expectedAccountRevision)||!text(value.reason)||value.confirmed!==true||!['approve','reject','pending','revoke','delegate'].includes(value.decision))fail(400,'Isi alasan, revisi dan konfirmasi tinjauan.');
      return db.runTransaction(async tx=>{
        const r=await read(tx,id),a=(await tx.get(accounts.doc(r.uid))).data();await authorize(tx,actor,a,r,value.decision==='delegate');
        if(actor.uid===r.uid)denied();
        const receipt=col('msaRecoveryReceipts').doc(hash(actor.uid+':'+value.requestId)),prior=(await tx.get(receipt)).data(),fingerprint=hash(JSON.stringify([id,value]));
        if(prior){if(prior.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');return prior.result;}
        if(r.revision!==value.expectedRevision||a.revision!==value.expectedAccountRevision)fail(409,'Pengajuan atau akun berubah. Muat ulang.');
        const decision=value.decision,patch={revision:r.revision+1};
        if(decision==='delegate'){
          if(r.state!=='pending'||!a.identity?.scope||!/^[-\w]{1,128}$/.test(value.reviewerUid??'')||value.reviewerUid===r.uid)denied();
          const pic=(await tx.get(col('adminAccounts').doc(value.reviewerUid))).data();
          patch.delegation={reviewerUid:value.reviewerUid,reviewerRevision:pic?.revision??0,scope:a.identity.scope};
          await authorize(tx,{kind:'legacy',uid:value.reviewerUid,revision:pic?.revision,check:actor.check},a,{delegation:patch.delegation});
        }else{
          if(['completed','revoked'].includes(r.state)||r.state==='resetting'&&decision!=='revoke')fail(409,'Status pengajuan tidak dapat diubah.');
          patch.state=decision==='approve'?'approved':decision==='reject'?'rejected':decision==='revoke'?'revoked':'pending';
          patch.challengeHash=null;
          if(decision==='approve'){
            await eligible(tx,a);if(a.recoveryLock)denied();
            const e=value.evidence;
            if(!keys(e,['method','reference','confirmed'])||!['in-person','trusted-record'].includes(e.method)||!text(e.reference)||e.confirmed!==true)fail(400,'Persetujuan memerlukan bukti independen dan konfirmasi baru.');
            patch.accountRevision=a.revision;patch.securityEpoch=a.securityEpoch??0;patch.approvedAt=now();patch.expiresAt=now()+600000;
          }else if(value.evidence!==undefined)fail(400,'Bukti hanya untuk persetujuan.');
        }
        enabled();if(!await actor.check())denied();const result={updated:true,revision:patch.revision};
        tx.update(requests.doc(id),patch);event(tx,r,'review-'+decision,actor.uid,{reason:value.reason.trim(),confirmed:true,evidence:value.evidence??null,reviewerUid:value.reviewerUid??null,previousRevision:r.revision,revision:patch.revision,scope:a.identity?.scope??null});tx.create(receipt,{fingerprint,result});return result;
      });
    },
    // Trusted local IPC only. Never mount this method on HTTP or reviewer UI.
    async deliver(username){
      enabled();const canonical=normalizeUsername(username).canonical,secret=randomBytes(32).toString('base64url');
      return db.runTransaction(async tx=>{
        const claim=(await tx.get(col('msaUsernames').doc(canonical))).data();if(!claim?.uid)denied();
        const a=(await tx.get(accounts.doc(claim.uid))).data();await eligible(tx,a);if(a.recoveryLock)denied();
        const rows=await tx.get(requests.where('uid','==',a.uid).where('state','==','approved').limit(2));if(rows.size!==1)denied();
        const r=rows.docs[0].data();if(r.expiresAt<=now()||r.accountRevision!==a.revision||(a.securityEpoch??0)!==r.securityEpoch)denied();
        // Delivery cannot be repeated: no second raw copy or silent rotation.
        if(r.challengeHash)fail(409,'Otorisasi sudah diserahkan. Gunakan proses pemulihan yang sama atau minta tinjauan baru.');
        tx.update(requests.doc(r.id),{challengeHash:hash(secret),challengeRevision:r.revision,deliveredAt:now()});event(tx,r,'trusted-test-delivery',null);
        return {id:r.id,secret};
      });
    },
    async reset(value){
      enabled();await rate('reset',typeof value?.id==='string'?value.id:'invalid',8);
      if(!keys(value,['id','secret','password'])||!/^[-\w]{43}$/.test(value.secret??'')||!recoveryPassword(value.password))fail(400,'Gunakan otorisasi yang sah dan kata sandi 12–128 karakter.');
      const key=root.path+':'+value.id;if(running.has(key))fail(409,'Pemulihan sedang diproses. Tunggu sebelum mencoba lagi.');running.add(key);
      try{
        const operation=await db.runTransaction(async tx=>{
          enabled();const r=await read(tx,value.id),a=(await tx.get(accounts.doc(r.uid))).data();await eligible(tx,a);
          if(r.challengeHash!==hash(value.secret)||r.challengeRevision!==r.revision||r.expiresAt<=now())denied();
          if(r.state==='resetting'){
            if(r.worker!==worker||a.recoveryLock!==r.id||a.revision!==r.resetRevision)denied();return r;
          }
          if(r.state!=='approved'||a.recoveryLock||a.revision!==r.accountRevision||(a.securityEpoch??0)!==r.securityEpoch)denied();
          const next={...r,state:'resetting',worker,resetRevision:a.revision+1};
          tx.update(accounts.doc(a.uid),{recoveryLock:r.id,revision:next.resetRevision,securityEpoch:(a.securityEpoch??0)+1,updatedAt:now()});
          tx.update(requests.doc(r.id),{state:next.state,worker,resetRevision:next.resetRevision});event(tx,r,'reset-prepared',null,{previousRevision:a.revision,revision:next.resetRevision});return next;
        });
        // Serial provider writes in this pilot process; no password/hash is stored
        // in Firestore. Retrying the consumed challenge resumes this operation.
        try{
          enabled();const user=await auth.getUser(operation.uid);if(user.disabled)denied();
          await auth.updateUser(operation.uid,{password:value.password});enabled();await auth.revokeRefreshTokens(operation.uid);
          return await db.runTransaction(async tx=>{
            enabled();const r=await read(tx,value.id),a=(await tx.get(accounts.doc(r.uid))).data();await eligible(tx,a);
            if(r.state!=='resetting'||r.worker!==worker||a.recoveryLock!==r.id||a.revision!==r.resetRevision||r.challengeHash!==hash(value.secret))denied();
            tx.update(accounts.doc(a.uid),{recoveryLock:null,updatedAt:now()});tx.update(requests.doc(r.id),{state:'completed',challengeHash:null,completedAt:now()});event(tx,r,'reset-completed',null,{revision:a.revision});return {reset:true,message:'Kata sandi telah diganti. Masuk kembali, lalu minta aktivasi perangkat baru kepada PIC.'};
          });
        }catch{
          // No compensating unlock or role/status changes on uncertain provider
          // results. Durable lock denies all access until a safe same-worker retry.
          try{await db.runTransaction(async tx=>{const r=await read(tx,value.id);if(r.state==='resetting'){tx.update(requests.doc(r.id),{uncertainAt:now()});event(tx,r,'reset-uncertain',null);}});}catch{}
          fail(503,'Pemulihan belum selesai. Akses akun ditutup. Coba lagi melalui proses pemulihan yang sama.');
        }
      }finally{running.delete(key);}
    }
  };
}
