import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {createMsaRecovery} from '../../backend/msa-recovery.mjs';
process.once('message',async({mode,value})=>{
  let c,app;
  try{
    c=await createFirestoreEmulatorRepositories();app=initializeApp({projectId:c.config.projectId},'fictional-recovery-worker');const provider=getAuth(app);
    const auth={getUser:uid=>provider.getUser(uid),revokeRefreshTokens:uid=>provider.revokeRefreshTokens(uid),updateUser:async(...args)=>{const result=await provider.updateUser(...args);if(mode==='crash-after-provider'){process.send({phase:'provider-updated'});await new Promise(()=>{});}return result;}};
    const recovery=createMsaRecovery({...c,auth,assertEnabled:()=>c.mentorAccounts.enabled()});await recovery.reset(value);process.send({status:200});
  }catch(e){process.send({status:e.status??500});}
  finally{await c?.close();if(app)await deleteApp(app);process.disconnect();}
});
