import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createAdminServer} from '../../admin-server.mjs';
export async function adminLoginFixture(t,{pairing,repository,mentorAccounts}={}){
  const previous=process.env.ABC_ADMIN_UIDS,uid='fictional-login-'+randomUUID(),otherUid='fictional-denied-'+randomUUID();process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  const app=initializeApp({projectId:'demo-abc-attendance'},'admin-login-'+randomUUID()),auth=getAuth(app),password=randomBytes(32).toString('base64url'),email=uid+'@example.invalid',otherEmail=otherUid+'@example.invalid';
  await auth.createUser({uid,email,password});await auth.createUser({uid:otherUid,email:otherEmail,password});
  const adminAuthentication=await createLocalAdminAuthentication({repository,mentorAccounts}),server=createAdminServer({adminAuthentication,pairing});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await adminAuthentication.close();await auth.deleteUsers([uid,otherUid]);await deleteApp(app);if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;});
  const login=(values={email,password})=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(values)});
  const request=(token,path='/api/admin/session',method='GET')=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,Origin:base,'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
  return {uid,otherUid,email,otherEmail,password,auth,adminAuthentication,server,base,login,request};
}
