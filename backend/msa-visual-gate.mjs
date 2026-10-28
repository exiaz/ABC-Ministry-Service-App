import {emulatorConfig} from './emulator-config.mjs';
import {adminAuthConfig} from './admin-auth.mjs';

// This gate is an isolated building block: it does not enable any route.
// Validate again on every use so a process cannot retain access after drift.
export function createVisualPilotGate(env=process.env){
  const denied=()=>Object.assign(Error('Visual Studio tidak tersedia.'),{status:404});
  function read(){
    try{
      if(env.ABC_MSA_VISUAL_V1A!=='1'||env.ABC_MSA_A1!=='1'||env.NODE_ENV==='production')throw Error();
      const store=emulatorConfig(env),auth=adminAuthConfig(env);
      if(!store.namespace.startsWith('test-'))throw Error();
      return JSON.stringify({store,auth});
    }catch{throw denied();}
  }
  const initial=read();
  return {enabled(){if(read()!==initial)throw denied();return true;}};
}
