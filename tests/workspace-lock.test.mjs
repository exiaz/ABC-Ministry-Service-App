import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createWorkspaceLock,coordinationCommand} from '../.agents/hooks/workspace-lock.mjs';
import {agentWorkspace} from './fixtures/agent-workspace.mjs';

function setup(t){const fixture=agentWorkspace(t);return {...fixture,lock:createWorkspaceLock(fixture.root)};}
function hook(f,agent,payload){
  const result=spawnSync(process.execPath,[f.hook,agent],{input:JSON.stringify({cwd:f.root,...payload}),encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,0,result.stderr);return result.stdout?JSON.parse(result.stdout):{};
}
const pre=(session_id,tool_use_id,tool_input={file_path:'example.txt'})=>({hook_event_name:'PreToolUse',session_id,tool_use_id,tool_name:'Write',tool_input});

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

test('Two real hook processes racing to write have one winner; Stop cannot unlock an unfinished tool',async t=>{
  const f=setup(t);
  for(const [agent,session] of [['claude','a'],['codex','b']])hook(f,agent,{hook_event_name:'SessionStart',session_id:session});
  const attempt=(agent,session)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[f.hook,agent],{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='',err='';
    child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);child.once('error',reject);
    child.once('exit',code=>{try{assert.equal(code,0,err);resolve({agent,session,output:out?JSON.parse(out):{}});}catch(error){reject(error);}});
    child.stdin.end(JSON.stringify({cwd:f.root,...pre(session,'tool-'+session)}));
  });
  const results=await Promise.all([attempt('claude','a'),attempt('codex','b')]);
  assert.equal(results.filter(r=>r.output.hookSpecificOutput?.permissionDecision==='deny').length,1);
  const winner=results.find(r=>r.output.hookSpecificOutput?.permissionDecision!=='deny');
  assert.equal(f.lock.status().owner.session,winner.session);
  const stopped=hook(f,winner.agent,{hook_event_name:'Stop',session_id:winner.session});assert.equal(stopped.decision,'block');
  hook(f,winner.agent,{hook_event_name:'PostToolUse',session_id:winner.session,tool_use_id:'wrong'});
  assert.ok(f.lock.status().owner.operation);
  hook(f,winner.agent,{hook_event_name:'PostToolUse',session_id:winner.session,tool_use_id:'tool-'+winner.session,tool_response:{}});
  assert.equal(f.lock.status().owner,null);
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

test('Corrupt state, missing identity, missing tool IDs and abandoned mutexes deny writes without stealing ownership',t=>{
  const f=setup(t);f.lock.start('codex','a');
  for(const payload of [pre(undefined,'id'),pre('a',undefined)])assert.equal(hook(f,'codex',payload).hookSpecificOutput.permissionDecision,'deny');
  writeFileSync(path.join(f.root,'.agents/.runtime/state.json'),'invalid');
  assert.equal(hook(f,'codex',pre('a','corrupt')).hookSpecificOutput.permissionDecision,'deny');
  mkdirSync(path.join(f.root,'.agents/.runtime/mutex'));
  assert.equal(hook(f,'codex',pre('a','mutex')).hookSpecificOutput.permissionDecision,'deny');
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

test('Native lifecycle releases finished writes, keeps active writes fenced and allows inspection while another session owns the lock',t=>{
  const f=setup(t);
  hook(f,'claude',{hook_event_name:'SessionStart',session_id:'a'});
  hook(f,'codex',{hook_event_name:'SessionStart',session_id:'b'});
  hook(f,'claude',pre('a','write'));
  const blocked=hook(f,'codex',{...pre('b','shell',{command:'Get-Content example.txt'}),tool_name:'Bash'});
  assert.equal(blocked.hookSpecificOutput.permissionDecision,'deny');
  assert.equal(hook(f,'codex',{...pre('b','read'),tool_name:'Read'}).hookSpecificOutput,undefined);
  hook(f,'claude',{hook_event_name:'SessionEnd',session_id:'a'});assert.ok(f.lock.status().owner.operation);
  hook(f,'claude',{hook_event_name:'PostToolUseFailure',session_id:'a',tool_use_id:'write',error:'fictional'});
  assert.equal(f.lock.status().owner,null);
  hook(f,'codex',{...pre('b','mcp',{path:path.join(f.root,'example.txt')}),tool_name:'mcp__filesystem__write_file'});
  assert.equal(f.lock.status().owner.session,'b');
  hook(f,'codex',{hook_event_name:'PostToolUse',session_id:'b',tool_use_id:'mcp',tool_response:{}});
  hook(f,'codex',{hook_event_name:'Interrupt',session_id:'b'});assert.equal(f.lock.status().owner,null);
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
    assert.equal(f.lock.status().owner.agent,agent);
    writeFileSync(path.join(f.root,'example.txt'),'native '+agent);
    invoke('PostToolUse',{tool_response:{}});assert.equal(f.lock.status().owner.operation,undefined);
    invoke('Stop');assert.equal(f.lock.status().owner,null);
    if(agent==='codex'){
      renameSync(f.hook,f.hook+'.missing');
      try{assert.equal(invoke('PreToolUse').hookSpecificOutput.permissionDecision,'deny');}
      finally{renameSync(f.hook+'.missing',f.hook);}
    }
  }
});
