import {randomUUID} from 'node:crypto';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';

// Seed only explicitly supplied fictional fixtures, never browser/localStorage.
// Each test uses a unique namespace; teardown deletes only that namespace.
export async function emulatorFixture({now,source}={}){
  const previous=process.env.ABC_FIRESTORE_NAMESPACE;
  process.env.ABC_FIRESTORE_NAMESPACE='test-'+randomUUID();
  let context;
  try{context=await createFirestoreEmulatorRepositories({now});}
  finally{if(previous===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=previous;}
  if(source){
    const batch=context.db.batch();
    for(const name of ['schools','groups','students','serviceSessions','sessions','mentors','defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots']){
      for(const record of source[name]??[])batch.create(context.root.collection(name).doc(record.id),structuredClone(record));
    }
    for(const [id,profile] of Object.entries(source.studentPrivateProfiles??{}))batch.create(context.root.collection('studentPrivateProfiles').doc(id),profile);
    await batch.commit();
  }
  const close=context.close;
  context.close=async()=>{try{await context.db.recursiveDelete(context.root);}finally{await close();}};
  return context;
}
