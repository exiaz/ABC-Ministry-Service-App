import {createPrototypeServer} from './server.mjs';
import {registerLocalService} from './local-service.mjs';
const port=Number(process.env.ABC_MENTOR_PORT||4176);
if(!Number.isSafeInteger(port)||port<1||port>65535||port===4173||port===Number(new URL(process.env.ABC_API_ORIGIN||'http://127.0.0.1:4175').port))throw Error('Port mentor lokal harus valid dan terpisah dari API/demo.');
const server=createPrototypeServer({mentorMode:true,apiOrigin:process.env.ABC_API_ORIGIN||'http://127.0.0.1:4175'});
let lifecycle;
try{
  const stop=async()=>{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await lifecycle?.close();};
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  lifecycle=await registerLocalService(server,{role:'mentor',stop});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  console.log(`Mentor pairing lokal: http://127.0.0.1:${port}`);
}catch{server.close();console.error('Mentor tidak dimulai: port atau lifecycle lokal tidak tersedia.');process.exitCode=1;}
