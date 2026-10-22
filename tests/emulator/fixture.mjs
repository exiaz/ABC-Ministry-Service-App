import {randomUUID} from 'node:crypto';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';

export function fixtureRecords(source){
  const records=[];
  for(const name of ['schools','groups','students','serviceSessions','sessions','mentors','defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots']){
    for(const record of source[name]??[])records.push({collection:name,id:record.id,data:structuredClone(record)});
  }
  for(const [id,profile] of Object.entries(source.studentPrivateProfiles??{}))records.push({collection:'studentPrivateProfiles',id,data:structuredClone(profile)});
  return records;
}

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
    for(const record of fixtureRecords(source))batch.create(context.root.collection(record.collection).doc(record.id),record.data);
    await batch.commit();
  }
  const close=context.close;
  context.close=async()=>{try{await context.db.recursiveDelete(context.root);}finally{await close();}};
  return context;
}
