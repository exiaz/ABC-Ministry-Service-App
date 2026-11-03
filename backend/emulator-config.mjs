export const DEMO_PROJECT_ID='demo-abc-attendance';

export function repositoryMode(env=process.env){
  const mode=env.ABC_ROSTER_ADAPTER??'in-memory';
  if(!['in-memory','firestore-emulator'].includes(mode))throw Error('Mode repository tidak valid.');
  return mode;
}

// Deliberately narrower than Firebase's SDK: no URLs, DNS, remote IPs, ADC keys,
// real projects or implicit default host. Validate before importing the SDK.
export function emulatorConfig(env=process.env){
  if(repositoryMode(env)!=='firestore-emulator'||env.ABC_FIREBASE_PROJECT_ID!==DEMO_PROJECT_ID)throw Error('Mode emulator dan project demo wajib diatur secara eksplisit.');
  const match=/^127\.0\.0\.1:([1-9]\d{0,4})$/.exec(env.FIRESTORE_EMULATOR_HOST??'');
  if(!match||Number(match[1])>65535)throw Error('Firestore Emulator wajib memakai 127.0.0.1 dan port lokal yang valid.');
  if(env.GOOGLE_APPLICATION_CREDENTIALS||env.FIREBASE_TOKEN)throw Error('Kredensial cloud tidak diizinkan dalam mode emulator.');
  for(const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT']){
    if(env[key]&&env[key]!==DEMO_PROJECT_ID)throw Error('Konfigurasi project bertentangan dengan project demo.');
  }
  const namespace=env.ABC_FIRESTORE_NAMESPACE??'development';
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(namespace))throw Error('Namespace emulator tidak valid.');
  return Object.freeze({projectId:DEMO_PROJECT_ID,host:env.FIRESTORE_EMULATOR_HOST,port:Number(match[1]),namespace});
}
