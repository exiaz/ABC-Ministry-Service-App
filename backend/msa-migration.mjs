import {hash,fail,normalizeUsername} from './msa-accounts.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {verifySnapshotContents} from '../local-snapshots.mjs';
import {validRosterScope} from './access-control.mjs';

export const migrationCollections=['adminAccounts','adminSecurity','adminPairingPermissions','msaAccounts','msaOrganizations','msaUsernames','msaLegacyUsernameLinks','mentorIdentityLinks','devices','msaDeviceAssociations','credentials','backupAssignments','msaMentorSessions','msaRecoveryRequests'];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>hash(JSON.stringify(stable(v)));
const same=(a,b)=>digest(a??null)===digest(b??null);
const scope=v=>Object.fromEntries(['schoolId','groupId','serviceSessionId'].map(k=>[k,v?.[k]??null]));
const ref=(kind,id)=>kind+'-'+hash(kind+':'+id).slice(0,16);
export const productionMigrationBlockers=[
  {code:'worker-fencing',reason:'Fencing dan rekonsiliasi recovery lintas proses belum tersedia.',remediation:'Tetapkan worker tunggal terfence dan prosedur operator independen; jangan hapus lock otomatis.'},
  {code:'trusted-owner-delivery',reason:'Kanal delivery, recovery owner dan step-up produksi belum disetujui.',remediation:'Sahkan prosedur trusted owner, verifikasi independen dan kanal pengiriman.'},
  {code:'external-revocation',reason:'Belum ada sumber revokasi/epoch eksternal yang tahan rollback.',remediation:'Buktikan snapshot lama tidak dapat menghidupkan akses dicabut sebelum restore.'},
  {code:'legacy-retirement',reason:'Retirement credential legacy dan enrollment operasional belum dilaksanakan.',remediation:'Verifikasi pemilik setiap mapping dan rencana retirement; jangan lakukan rebind otomatis.'}
];
export function migrationVerdict(statuses){return statuses.some(s=>!['ready','review','blocked'].includes(s))||statuses.includes('blocked')?'NO-GO':statuses.includes('review')?'CONDITIONAL GO':'GO';}

