import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,renameSync,rmdirSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const digest=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){
  let current=path.resolve(value),suffix=[];
  for(;;){
    try{current=path.join(realpathSync.native(current),...suffix);break;}
    catch{const parent=path.dirname(current);if(parent===current)break;suffix.unshift(path.basename(current));current=parent;}
  }
  const normalized=current.replace(/\\/g,'/').replace(/\/$/,'');
  return process.platform==='win32'?normalized.toLowerCase():normalized;
}
export const within=(file,dir)=>file===dir||file.startsWith(dir+'/');
const fail=message=>{throw Error('[workspace-lock] '+message);};
const identity=(agent,session)=>{
  if(!['claude','codex'].includes(agent)||typeof session!=='string'||!session||session.length>512)fail('session_id/agen tidak valid. Mulai ulang sesi dengan hook aktif.');
  return digest(agent+'\0'+session);
};

export function createWorkspaceLock(workspace){
  const root=canonical(workspace),runtime=path.join(root,'.agents','.runtime'),mutex=path.join(runtime,'mutex'),recovery=path.join(runtime,'recovery'),stateFile=path.join(runtime,'state.json');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']}).trimEnd();
  function safeState(){
    if(canonical(runtime)!==runtime.replace(/\\/g,'/'))fail('Lokasi state berubah melalui symlink/junction.');
    if(existsSync(stateFile)&&lstatSync(stateFile).isSymbolicLink())fail('State tidak boleh berupa symlink.');
  }
  function load(){
    if(!existsSync(stateFile))return {version:1,sessions:{},writer:null};
    const state=JSON.parse(readFileSync(stateFile,'utf8'));
    if(state.version!==1||!state.sessions||typeof state.sessions!=='object'||Array.isArray(state.sessions)||!Object.hasOwn(state,'writer'))fail('State rusak/tidak kompatibel; hentikan agent dan tinjau pemulihan.');
    return state;
  }
  function transaction(run){
    safeState();mkdirSync(runtime,{recursive:true});safeState();
    if(existsSync(recovery))fail('Operator sedang memulihkan mutex; tunggu sampai selesai.');
    let acquired=false;
    for(let attempt=0;attempt<30;attempt++){
      try{mkdirSync(mutex);acquired=true;break;}
      catch(error){if(error.code!=='EEXIST')throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);}
    }
    if(!acquired)fail('State sedang dipakai atau mutex tertinggal. Coba lagi; jangan hapus mutex saat agent aktif.');
    let temp;
    try{
      if(existsSync(recovery))fail('Operator sedang memulihkan mutex; coba lagi.');
      writeFileSync(path.join(mutex,'owner.json'),JSON.stringify({pid:process.pid,token:randomUUID()}),{flag:'wx',mode:0o600});
      const state=load(),result=run(state);
      temp=path.join(runtime,randomUUID()+'.tmp');
      writeFileSync(temp,JSON.stringify(state),{flag:'wx',mode:0o600});renameSync(temp,stateFile);temp=null;
      return result;
    }finally{
      if(temp&&existsSync(temp))unlinkSync(temp);
      if(existsSync(path.join(mutex,'owner.json')))unlinkSync(path.join(mutex,'owner.json'));
      rmdirSync(mutex);
    }
  }
  function relative(file){
    const abs=canonical(path.resolve(root,file));
    if(!within(abs,root)||abs===root)fail('Path di luar workspace: '+file);
    const rel=abs.slice(root.length+1);
    if(rel==='.git'||rel.startsWith('.git/')||rel==='.agents/.runtime'||rel.startsWith('.agents/.runtime/')||rel.startsWith('.claude/worktrees/'))fail('Path metadata/state tidak boleh ditulis atau dibaca lewat helper: '+file);
    return rel;
  }
  const hash=file=>{
    const rel=relative(file),abs=path.join(root,rel);
    if(!existsSync(abs))return null;
    if(!lstatSync(abs).isFile())fail('Bukan berkas biasa: '+file);
    return digest(readFileSync(abs));
  };
  function snapshot(){
    const files={};
    const names=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
    for(const name of new Set(names))files[relative(name)]=hash(name);
    return {files,git:digest(git('rev-parse','HEAD')+'\0'+git('ls-files','--stage','-z'))};
  }
  const sessionOf=(state,key)=>{const session=state.sessions[key];if(!session)fail('Sesi belum terdaftar. Jalankan SessionStart atau helper read sebelum menulis.');return session;};
  const busy=writer=>`Workspace dimiliki ${writer.agent} sesi ${writer.session}; tunggu Stop/serah terima. Token pemulihan: ${writer.token}`;
  return {
    root,
    start(agent,sessionId){
      const key=identity(agent,sessionId);
      return transaction(state=>{
        if(!state.sessions[key])state.sessions[key]={...snapshot(),agent,session:sessionId};
        return {owner:state.writer,session:sessionId};
      });
    },
    begin(agent,sessionId,toolId,paths){
      const key=identity(agent,sessionId);
      if(typeof toolId!=='string'||!toolId||toolId.length>512)fail('tool_use_id diperlukan sebelum penulisan.');
      const targets=paths===null?null:[...new Set(paths.map(relative))];
      return transaction(state=>{
        const session=sessionOf(state,key);
        if(state.writer&&state.writer.key!==key)fail(busy(state.writer));
        if(state.writer?.operation)fail('Tool penulis sebelumnya belum selesai; tunggu PostToolUse sebelum melanjutkan.');
        if(state.writer?.closing)fail('Sesi sedang ditutup; tunggu penyelesaian tool.');
        const current=snapshot();
        if(current.git!==session.git)fail('HEAD/index Git berubah. Baca ulang seluruh perubahan dan gunakan sesi baru; jangan mengubah branch dari konteks lama.');
        const names=targets??[...new Set([...Object.keys(session.files),...Object.keys(current.files)])];
        const changed=names.filter(file=>(session.files[file]??null)!==(targets===null?current.files[file]??null:hash(file)));
        if(changed.length)fail('Versi berubah sejak diamati: '+changed.slice(0,12).join(', ')+'. Gunakan helper read untuk membaca ulang sebelum mengedit.');
        if(!state.writer)state.writer={key,agent,session:sessionId,token:randomUUID(),since:new Date().toISOString()};
        state.writer.operation={id:toolId,paths:targets};
        return {token:state.writer.token};
      });
    },
    finish(agent,sessionId,toolId,failed=false){
      const key=identity(agent,sessionId);
      return transaction(state=>{
        const writer=state.writer;
        if(!writer||writer.key!==key||writer.operation?.id!==toolId)return false;
        const session=sessionOf(state,key),current=snapshot();
        if(!failed){
          if(writer.operation.paths===null)session.files=current.files;
          else for(const file of writer.operation.paths)session.files[file]=hash(file);
          session.git=current.git;
        }
        delete writer.operation;
        if(writer.closing)state.writer=null;
        return true;
      });
    },
    end(agent,sessionId){
      const key=identity(agent,sessionId);
      return transaction(state=>{
        if(state.writer?.key!==key)return true;
        if(state.writer.operation){state.writer.closing=true;return false;}
        state.writer=null;return true;
      });
    },
    read(agent,sessionId,paths){
      const key=identity(agent,sessionId),targets=[...new Set(paths.map(relative))];
      if(!targets.length)fail('Sebutkan berkas yang perlu dibaca ulang.');
      return transaction(state=>{
        if(state.writer&&(state.writer.key!==key||state.writer.operation))fail(busy(state.writer));
        const session=state.sessions[key]??={agent,session:sessionId,files:{},git:snapshot().git};
        const result=[];
        for(const file of targets){
          const bytes=existsSync(path.join(root,file))?readFileSync(path.join(root,file)):null;
          if(bytes&&bytes.includes(0))fail('Helper read hanya untuk teks; berkas biner memerlukan sesi baru setelah diperiksa.');
          if(bytes&&bytes.length>1024*1024)fail('Helper read dibatasi 1 MiB per berkas.');
          session.files[file]=bytes?digest(bytes):null;
          result.push({path:file,sha256:session.files[file],content:bytes?.toString('utf8')??null});
        }
        return result;
      });
    },
    status(){
      safeState();let mutexOwner=null;
      try{mutexOwner=JSON.parse(readFileSync(path.join(mutex,'owner.json'),'utf8'));}catch{}
      return {owner:load().writer,mutex:existsSync(mutex),mutexOwner,recovery:existsSync(recovery)};
    },
    recover(expectedToken,confirmed){
      if(!confirmed||typeof expectedToken!=='string')fail('Pemulihan hanya oleh operator setelah sesi/tool pemilik benar-benar dihentikan.');
      return transaction(state=>{
        if(!state.writer||state.writer.token!==expectedToken)fail('Token pemilik berubah; pemulihan ditolak.');
        state.writer=null;
      });
    },
    recoverMutex(expectedToken,confirmed){
      if(!confirmed)fail('Pemulihan mutex hanya oleh operator setelah agent dihentikan.');
      safeState();mkdirSync(runtime,{recursive:true});mkdirSync(recovery);
      try{
        const owner=JSON.parse(readFileSync(path.join(mutex,'owner.json'),'utf8'));
        if(owner.token!==expectedToken||!Number.isSafeInteger(owner.pid)||owner.pid<=0)fail('Token/PID mutex tidak cocok.');
        let dead=false;
        try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')dead=true;else throw error;}
        if(!dead)fail('Proses pemilik mutex masih hidup atau PID dipakai ulang; tidak diambil alih.');
        renameSync(mutex,path.join(runtime,'abandoned-mutex-'+randomUUID()));
      }finally{rmdirSync(recovery);}
    }
  };
}

