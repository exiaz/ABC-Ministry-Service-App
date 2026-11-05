#!/usr/bin/env node
// Penjaga workflow bersama; bukan pengganti sandbox atau otorisasi aplikasi.
import {execFileSync} from 'node:child_process';
import {writeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,within,createWorkspaceLock,coordinationCommand} from './workspace-lock.mjs';

const agent=process.argv[2];
if(!['claude','codex'].includes(agent))process.exit(0);
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const root=canonical(workspace),parent=canonical(path.dirname(workspace));
const coordinator=createWorkspaceLock(workspace);
const git=(cwd,...args)=>{
  try{return execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,timeout:5000,stdio:['ignore','pipe','ignore']}).trim();}
  catch{return null;}
};
const emit=(event,extra)=>writeSync(1,JSON.stringify({hookSpecificOutput:{hookEventName:event,...extra}}));
let input;
try{
  let raw='';for await(const chunk of process.stdin)raw+=chunk;
  input=JSON.parse(raw.replace(/^\uFEFF/,''));
  if(!input||typeof input!=='object')throw Error();
}catch{writeSync(2,'[collab-guard] Payload hook tidak valid.');process.exit(2);}
const cwd=input.cwd||process.cwd(),top=git(cwd,'rev-parse','--show-toplevel');
const branch=top&&git(top,'branch','--show-current');
const problem=!top?'Root Git tidak dapat diverifikasi.':canonical(top)!==root?'Gunakan workspace aktif '+workspace:!branch?'Detached HEAD: pulihkan branch lewat pengguna.':null;
const event=input.hook_event_name;
const deny=reason=>emit('PreToolUse',{permissionDecision:'deny',permissionDecisionReason:'[collab-guard] '+reason});
if(input.hook_event_name==='SessionStart'){
  let context=problem;
  if(!problem){
    try{const {owner}=coordinator.start(agent,input.session_id);context='Workspace bersama: OK. Lock otomatis aktif; '+(owner?`penulis=${owner.agent} sesi ${owner.session}.`:'belum ada penulis.');}
    catch(error){context=error.message;}
  }
  emit('SessionStart',{additionalContext:`[collab-guard] agen=${agent} session_id=${input.session_id||'(tidak ada)'} workspace=${workspace} branch=${branch||'(tidak terverifikasi)'}\n${context}\nBaca AGENTS.md. Jika versi berubah, baca ulang lewat node "${path.join(workspace,'.agents/hooks/workspace-lock.mjs')}" read ${agent} ${input.session_id||'<session_id>'} <path...>.`});
  process.exit(0);
}
if(['PostToolUse','PostToolUseFailure','PermissionDenied'].includes(event)){
  try{
    if(!problem)coordinator.finish(agent,input.session_id,input.tool_use_id,event!=='PostToolUse'||input.tool_response?.isError===true||Number(input.tool_response?.exit_code??0)!==0);
    writeSync(1,'{}');
  }catch(error){writeSync(1,JSON.stringify({systemMessage:error.message}));}
  process.exit(0);
}
if(['Stop','SessionEnd','Interrupt'].includes(event)){
  try{
    const ended=problem||coordinator.end(agent,input.session_id);
    writeSync(1,JSON.stringify(!ended&&event==='Stop'?{decision:'block',reason:'Tool penulis belum selesai. Tunggu hasil/poll tool; lock tidak dilepas saat masih berjalan.'}:{}));
  }catch(error){writeSync(1,JSON.stringify(event==='Stop'?{decision:'block',reason:error.message}:{systemMessage:error.message}));}
  process.exit(0);
}
if(event!=='PreToolUse')process.exit(0);
const tool=input.tool_input||{};
const command=String(tool.command??tool.cmd??'');
if(['Bash','exec_command'].includes(input.tool_name)){
  if(/\bgit(?:\.exe)?(?:\s+-(?:C|c)\s+(?:"[^"]*"|'[^']*'|\S+))*\s+(?:commit|merge|push|reset|rebase|clean|stash|switch|checkout|worktree\s+(?:add|remove|move|prune)|branch\s+(?:-[dDmM]|--delete|--move))\b/i.test(command)){
    deny('Operasi Git ini mengubah branch, riwayat atau data. Jalankan hanya lewat pengguna setelah persetujuan eksplisit.');
    process.exit(0);
  }
  if(problem){deny(problem);process.exit(0);}
  if(coordinationCommand(command,cwd,workspace,agent,input.session_id))process.exit(0);
  try{coordinator.begin(agent,input.session_id,input.tool_use_id,null);}
  catch(error){deny(error.message);}
  process.exit(0);
}
if(['Read','Glob','Grep'].includes(input.tool_name))process.exit(0);
const targets=[];
for(const target of [tool.file_path,tool.notebook_path,tool.filePath,tool.path,...(Array.isArray(tool.paths)?tool.paths:[])])if(typeof target==='string')targets.push(target);
for(const value of Object.values(tool)){
  if(typeof value!=='string')continue;
  for(const match of value.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+?)\s*$/gm))targets.push(match[1]);
}
const reminders=new Set();
for(const target of targets){
  const abs=canonical(path.resolve(cwd,target));
  if(!within(abs,root)){
    if(within(abs,parent)){deny('Folder sumber historis atau workspace lain tidak boleh ditulis: '+target);process.exit(0);}
    continue;
  }
  if(problem){deny(problem);process.exit(0);}
  const rel=abs.slice(root.length+1);
  if(rel==='.git'||rel.startsWith('.git/')||rel==='.claude/worktrees'||rel.startsWith('.claude/worktrees/')||rel==='.agents/.runtime'||rel.startsWith('.agents/.runtime/')){
    deny('Jangan menulis metadata Git atau worktree bersarang.');process.exit(0);
  }
  const other=agent==='claude'?/^(backend\/|local-[^/]*\.mjs$|firestore\.rules$)|-server\.mjs$|\.cmd$/:/^(ui\/|msa-[^/]*\.css$|docs\/ui-overhaul\/)/;
  if(other.test(rel))reminders.add('Path lintas kepemilikan: pastikan termasuk penugasan pengguna.');
  if(/^(?:sw\.js|server\.mjs|PROJECT_STATUS\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|\.gitignore)$|^\.(?:agents|claude|codex)\//i.test(rel))reminders.add('Path bersama: pertahankan perubahan lokal dan lingkup integrasi yang diminta pengguna.');
}
const internalTargets=targets.map(target=>path.resolve(cwd,target)).filter(target=>within(canonical(target),root));
if(internalTargets.length){
  try{coordinator.begin(agent,input.session_id,input.tool_use_id,internalTargets);}
  catch(error){deny(error.message);process.exit(0);}
}
if(reminders.size)emit('PreToolUse',{additionalContext:'[collab-guard] '+[...reminders].join(' ')});