// Projection is deliberately allowlisted. No raw IDs, names, phones, aliases,
// credential hashes, recovery secrets or student rows leave this module.
export function analyzeMigration(tables,providers,{now=Date.now()}={}){
  const rows=n=>tables[n]??[],map=n=>new Map(rows(n).map(r=>[r.id,r])),a=map('msaAccounts'),legacy=map('adminAccounts'),registry=map('msaUsernames'),links=map('mentorIdentityLinks'),devices=map('devices'),bindings=map('msaDeviceAssociations'),credentials=map('credentials'),oldLinks=map('msaLegacyUsernameLinks'),permissions=map('adminPairingPermissions'),users=new Map(providers.map(u=>[u.uid,u]));
  const records=[],add=(kind,id,status,code,reason,remediation,extra={})=>records.push({reference:ref(kind,id),kind,status,code,reason,remediation,...extra});
  const accountOK=r=>r?.state==='active'&&r.provisioning==='ready'&&r.identity?.state==='verified'&&!r.recoveryLock;
  const denied=(kind,id,reason)=>add(kind,id,'ready','retained-denial',reason,'Pertahankan penolakan; jangan memulihkan akses melalui cutover/rollback.',{access:'denied'});
  for(const u of providers)if(!a.has(u.uid)&&!legacy.has(u.uid))add('provider',u.uid,'review','unscoped-provider','UID provider belum terpetakan dalam namespace ini; mungkin berasal dari namespace tes lain.','Periksa realm/provenance; jangan menganggapnya orphan operasional atau membuat peran otomatis.');
  const owner=rows('adminSecurity').find(r=>r.id==='owner');
  if(!owner||legacy.get(owner.uid)?.role!=='superadmin'||legacy.get(owner.uid)?.state!=='active'||!users.has(owner.uid)||users.get(owner.uid)?.disabled)add('owner','owner','blocked','owner-conflict','Owner marker dan Superadmin aktif tidak konsisten.','Rekonsiliasi UID pemilik yang sama melalui prosedur trusted; jangan membuat owner baru.');
  for(const r of rows('adminAccounts')){
    const l=oldLinks.get(r.id),p=users.get(r.id),claim=l&&registry.get(l.canonical);
    if(!['superadmin','pic'].includes(r.role)||r.role==='pic'&&(!Array.isArray(r.actions)||r.actions.some(v=>!['pairing:read','pairing:issue','pairing:revoke'].includes(v))||!Array.isArray(r.grants)||r.grants.some(s=>!validRosterScope(s))))add('legacy-policy',r.id,'blocked','legacy-policy','Role, tindakan atau cakupan legacy tidak valid.','Tinjau policy server; jangan menambahkan hak lewat username.');
    if(!p||a.has(r.id)||r.uid!==r.id)add('legacy-account',r.id,'blocked','legacy-conflict','UID legacy/provider/personal bertentangan atau hilang.','Periksa UID asli dan provenance; jangan merge otomatis.');
    else if(r.state!=='active'||p.disabled)denied('legacy-account',r.id,'Akun legacy nonaktif tetap ditolak.');
    else if(!l)add('legacy-account',r.id,'review','unenrolled','UID lama belum memiliki username terverifikasi.','Pemilik login lama dan reautentikasi melalui mekanisme A2.1 trusted.');
    else if(l.uid!==r.id||l.state!=='active'||l.identity?.state!=='verified'||claim?.uid!==r.id||claim.kind!=='legacy-admin'||claim.state!=='ready')add('legacy-account',r.id,'blocked','legacy-binding','Binding username legacy tidak konsisten.','Tinjau registry/link/revisi tanpa mengganti UID atau izin.');
    else if(r.role==='pic'&&(!permissions.get(r.id)?.active||!same(r.grants,permissions.get(r.id)?.grants)))add('legacy-account',r.id,'blocked','legacy-scope','Grant PIC dan izin pairing tidak konsisten.','Rekonsiliasi tindakan dan cakupan server; jangan memperluas izin.');
    else add('legacy-account',r.id,'ready','legacy-preserved','UID, role dan binding legacy konsisten.','Pertahankan UID/password, tindakan dan scope yang sama.');
  }
  const canonical=new Map(),identityGroups=new Map();
  for(const r of rows('msaAccounts')){
    const p=users.get(r.id),claim=registry.get(r.canonical);
    if(r.recoveryLock)add('personal-account',r.id,'blocked','recovery-lock','Akun memiliki recovery lock yang belum direkonsiliasi.','Pertahankan lock; operator tepercaya harus memeriksa hasil provider/DB.');
    else if(!p||r.uid!==r.id||claim?.uid!==r.id||claim.state!=='ready'||claim.kind==='legacy-admin'||legacy.has(r.id))add('personal-account',r.id,'blocked','personal-binding','UID provider, registry atau akun personal bertentangan.','Rekonsiliasi UID dan binding dengan bukti independen.');
    else if(r.state!=='active'||p.disabled)denied('personal-account',r.id,'Status akun personal nonaktif dipertahankan.');
    else if(!accountOK(r))add('personal-account',r.id,'review','identity-pending','Identitas/provisioning belum memenuhi syarat.','Selesaikan tinjauan terpisah; jangan memberi izin lewat migrasi.');
    else add('personal-account',r.id,'ready','personal-preserved','Akun personal aktif terverifikasi dan registry konsisten.','Pertahankan UID, role, state dan epoch.');
    if(!Array.isArray(r.roles)||r.roles.some(g=>!g.scope||!['superadmin','admin','pic','volunteer'].includes(g.role)||!['active','revoked'].includes(g.status)||g.role==='superadmin'&&g.scope.organizationId!==null||g.role!=='superadmin'&&!rows('msaOrganizations').some(o=>o.id===g.scope.organizationId&&o.state==='active'&&(!g.scope.programId||o.programIds?.includes(g.scope.programId))&&(!g.scope.eventId||o.events?.some(e=>e.id===g.scope.eventId&&(!g.scope.programId||e.programId===g.scope.programId))))))add('role',r.id,'blocked','role-shape','Record role/scope tidak lengkap atau katalog tidak cocok.','Tinjau struktur/otoritas role server sebelum cutover.');
    for(const key of [r.fullName&&'name:'+r.fullName.normalize('NFC').toLocaleLowerCase('id-ID'),r.phone?.normalized&&'phone:'+r.phone.normalized])if(key){const ids=identityGroups.get(key)??[];ids.push(r.id);identityGroups.set(key,ids);}
  }
  for(const r of rows('msaUsernames')){
    let name;try{name=normalizeUsername(r.id).canonical;}catch{}
    const prior=canonical.get(name),target=r.kind==='legacy-admin'?oldLinks.get(r.uid):a.get(r.uid);
    if(!name||name!==r.id||prior||!target||r.state!=='ready'||target.canonical!==r.id)add('username',r.id,'blocked','username-conflict','Registry tidak kanonik, duplikat atau target tidak cocok.','Periksa keunikan case-insensitive dan target UID; jangan menimpa claim.');
    else add('username',r.id,'ready','unique-username','Claim username kanonik cocok dengan target.','Jaga uniqueness transaksi dan UID asli.');
    if(name)canonical.set(name,r.uid);
  }
  for(const ids of identityGroups.values())if(ids.length>1)add('identity-warning',ids.slice().sort().join(':'),'review','possible-duplicate','Ada profil dengan nama/nomor serupa; ini bukan bukti identitas.','Periksa orang dan provenance secara independen; jangan tautkan atau merge otomatis.');
  for(const r of rows('mentorIdentityLinks')){
    const account=a.get(r.uid),binding=account?.mentorLink;
    if(r.state!=='active'){denied('mentor-link',r.id,'Tautan identitas nonaktif tidak dipulihkan.');continue;}
    if(!accountOK(account)||r.mentorId!==r.id||binding?.mentorId!==r.id||binding?.revision!==r.revision||!same(scope(binding?.scope),scope(r.scope))||!same(scope(account?.identity?.scope),scope(r.scope)))add('mentor-link',r.id,'blocked','mentor-conflict','Tautan UID–Mentor/revisi/scope tidak konsisten atau akun diblokir.','Tinjau bukti dan penugasan efektif; jangan mengklaim lewat nama/HP.');
    else add('mentor-link',r.id,'ready','mentor-linked','Link Mentor terverifikasi konsisten dengan akun.','Periksa kembali penugasan tetap/efektif pada dry run.');
  }
  for(const account of a.values())if(account.mentorLink&&links.get(account.mentorLink.mentorId)?.uid!==account.id)add('mentor-link',account.id,'blocked','missing-mentor-link','Akun menunjuk tautan Mentor hilang atau milik UID lain.','Tinjau provenance; jangan membuat link otomatis.');
  for(const r of rows('devices')){
    const b=bindings.get(r.id),c=b&&credentials.get(b.credentialId),account=b&&a.get(b.uid),l=b&&links.get(b.mentorId);
    if(!b&&!r.msaAccountBinding){add('device',r.id,r.state==='revoked'||r.expiresAt<=now?'review':'blocked','unresolved-legacy','Perangkat legacy belum memiliki atribusi akun terverifikasi.','Buktikan kontrol akun/key dan provenance; retirement/rebind memerlukan lingkup terpisah.',{access:r.state==='revoked'||r.expiresAt<=now?'denied':'legacy-only'});continue;}
    if(!b||r.msaAccountBinding?.uid!==b.uid||r.msaAccountBinding?.revision!==b.revision||b.deviceId!==r.id||!c||c.deviceId!==r.id||c.expiresAt!==r.expiresAt||r.kind!=='activation-v1'||c.binding!=='p256-v1'||!Array.isArray(c.grants)||c.grants.length!==1||!same(scope(c.grants[0]),scope(r.assignment))){add('device',r.id,'blocked','device-conflict','Marker/asosiasi/credential perangkat tidak konsisten.','Tetap tolak; rekonsiliasi tanpa mengganti ID/key/credential.');continue;}
    if(b.state!=='active'||r.state==='revoked'||c.revokedAt!==null||r.expiresAt<=now){denied('device',r.id,'Perangkat revoked/expired tetap ditolak.');continue;}
    if(!accountOK(account)||account.revision!==b.accountRevision||l?.state!=='active'||l.uid!==b.uid||l.revision!==b.linkRevision||account.mentorLink?.mentorId!==b.mentorId||account.mentorLink?.revision!==l.revision||!same(scope(b.primary),scope(l.scope))||!same(scope(r.assignment),scope(l.scope))||r.assignment?.mentorId!==b.mentorId)add('device',r.id,'blocked','stale-device','Asosiasi perangkat stale, scope berbeda atau akun diblokir.','Login dan aktivasi baru sesuai A2.3; jangan pulihkan asosiasi lama.',{access:'denied'});
    else add('device',r.id,'ready','linked-device','Asosiasi perangkat cocok dengan akun/link/credential.','Tetap wajib proof dan sesi personal server; cutover tidak menerbitkan izin.');
  }
  for(const r of rows('msaDeviceAssociations'))if(!devices.has(r.id))add('device-association',r.id,'blocked','orphan-association','Asosiasi menunjuk perangkat yang hilang.','Pertahankan penolakan dan tinjau jejak historis.');
  for(const r of rows('credentials'))if(!devices.has(r.deviceId))add('credential',r.id,'blocked','orphan-credential','Credential belum memiliki perangkat yang dapat direkonsiliasi.','Tinjau retirement secara eksplisit; jangan mengklaim pemilik.');
  for(const r of rows('msaMentorSessions')){
    const account=a.get(r.uid),stale=r.state!=='active'||r.expiresAt<=now||!accountOK(account)||r.revision!==account.revision;
    add('admission',r.id,stale?'review':'ready',stale?'stale-session':'live-admission',stale?'Admission lama harus tetap ditolak.':'Admission cocok dengan revisi akun saat diperiksa.','Sesi opaque A1/Admin dalam memori tidak dapat dienumerasi; restart tetap memerlukan login baru.',{access:stale?'denied':'session-check-required'});
  }
  for(const r of rows('msaRecoveryRequests')){
    const uncertain=r.state==='resetting'||r.uncertainAt&&r.state!=='completed';
    add('recovery',r.id,uncertain?'blocked':['completed','revoked','rejected'].includes(r.state)?'ready':'review',uncertain?'uncertain-recovery':'recovery-state',uncertain?'Hasil provider/database belum dapat dipastikan.':'Status recovery memerlukan preservasi revisi dan keputusan review.','Jangan membuka lock/challenge lewat flag atau snapshot; proses lain tidak dapat melanjutkan worker lama.');
  }
  for(const r of rows('backupAssignments'))add('backup',r.id,'review','backup-recheck','Grant backup memerlukan pemeriksaan Stage 6 per perangkat/sesi.','Cutover tidak menyalin atau memperpanjang grant; verifikasi exact scope/TTL pada regresi.');
  const summary=Object.fromEntries(['ready','review','blocked'].map(s=>[s,records.filter(r=>r.status===s).length]));
  return {readOnly:true,assessment:'isolated-emulator',summary,records:records.sort((a,b)=>a.reference.localeCompare(b.reference)),dryRunVerdict:migrationVerdict(records.map(r=>r.status)),productionVerdict:'NO-GO',productionBlockers:productionMigrationBlockers,sessionCoverage:'Admission persisten diperiksa; sesi opaque dalam memori tidak dienumerasi dan bukan bukti retirement credential.'};
}