export function coordinationCommand(command,cwd,workspace,agent,session){
  if(/[\r\n;&|<>`$()]/.test(command))return false;
  const tokens=[...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s"']+)/g)].map(m=>m[1]??m[2]??m[3]);
  if(!/^node(?:\.exe)?$/i.test(tokens[0]??'')||!tokens[1]||canonical(path.resolve(cwd,tokens[1]))!==canonical(path.join(workspace,'.agents/hooks/workspace-lock.mjs')))return false;
  return tokens[2]==='status'&&tokens.length===3||tokens[2]==='read'&&tokens[3]===agent&&tokens[4]===session&&tokens.length>5;
}

const main=fileURLToPath(import.meta.url);
if(process.argv[1]&&canonical(process.argv[1])===canonical(main)){
  try{
    const coordinator=createWorkspaceLock(fileURLToPath(new URL('../../',import.meta.url)));
    const [action,agent,session,...files]=process.argv.slice(2);
    let result;
    if(action==='status')result={mode:'legacy',notice:'State lock lama tidak dipakai hook bersama. Periksa koordinasi aktif: node .agents/hooks/coord.mjs status',...coordinator.status()};
    else if(action==='read')result=coordinator.read(agent,session,files.map(file=>path.resolve(process.cwd(),file)));
    else if(action==='recover')result=coordinator.recover(agent,session==='--confirmed-session-ended');
    else if(action==='recover-mutex')result=coordinator.recoverMutex(agent,session==='--confirmed-session-ended');
    else fail('Gunakan status, read <agent> <session_id> <path...>, recover <token> --confirmed-session-ended, atau recover-mutex <token> --confirmed-session-ended (pemulihan hanya operator).');
    process.stdout.write(JSON.stringify(result??{recovered:true},null,2)+'\n');
  }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
