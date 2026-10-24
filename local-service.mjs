// Local lifecycle coordination only; never an HTTP authentication/provisioning API.
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
export function servicePath(port,root=ROOT){
  const name='abc-service-'+digest(path.resolve(root).toLowerCase()).slice(0,24)+'-'+port;
  return process.platform==='win32'?'\\\\.\\pipe\\'+name:path.join(os.tmpdir(),name+'.sock');
}
export async function serviceSignature(env=process.env,root=ROOT){
  const keys=['ABC_ROSTER_ADAPTER','ABC_ADMIN_AUTH_MODE','ABC_FIREBASE_PROJECT_ID','GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','ABC_FIRESTORE_NAMESPACE','ABC_ADMIN_UIDS','ABC_MENTOR_ORIGIN','ABC_API_ORIGIN','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','NODE_ENV'];
  keys.push('ABC_MSA_A1','ABC_MSA_USERNAME_PILOT','ABC_MSA_A2_2');
  const config=Object.fromEntries(keys.map(key=>[key,env[key]??null]));
  try{config.ABC_ADMIN_UIDS=JSON.stringify(JSON.parse(config.ABC_ADMIN_UIDS).sort());}catch{}
  // Include source bytes so a process started before a code change is never reused.
  const files=[];
  async function scan(folder){for(const item of await readdir(folder,{withFileTypes:true})){
    const target=path.join(folder,item.name);
    if(item.isDirectory()&&folder===root&&item.name==='backend')await scan(target);
    else if(item.isFile()&&/\.(m?js|html|css)$/.test(item.name))files.push(target);
  }}
  await scan(root);files.sort();
  const source=createHash('sha256');for(const file of files){source.update(path.relative(root,file));source.update(await readFile(file));}
  return digest(JSON.stringify({config,source:source.digest('hex')}));
}
export function serviceRequest(address,message){
  return new Promise(resolve=>{
    const socket=net.createConnection(address);let raw='',done=false;
    const finish=value=>{if(done)return;done=true;socket.destroy();resolve(value);};
    socket.setTimeout(1800,()=>finish(null));socket.on('error',()=>finish(null));
    socket.once('connect',()=>socket.write(JSON.stringify(message)+'\n'));
    socket.on('data',chunk=>{raw+=chunk;if(raw.length>4096)return finish(null);if(raw.includes('\n')){try{finish(JSON.parse(raw.trim()));}catch{finish(null);}}});
    socket.on('end',()=>finish(null));
  });
}
export async function registerLocalService(server,{role,stop,env=process.env,root=ROOT}={}){
  const address=server.address();
  if(address?.address!=='127.0.0.1')throw Error('Lifecycle lokal memerlukan listener loopback.');
  const port=address.port,instance=randomUUID(),signature=await serviceSignature(env,root);
  let phase='ready';
  const mark=(req,res)=>res.setHeader('X-ABC-Local-Instance',instance);
  server.prependListener('request',mark);
  const controller=net.createServer(socket=>{
    let raw='';socket.setTimeout(2000,()=>socket.destroy());socket.on('error',()=>{});
    socket.on('data',chunk=>{
      raw+=chunk;if(raw.length>512){socket.destroy();return;}if(!raw.includes('\n'))return;
      let request;try{request=JSON.parse(raw.trim());}catch{socket.destroy();return;}
      if(request.command==='stop'&&request.instance===instance&&phase==='ready'){
        phase='stopping';socket.end(JSON.stringify({instance,phase})+'\n');
        // Acknowledgement is sent before draining requests; stop closes this pipe.
        setImmediate(()=>Promise.resolve(stop()).catch(()=>{phase='stop-error';}));return;
      }
      if(request.command!=='status'){socket.end('{}\n');return;}
      socket.end(JSON.stringify({protocol:1,role,port,instance,signature,phase,pid:process.pid})+'\n');
    });
  });
  try{await new Promise((resolve,reject)=>{controller.once('error',reject);controller.listen(servicePath(port,root),resolve);});}
  catch(error){server.removeListener('request',mark);throw error;}
  return {close:()=>new Promise(resolve=>controller.close(resolve))};
}
const probes={api:['/api/admin/session',401,'test-foundation'],admin:['/',200,'authenticated-admin-emulator'],mentor:['/',200,'paired-local-fictional-roster']};
export async function inspectLocalService(port,role,{env=process.env,root=ROOT}={}){
  const address=servicePath(port,root),status=await serviceRequest(address,{command:'status'});
  if(status?.protocol!==1||status.port!==port||status.role!==role||!/^[a-f0-9-]{36}$/.test(status.instance??''))return {kind:'unknown',port};
  let healthy=false;
  try{
    const [route,code,mode]=probes[role];
    const response=await fetch('http://127.0.0.1:'+port+route,{redirect:'error',signal:AbortSignal.timeout(2000)});
    healthy=response.status===code&&response.headers.get('x-abc-mode')===mode&&response.headers.get('x-abc-local-instance')===status.instance;
    await response.body?.cancel();
    if(healthy&&role==='admin'){
      const protectedResponse=await fetch('http://127.0.0.1:'+port+'/api/admin/session',{redirect:'error',signal:AbortSignal.timeout(2000)});
      healthy=protectedResponse.status===401&&protectedResponse.headers.get('x-abc-local-instance')===status.instance;
      await protectedResponse.body?.cancel();
    }
  }catch{}
  // A pipe response alone cannot attest to ownership of the HTTP listener.
  if(!healthy)return {kind:'unknown',port};
  const compatible=status.phase==='ready'&&status.signature===await serviceSignature(env,root);
  return {kind:compatible?'compatible':'incompatible',port,status,address};
}
export async function stopLocalService(service,{timeout=15000}={}){
  const current=await serviceRequest(service.address,{command:'status'});
  if(!current){
    const occupied=await new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:service.port});socket.setTimeout(1000,()=>{socket.destroy();resolve(true);});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',error=>resolve(error.code!=='ECONNREFUSED'));});
    if(!occupied)return; // Already drained; safe to retry snapshot shutdown.
    throw Error('Port telah berganti pemilik; proses pengganti tidak disentuh.');
  }
  if(current.instance!==service.status.instance)throw Error('Identitas layanan berubah.');
  const response=await serviceRequest(service.address,{command:'stop',instance:service.status.instance});
  if(response?.instance!==service.status.instance||response.phase!=='stopping')throw Error('Penghentian layanan lokal tidak terkonfirmasi.');
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const current=await serviceRequest(service.address,{command:'status'});
    if(!current)return;
    if(current.instance!==service.status.instance||current.phase==='stop-error')break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Layanan lokal belum berhenti. Data belum boleh diekspor.');
}