// Trusted test checkpoints are opaque digests, never restorable snapshots. Full
// security equality is deliberately conservative: checksums alone do not prove
// revocation freshness. No restore/write/reconciliation action exists here.
export function migrationCheckpoint(tables,providers,historyDigest){
  return {version:1,securityDigest:digest({tables:Object.fromEntries(migrationCollections.map(n=>[n,(tables[n]??[]).slice().sort((a,b)=>a.id.localeCompare(b.id))])),providers:providers.slice().sort((a,b)=>a.uid.localeCompare(b.uid))}),historyDigest};
}
export function simulateUsernameMapping(tables,providers,proposals){
  const candidate=structuredClone(tables),issues=[],mapping=[],legacy=new Map((candidate.adminAccounts??[]).map(r=>[r.id,r])),users=new Map(providers.map(r=>[r.uid,r]));
  candidate.msaUsernames??=[];candidate.msaLegacyUsernameLinks??=[];
  for(const p of proposals){
    let name;try{name=normalizeUsername(p.username);}catch{issues.push({code:'invalid-username',status:'blocked'});continue;}
    const account=legacy.get(p.uid),claim=candidate.msaUsernames.find(r=>r.id.toLowerCase()===name.canonical),link=candidate.msaLegacyUsernameLinks.find(r=>r.id===p.uid);
    if(!account||account.uid!==p.uid||account.state!=='active'||!users.has(p.uid)||users.get(p.uid).disabled||p.reauthenticatedUid!==p.uid||p.identityVerified!==true||(candidate.msaAccounts??[]).some(r=>r.id===p.uid)||claim&&claim.uid!==p.uid||link&&link.canonical!==name.canonical){issues.push({code:'mapping-conflict',status:'blocked'});continue;}
    if(claim||link){if(claim?.uid!==p.uid||claim.kind!=='legacy-admin'||claim.state!=='ready'||link?.canonical!==name.canonical||link.state!=='active'||link.identity?.state!=='verified'){issues.push({code:'mapping-conflict',status:'blocked'});continue;}}
    else {candidate.msaUsernames.push({id:name.canonical,uid:p.uid,kind:'legacy-admin',state:'ready'});candidate.msaLegacyUsernameLinks.push({id:p.uid,uid:p.uid,canonical:name.canonical,username:name.display,state:'active',revision:1,identity:{state:'verified'}});}
    mapping.push({account:ref('legacy-account',p.uid),username:ref('username',name.canonical)});
  }
  // Only detached username rows are proposed. Owner, accounts, provider and all
  // historical tables remain byte-identical inputs; no apply method is exposed.
  const preserved=Object.keys(tables).filter(k=>!['msaUsernames','msaLegacyUsernameLinks'].includes(k)).every(k=>same(tables[k],candidate[k]));
  if(!preserved)issues.push({code:'unexpected-domain-change',status:'blocked'});
  return {readOnly:true,simulationOnly:true,mutations:0,verdict:migrationVerdict(issues.map(r=>r.status)),mapping,issues,uidRoleScopeOwnerHistoryPreserved:preserved};
}
export function compareMigrationCheckpoints(current,candidate,{snapshotSealed=false,expectedMappingVerified=false}={}){
  const checks=[{code:'snapshot-sealed',status:snapshotSealed===true?'ready':'blocked'},{code:'expected-mapping',status:expectedMappingVerified===true?'ready':'blocked'},{code:'security-freshness',status:current?.version===1&&candidate?.version===1&&/^[a-f0-9]{64}$/.test(current.securityDigest??'')&&current.securityDigest===candidate.securityDigest?'ready':'blocked'},{code:'history-preserved',status:/^[a-f0-9]{64}$/.test(current?.historyDigest??'')&&current.historyDigest===candidate?.historyDigest?'ready':'blocked'}];
  return {readOnly:true,verdict:migrationVerdict(checks.map(c=>c.status)),checks,restoreAuthorized:false};
}
// Trusted local copies only; no route accepts a filesystem path/checkpoint.
export async function verifyMigrationRollback(current,directory,{expectedMappingVerified=false}={}){
  let candidate,sealed=false;
  try{const contents=await verifySnapshotContents(directory);sealed=contents.sealed;candidate=JSON.parse(await readFile(path.join(directory,'migration-checkpoint.json'),'utf8'));}catch{}
  return compareMigrationCheckpoints(current,candidate,{snapshotSealed:sealed,expectedMappingVerified});
}

