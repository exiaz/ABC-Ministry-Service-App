import {repositoryMode} from './emulator-config.mjs';
import {createInMemoryCredentialRepository,createInMemoryRosterRepository} from './repositories.mjs';

export async function createConfiguredRepositories(){
  if(repositoryMode()==='in-memory')return {credentials:createInMemoryCredentialRepository(),repository:createInMemoryRosterRepository(),close:async()=>{}};
  const {createFirestoreEmulatorRepositories}=await import('./firestore-emulator.mjs');
  return createFirestoreEmulatorRepositories();
}
