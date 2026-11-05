import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {agentWorkspace} from './fixtures/agent-workspace.mjs';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const hook=path.join(root,'.agents/hooks/collab-guard.mjs');
let active;
function run(agent,input,entry=hook){
  const session_id='guard-test-'+randomUUID(),tool_use_id='tool-'+randomUUID();
  const invoke=payload=>spawnSync(process.execPath,[entry===hook?active.hook:path.join(active.root,path.relative(root,entry)),agent],{cwd:active.root,input:JSON.stringify({cwd:active.root,session_id,tool_use_id,...payload}),encoding:'utf8',windowsHide:true,timeout:15000});
  if(input.hook_event_name==='PreToolUse')assert.equal(invoke({hook_event_name:'SessionStart'}).status,0);
  const remap=value=>typeof value==='string'?value.replaceAll(root,active.root).replaceAll(path.dirname(root),path.dirname(active.root)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,remap(item)])):value;
  const result=invoke(remap(input));
  assert.equal(result.status,0,result.stderr);
  if(input.hook_event_name==='PreToolUse'){
    assert.equal(invoke({...remap(input),hook_event_name:'PostToolUse',tool_response:{}}).status,0);
    assert.equal(invoke({hook_event_name:'Stop'}).status,0);
  }
  return result.stdout?JSON.parse(result.stdout).hookSpecificOutput??{}:{};
}
const edit=tool_input=>({hook_event_name:'PreToolUse',tool_name:'apply_patch',tool_input});

test('Shared hook admits both agents in the canonical workspace and its subdirectories',t=>{
  active=agentWorkspace(t);
  for(const agent of ['claude','codex']){
    assert.match(run(agent,{hook_event_name:'SessionStart'}).additionalContext,/Workspace bersama: OK/);
    assert.match(run(agent,{hook_event_name:'SessionStart',cwd:path.join(root,'backend')}).additionalContext,/Workspace bersama: OK/);
    assert.equal(run(agent,edit({command:'*** Update File: docs/status/fictional-test.md'})).permissionDecision,undefined);
    assert.equal(run(agent,edit({file_path:path.join(root,'AGENTS.md')})).permissionDecision,undefined);
    assert.match(run(agent,edit({file_path:path.join(root,'AGENTS.md')})).additionalContext,/Path bersama/);
  }
});

test('Shared hook rejects historical sources, Git metadata and mixed patches with protected targets',t=>{
  active=agentWorkspace(t);
  for(const agent of ['claude','codex']){
    for(const target of ['../MSA-claude/app.js','../MSA-codex/app.js','../MSA-codex-xlsx/app.js','.git','.git/config','.claude/worktrees/fictional/file.js','.agents/.runtime/state.json']){
      assert.equal(run(agent,edit({file_path:path.resolve(root,target)})).permissionDecision,'deny',target);
    }
    assert.equal(run(agent,edit({command:'*** Update File: AGENTS.md\n*** Update File: .git/config'})).permissionDecision,'deny');
    assert.equal(run(agent,edit({command:'*** Update File: app.js\n*** Move to: ../MSA-claude/app.js'})).permissionDecision,'deny');
    assert.equal(run(agent,{...edit({file_path:'app.js'}),cwd:path.dirname(root)}).permissionDecision,'deny');
  }
});

test('Shared hook rejects Git mutations while allowing read-only shell inspection',t=>{
  active=agentWorkspace(t);
  for(const agent of ['claude','codex']){
    for(const command of ['git reset --hard','git switch development','git merge codex/example','git commit -m example','git push','git -C "some folder" clean -fd','git worktree remove other','git branch -D old']){
      assert.equal(run(agent,{hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command}}).permissionDecision,'deny',command);
    }
    assert.equal(run(agent,{hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command:'git status --short'}}).permissionDecision,undefined);
  }
});

test('Native registrations use one shared handler per event, with no inactive Beads hook',t=>{
  active=agentWorkspace(t);
  for(const file of ['.claude/settings.json','.codex/hooks.json']){
    const config=JSON.parse(readFileSync(path.join(root,file),'utf8'));
    for(const event of ['SessionStart','PreToolUse','PostToolUse','Stop','SessionEnd']){
      const commands=config.hooks[event].flatMap(group=>group.hooks.map(hook=>hook.command));
      assert.equal(commands.length,1);assert.match(commands[0],/\.agents\/hooks\/collab-guard\.mjs/);
    }
    assert.doesNotMatch(JSON.stringify(config),/bd codex-hook|\.claude\/hooks/);
    if(file.startsWith('.claude/'))assert.equal(config.hooks.PreToolUse[0].hooks[0].onFailure,'block');
    else assert.match(config.hooks.PreToolUse[0].hooks[0].commandWindows,/permissionDecision/);
  }
  assert.equal(readFileSync(path.join(root,'CLAUDE.md'),'utf8').trim(),'@AGENTS.md');
  assert.match(run('claude',{hook_event_name:'SessionStart'},path.join(root,'.claude/hooks/collab-guard.mjs')).additionalContext,/Workspace bersama: OK/);
  const malformed=spawnSync(process.execPath,[hook,'codex'],{input:'invalid',encoding:'utf8',windowsHide:true});
  assert.equal(malformed.status,2);assert.match(malformed.stderr,/Payload hook tidak valid/);
});