export function createMsaMigration({db,root,auth,registration,repository,assertEnabled,now=Date.now}){
  const enabled=()=>{assertEnabled();if(process.env.ABC_MSA_A2_4C!=='1'||!root.id.startsWith('test-'))fail(503,'Preflight migrasi uji tidak aktif.');};
  return {enabled,async inspect(actor){
    enabled();
    // Reject unauthorized callers before querying provider users.
    await db.runTransaction(tx=>registration.authorizeRecoveryReview(tx,actor,undefined,undefined,true));
    const page=await auth.listUsers(1000);if(page.pageToken)fail(409,'Inventaris provider melebihi batas pilot; hasil tidak dianggap lengkap.');
    const providers=page.users.map(u=>({uid:u.uid,disabled:u.disabled}));
    return db.runTransaction(async tx=>{
      await registration.authorizeRecoveryReview(tx,actor,undefined,undefined,true);const tables={};
      for(const name of migrationCollections){const rows=await tx.get(root.collection(name).limit(201));if(rows.size>200)fail(409,'Inventaris melebihi batas pilot; pagination/review diperlukan.');tables[name]=rows.docs.map(d=>({...d.data(),id:d.id}));}
      await registration.authorizeRecoveryReview(tx,actor,undefined,undefined,true);enabled();
      const report=analyzeMigration(tables,providers,{now:now()});
      for(const link of tables.mentorIdentityLinks.filter(l=>l.state==='active')){
        const context=repository&&await repository.describe(link.scope,{transaction:tx,mentorIdentity:true,defaultIdentity:true});
        if(!context||context.mentorId!==link.mentorId||context.defaultMentorId!==link.mentorId){report.records.push({reference:ref('assignment',link.id),kind:'assignment',status:'blocked',code:'assignment-conflict',reason:'Penugasan tetap/efektif tidak cocok dengan Mentor terverifikasi.',remediation:'Periksa tanggal, scope dan override; jangan memberi inheritance otomatis.'});report.summary.blocked++;report.dryRunVerdict='NO-GO';}
      }
      await registration.authorizeRecoveryReview(tx,actor,undefined,undefined,true);enabled();
      // Auth and Firestore have no shared snapshot/transaction. State this limit
      // explicitly; a consistent-looking report can never authorize cutover.
      return {...report,observedAt:now(),consistency:'Firestore transaksional; pembacaan Auth terpisah, bukan snapshot lintas provider.',checklist:[
        {code:'snapshot',status:'blocked',reason:'Snapshot belum divalidasi oleh preflight; jalankan verifikasi trusted pada salinan tes tersegel.'},
        {code:'mapping',status:report.dryRunVerdict==='NO-GO'?'blocked':report.dryRunVerdict==='GO'?'ready':'review',reason:'Cocokkan UID, role/scope, Mentor dan perangkat dengan baseline trusted.'},
        {code:'dry-run-reconciliation',status:'review',reason:'Jalankan simulasi mapping detached dan bandingkan digest sebelum/sesudah; preflight tidak menjalankan binding.'},
        {code:'enrollment',status:report.records.some(r=>['unenrolled','identity-pending','unscoped-provider'].includes(r.code))?'review':'ready',reason:'Pastikan seluruh pengguna sasaran sudah diverifikasi dan terdaftar; nama/HP tidak cukup.'},
        {code:'recovery-state',status:report.records.some(r=>['recovery-lock','uncertain-recovery'].includes(r.code))?'blocked':'review',reason:'Lock tidak boleh dibuka otomatis; kesiapan owner/worker lintas proses tetap memerlukan operator trusted.'},
        ...productionMigrationBlockers.map(b=>({...b,status:'blocked'})),
        {code:'post-regression',status:'review',reason:'Bukti runner regresi harus sesuai revisi kode/data; preflight tidak mengarang hasil tes.'}
      ]};
    });
  }};
}
