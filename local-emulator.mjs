// A live child and its private IPC channel establish ownership. No PID files,
// port-based termination, taskkill, or second/force signal on retry.
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openSync,closeSync} from 'node:fs';

const PRELOAD=pathToFileURL(fileURLToPath(import.meta.url)).href,owned=new WeakSet();
export function spawnManagedEmulator(args,{logFile,...options}={}){
  const descriptor=logFile?openSync(logFile,'wx'):null;
  let child;
  try{child=spawn(process.execPath,['--import',PRELOAD,...args],{...options,detached:true,windowsHide:true,stdio:['ignore',descriptor??'ignore',descriptor??'ignore','ipc']});}
  finally{if(descriptor!==null)closeSync(descriptor);}
  owned.add(child);child.on('error',()=>{});return child;
}
export async function stopManagedEmulator(child,{timeout=30000}={}){
  if(!child||child.exitCode!==null||child.signalCode!==null||!child.pid)return;
  if(!owned.has(child)||!child.connected)throw Error('Penghentian emulator tidak terkonfirmasi. Layanan tetap hidup; periksa jendela peluncur.');
  await new Promise((resolve,reject)=>{
    const done=error=>{clearTimeout(timer);child.off('exit',onExit);error?reject(error):resolve();};
    const onExit=(code,signal)=>done(code===0&&!signal?null:Error('Emulator berakhir tidak normal. Snapshot terverifikasi tetap tersedia; periksa log sebelum memulai ulang.'));
    const timer=setTimeout(()=>done(Error('Emulator belum selesai berhenti. Snapshot tetap disimpan; coba Stop lagi.')),timeout);
    child.once('exit',onExit);
    child.send({command:'shutdown'},error=>{if(error&&child.exitCode===null&&child.signalCode===null)done(Error('Kanal penghentian emulator terputus. Coba Stop lagi.'));});
  });
}

// Runs only when explicitly preloaded into the owned child. Firebase CLI's own
// first SIGINT handler performs its export and graceful registry shutdown.
if(process.send&&process.execArgv.includes(PRELOAD)){
  let requested=false;
  const shutdown=()=>{
    if(requested)return;requested=true;
    const timer=setInterval(()=>{
      // Firebase ignores signals within 100 ms of handler installation.
      if(process.listenerCount('SIGINT')){clearInterval(timer);setTimeout(()=>process.emit('SIGINT'),150);}
    },100);
    timer.unref();
  };
  process.on('message',message=>{if(message?.command==='shutdown')shutdown();});
  process.once('disconnect',shutdown);
}
