import {randomUUID,randomBytes} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {initializeOwner} from '../../backend/admin-accounts.mjs';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';

export async function msaFixture(t,{usernamePilot=false,source,namespace}={}){
  const previous={flag:process.env.ABC_MSA_A1,pilot:process.env.ABC_MSA_USERNAME_PILOT,namespace:process.env.ABC_FIRESTORE_NAMESPACE};
  const c=await emulatorFixture({source,namespace});process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;process.env.ABC_MSA_A1='1';
  if(usernamePilot)process.env.ABC_MSA_USERNAME_PILOT='1';else delete process.env.ABC_MSA_USERNAME_PILOT;
  const f=await adminLoginFixture(t,{pairing:c.pairing,repository:c.repository,mentorAccounts:c.mentorAccounts}),created=[];
  await initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed:true});
  for(const organization of [{id:'org-a',name:'Organisasi Fiktif A'},{id:'org-b',name:'Organisasi Fiktif B'}])await c.root.collection('msaOrganizations').doc(organization.id).set({...organization,state:'active',programIds:['program-'+organization.id],events:[{id:'event-'+organization.id,programId:'program-'+organization.id}]});
  const response=await f.login(),{token}=await response.json();
  const request=(path,body,session=token,headers={})=>fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Origin:f.base,'Content-Type':'application/json',Authorization:'Bearer '+session,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const enroll=async({username='relawan-'+randomUUID().slice(0,8),state='active',verified=true,eligibleRoles=['pic','admin','volunteer','superadmin']}={})=>{
    const password=randomBytes(24).toString('base64url'),value={fictional:true,requestId:randomUUID(),username,fullName:'Relawan Fiktif '+username,password,phone:'081234567890'};
    const {uid}=await f.adminAuthentication.a1.accounts.provisionFixture(value);created.push(uid);
    // Explicit trusted fixture review. No production reviewer/approval endpoint.
    await c.root.collection('msaAccounts').doc(uid).update({state,identity:verified?{state:'verified',actorUid:f.uid,verifiedAt:Date.now(),method:'fictional-fixture'}:{state:'unverified'},eligibleRoles});
    return {uid,username,password,value};
  };
  const signIn=async user=>{const response=await request('/api/a1/login',{username:user.username,password:user.password},'');return {response,...await response.json()};};
  const change=(uid,options={},session=token)=>request('/api/a1/accounts/'+uid+'/change',{expectedRevision:1,requestId:randomUUID(),reason:'Penugasan fiktif untuk pengujian',role:'pic',scope:{organizationId:'org-a'},status:'active',...options},session);
  t.after(async()=>{const app=initializeApp({projectId:'demo-abc-attendance'},'msa-cleanup-'+randomUUID());try{if(created.length)await getAuth(app).deleteUsers(created);}finally{await deleteApp(app);await c.close();for(const [key,value] of [['ABC_MSA_A1',previous.flag],['ABC_MSA_USERNAME_PILOT',previous.pilot],['ABC_FIRESTORE_NAMESPACE',previous.namespace]])if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  return {...c,...f,token,request,enroll,signIn,change,created};
}
