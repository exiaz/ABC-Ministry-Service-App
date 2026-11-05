import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createWorkspaceLock,coordinationCommand} from '../.agents/hooks/workspace-lock.mjs';
import {agentWorkspace} from './fixtures/agent-workspace.mjs';

function setup(t){const fixture=agentWorkspace(t);return {...fixture,lock:createWorkspaceLock(fixture.root)};}
function hook(f,agent,payload){
  const result=spawnSync(process.execPath,[f.hook,agent],{input:JSON.stringify({cwd:f.root,...payload}),encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,0,result.stderr);return result.stdout?JSON.parse(result.stdout):{};
}
const pre=(session_id,tool_use_id,tool_input={file_path:'example.txt'})=>({hook_event_name:'PreToolUse',session_id,tool_use_id,tool_name:'Write',tool_input});

test('Current status ignores legacy locks and never creates or rewrites coordination state',t=>{
  const f=setup(t),dir=path.join(f.root,'.git/msa-coord');
  f.lock.start('claude','legacy');f.lock.begin('claude','legacy','unfinished-shell',null);
  const legacyFile=path.join(f.root,'.agents/.runtime/state.json'),legacy=readFileSync(legacyFile,'utf8');
  const status=()=>{
    const result=spawnSync(process.execPath,[path.join(f.root,'.agents/hooks/coord.mjs'),'status'],{cwd:path.join(f.root,'backend'),encoding:'utf8',windowsHide:true,timeout:5000});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  const empty=status();assert.equal(empty.mode,'task-scoped');assert.deepEqual(empty.tasks,[]);
  assert.equal(existsSync(dir),false);
  assert.notEqual(hook(f,'codex',pre('current','write')).hookSpecificOutput?.permissionDecision,'deny');
  const stateFile=path.join(dir,'state.json'),state=JSON.parse(readFileSync(stateFile,'utf8'));
  for(const task of Object.values(state.tasks)){task.leaseUntil=0;task.pid=2**22-1;}
  writeFileSync(stateFile,JSON.stringify(state));
  const before=readFileSync(stateFile,'utf8'),audit=readFileSync(path.join(dir,'audit.log'),'utf8');
  mkdirSync(path.join(dir,'mutex'));writeFileSync(path.join(dir,'mutex/owner'),String(process.pid));
  const current=status();assert.equal(current.tasks.length,1);assert.equal(current.tasks[0].agent,'codex');
  assert.equal(current.statePath,stateFile);assert.equal(current.mutex,true);
  assert.equal(readFileSync(stateFile,'utf8'),before);assert.equal(readFileSync(path.join(dir,'audit.log'),'utf8'),audit);
  assert.equal(readFileSync(legacyFile,'utf8'),legacy);
});

test('Legacy status explicitly directs callers to the current coordination status',t=>{
  const f=setup(t);f.lock.start('claude','legacy');f.lock.begin('claude','legacy','unfinished-shell',null);
  const result=spawnSync(process.execPath,[path.join(f.root,'.agents/hooks/workspace-lock.mjs'),'status'],{cwd:f.root,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  const status=JSON.parse(result.stdout);assert.equal(status.mode,'legacy');
  assert.match(status.notice,/coord\.mjs status/);assert.equal(status.owner.session,'legacy');
});

test('Workspace ownership is per session, survives tools, and rejects stale edits after handoff',t=>{
  const f=setup(t),{lock}=f;
  lock.start('claude','a');lock.start('codex','b');lock.start('claude','other-claude');
  lock.begin('claude','a','write',['example.txt']);writeFileSync(path.join(f.root,'example.txt'),'from Claude\n');lock.finish('claude','a','write');
  assert.throws(()=>lock.begin('codex','b','blocked',['example.txt']),/Workspace dimiliki/);
  assert.throws(()=>lock.begin('claude','other-claude','blocked',['example.txt']),/Workspace dimiliki/);
  assert.equal(lock.end('codex','b'),true);assert.equal(lock.status().owner.session,'a');
  assert.equal(lock.end('claude','a'),true);
  lock.start('codex','b'); // resume must preserve the earlier observation
  assert.throws(()=>lock.begin('codex','b','stale',['example.txt']),/Versi berubah/);
  assert.equal(lock.read('codex','b',['example.txt'])[0].content,'from Claude\n');
  lock.begin('codex','b','fresh',['example.txt']);lock.finish('codex','b','fresh');lock.end('codex','b');
  assert.equal(lock.status().owner,null);
});

test('Shell operations are serialized and stale creates, deletes and Git changes fail closed',t=>{
  const f=setup(t),{lock}=f;lock.start('codex','a');lock.start('claude','b');
  lock.begin('codex','a','shell',null);
  assert.throws(()=>lock.begin('codex','a','parallel',null),/belum selesai/);
  assert.throws(()=>lock.begin('claude','b','parallel',null),/Workspace dimiliki/);
  writeFileSync(path.join(f.root,'new.txt'),'new');lock.finish('codex','a','shell');lock.end('codex','a');
  assert.throws(()=>lock.begin('claude','b','stale-create',['new.txt']),/Versi berubah/);
  lock.read('claude','b',['new.txt']);lock.begin('claude','b','delete',['new.txt']);
  lock.finish('claude','b','delete',true);lock.end('claude','b');
  f.git('add','new.txt');
  assert.throws(()=>lock.begin('claude','b','index-drift',['example.txt']),/HEAD\/index/);
});

test('Failed tools keep observations stale; owner-only recovery needs an exact fencing token and explicit confirmation',t=>{
  const f=setup(t),{lock}=f;lock.start('codex','a');lock.start('claude','b');
  const {token}=lock.begin('codex','a','partial',['example.txt']);writeFileSync(path.join(f.root,'example.txt'),'partial');
  lock.finish('codex','a','partial',true);
  assert.throws(()=>lock.begin('codex','a','stale',['example.txt']),/Versi berubah/);
  const statePath=path.join(f.root,'.agents/.runtime/state.json'),state=JSON.parse(readFileSync(statePath));state.writer.since='1970-01-01T00:00:00Z';writeFileSync(statePath,JSON.stringify(state));
  assert.throws(()=>lock.begin('claude','b','expired',['example.txt']),/Workspace dimiliki/);
  assert.throws(()=>lock.recover(token,false),/hanya oleh operator/);
  assert.throws(()=>lock.recover('wrong',true),/Token pemilik berubah/);
  lock.recover(token,true);assert.equal(lock.status().owner,null);
  assert.throws(()=>lock.begin('claude','b','still-stale',['example.txt']),/Versi berubah/);
});

test('The read helper refreshes only requested text, and command recognition does not accept shell injection',t=>{
  const f=setup(t),{lock}=f;lock.start('codex','a');
  writeFileSync(path.join(f.root,'example.txt'),'changed');writeFileSync(path.join(f.root,'other.txt'),'other');
  lock.read('codex','a',['example.txt']);
  assert.throws(()=>lock.begin('codex','a','unread',['other.txt']),/Versi berubah/);
  assert.throws(()=>lock.read('codex','a',['.git/config']),/metadata/);
  assert.throws(()=>lock.read('codex','a',['../outside.txt']),/luar workspace/);
  const command=`node "${path.join(f.root,'.agents/hooks/workspace-lock.mjs')}" read codex a example.txt`;
  assert.equal(coordinationCommand(command,f.root,f.root,'codex','a'),true);
  for(const suffix of ['; echo unsafe',' | node other.js','\nnode other.js',' && node other.js'])assert.equal(coordinationCommand(command+suffix,f.root,f.root,'codex','a'),false);
  assert.equal(coordinationCommand(command,f.root,f.root,'claude','a'),false);
  const output=spawnSync(process.execPath,[path.join(f.root,'.agents/hooks/workspace-lock.mjs'),'read','codex','a','example.txt'],{cwd:f.root,encoding:'utf8',windowsHide:true});
  assert.equal(output.status,0,output.stderr);assert.equal(JSON.parse(output.stdout)[0].content,'changed');
});

test('Operator mutex recovery checks a dead process and exact token, preserving metadata for audit',t=>{
  const f=setup(t);f.lock.start('codex','a');
  const mutex=path.join(f.root,'.agents/.runtime/mutex'),script="const fs=require('fs');fs.mkdirSync(process.argv[1]);fs.writeFileSync(process.argv[1]+'/owner.json',JSON.stringify({pid:process.pid,token:'dead-mutex'}));";
  const child=spawnSync(process.execPath,['-e',script,mutex],{encoding:'utf8',windowsHide:true});assert.equal(child.status,0,child.stderr);
  assert.throws(()=>f.lock.recoverMutex('dead-mutex',false),/hanya oleh operator/);
  assert.throws(()=>f.lock.recoverMutex('wrong',true),/tidak cocok/);
  assert.equal(f.lock.status().mutex,true);
  f.lock.recoverMutex('dead-mutex',true);assert.equal(f.lock.status().mutex,false);
  f.lock.begin('codex','a','after-recovery',['example.txt']);f.lock.finish('codex','a','after-recovery');f.lock.end('codex','a');
  mkdirSync(mutex);writeFileSync(path.join(mutex,'owner.json'),JSON.stringify({pid:process.pid,token:'live-mutex'}));
  assert.throws(()=>f.lock.recoverMutex('live-mutex',true),/masih hidup/);
});

test('Index stat-cache refresh without staged content changes does not invalidate a session',t=>{
  const f=setup(t);f.lock.start('codex','a');
  writeFileSync(path.join(f.root,'example.txt'),'original\n');f.git('add','example.txt');
  f.lock.begin('codex','a','same-content',['example.txt']);f.lock.finish('codex','a','same-content');f.lock.end('codex','a');
  assert.equal(f.lock.status().owner,null);
});

test('Native hook command strings run through PowerShell and Git Bash with a complete write lifecycle',t=>{
  const f=setup(t);
  for(const [agent,config] of [['codex','.codex/hooks.json'],['claude','.claude/settings.json']]){
    const settings=JSON.parse(readFileSync(path.join(f.root,config),'utf8'));
    const invoke=(event,extra={})=>{
      const handler=settings.hooks[event][0].hooks[0];
      const command=process.platform==='win32'&&agent==='codex'?handler.commandWindows??handler.command:handler.command;
      const args=process.platform==='win32'?agent==='codex'?['powershell.exe',['-NoProfile','-Command',command]]:['C:/Program Files/Git/bin/bash.exe',['-c',command]]:['/bin/sh',['-c',command]];
      const result=spawnSync(args[0],args[1],{cwd:path.join(f.root,'backend'),env:{...process.env,CLAUDE_PROJECT_DIR:f.root},input:JSON.stringify({cwd:f.root,session_id:'native-'+agent,tool_use_id:'native-write',hook_event_name:event,tool_name:'Write',tool_input:{file_path:path.join(f.root,'example.txt')},...extra}),encoding:'utf8',windowsHide:true,timeout:20000});
      assert.equal(result.status,0,result.stderr);return result.stdout?JSON.parse(result.stdout):{};
    };
    assert.match(invoke('SessionStart').hookSpecificOutput.additionalContext,/Workspace bersama: OK/);
    assert.notEqual(invoke('PreToolUse').hookSpecificOutput?.permissionDecision,'deny');
    assert.equal(Object.keys(JSON.parse(readFileSync(path.join(f.root,'.git/msa-coord/state.json'))).tasks).length,1);
    writeFileSync(path.join(f.root,'example.txt'),'native '+agent);
    invoke('PostToolUse',{tool_response:{}});
    invoke('Stop');assert.deepEqual(JSON.parse(readFileSync(path.join(f.root,'.git/msa-coord/state.json'))).tasks,{});
    if(agent==='codex'){
      renameSync(f.hook,f.hook+'.missing');
      try{assert.equal(invoke('PreToolUse').hookSpecificOutput.permissionDecision,'deny');}
      finally{renameSync(f.hook+'.missing',f.hook);}
    }
  }
});
