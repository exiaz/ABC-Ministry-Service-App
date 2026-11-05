#!/usr/bin/env node
// Penjaga workflow bersama; bukan pengganti sandbox atau otorisasi aplikasi.
import {execFileSync} from 'node:child_process';
import {realpathSync,writeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const agent=process.argv[2];
if(!['claude','codex'].includes(agent))process.exit(0);
const workspace=fileURLToPath(new URL('../../',import.meta.url));
function canonical(value){
  let current=path.resolve(value),suffix=[];
  for(;;){
    try{current=path.join(realpathSync.native(current),...suffix);break;}
    catch{const parent=path.dirname(current);if(parent===current)break;suffix.unshift(path.basename(current));current=parent;}
  }
  const normalized=current.replace(/\\/g,'/').replace(/\/$/,'');
  return process.platform==='win32'?normalized.toLowerCase():normalized;
}
const root=canonical(workspace),parent=canonical(path.dirname(workspace));
const within=(file,dir)=>file===dir||file.startsWith(dir+'/');
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
if(input.hook_event_name==='SessionStart'){
  emit('SessionStart',{additionalContext:`[collab-guard] agen=${agent} workspace=${workspace} branch=${branch||'(tidak terverifikasi)'}\n${problem||'Workspace bersama: OK. Satu penulis aktif; baca git status dan AGENTS.md sebelum menulis.'}`});
  process.exit(0);
}
if(input.hook_event_name!=='PreToolUse')process.exit(0);
const deny=reason=>emit('PreToolUse',{permissionDecision:'deny',permissionDecisionReason:'[collab-guard] '+reason});
const tool=input.tool_input||{};
const command=String(tool.command??tool.cmd??'');
if(['Bash','exec_command'].includes(input.tool_name)){
  if(/\bgit(?:\.exe)?(?:\s+-(?:C|c)\s+(?:"[^"]*"|'[^']*'|\S+))*\s+(?:commit|merge|push|reset|rebase|clean|stash|switch|checkout|worktree\s+(?:add|remove|move|prune)|branch\s+(?:-[dDmM]|--delete|--move))\b/i.test(command)){
    deny('Operasi Git ini mengubah branch, riwayat atau data. Jalankan hanya lewat pengguna setelah persetujuan eksplisit.');
  }
  process.exit(0);
}
const targets=[];
if(tool.file_path||tool.notebook_path)targets.push(tool.file_path||tool.notebook_path);
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
  if(rel==='.git'||rel.startsWith('.git/')||rel==='.claude/worktrees'||rel.startsWith('.claude/worktrees/')){
    deny('Jangan menulis metadata Git atau worktree bersarang.');process.exit(0);
  }
  const other=agent==='claude'?/^(backend\/|local-[^/]*\.mjs$|firestore\.rules$)|-server\.mjs$|\.cmd$/:/^(ui\/|msa-[^/]*\.css$|docs\/ui-overhaul\/)/;
  if(other.test(rel))reminders.add('Path lintas kepemilikan: pastikan termasuk penugasan pengguna.');
  if(/^(?:sw\.js|server\.mjs|PROJECT_STATUS\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|\.gitignore)$|^\.(?:agents|claude|codex)\//i.test(rel))reminders.add('Path bersama: pertahankan perubahan lokal dan lingkup integrasi yang diminta pengguna.');
}
if(reminders.size)emit('PreToolUse',{additionalContext:'[collab-guard] '+[...reminders].join(' ')});
