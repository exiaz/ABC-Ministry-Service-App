import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';

// Structural fixture only, never supplied to a real emulator import.
export async function fakeSnapshot(target){
  await mkdir(path.join(target,'auth_export'),{recursive:true});
  await mkdir(path.join(target,'firestore_export'),{recursive:true});
  await writeFile(path.join(target,'auth_export/accounts.json'),JSON.stringify({users:[]}));
  await writeFile(path.join(target,'auth_export/config.json'),'{}');
  await writeFile(path.join(target,'firestore_export/firestore_export.overall_export_metadata'),'fictional-structural-fixture');
  await writeFile(path.join(target,'firebase-export-metadata.json'),JSON.stringify({auth:{path:'auth_export'},firestore:{path:'firestore_export',metadata_file:'firestore_export/firestore_export.overall_export_metadata'}}));
}
