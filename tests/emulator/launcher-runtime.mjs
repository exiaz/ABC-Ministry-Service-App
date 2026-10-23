import {demoEnvironment,verifyHub,saveSnapshot} from '../../local-demo.mjs';

export function launcherEnvironment(base=process.env){
  return {...demoEnvironment(base),FIRESTORE_EMULATOR_HOST:base.FIRESTORE_EMULATOR_HOST??'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:base.FIREBASE_AUTH_EMULATOR_HOST??'127.0.0.1:9099'};
}
export function launcherRuntime(){
  const ports=process.env.ABC_STAGE3_TEST_PORTS?JSON.parse(process.env.ABC_STAGE3_TEST_PORTS):[8080,9099,4400,4500,9150];
  const checkHub=()=>verifyHub({ports});
  const request=async(url,options={})=>{
    const response=await fetch(url.replace('http://127.0.0.1:4400','http://127.0.0.1:'+ports[2]),{...options,signal:AbortSignal.timeout(options.timeout??3000)});
    if(!response.ok)throw Error('Emulator tes belum siap.');return response.json();
  };
  return {emulatorPorts:ports,checkHub,persist:state=>saveSnapshot(state,{verify:checkHub,request})};
}
