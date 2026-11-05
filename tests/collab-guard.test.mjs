import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const hook=path.join(root,'.agents/hooks/collab-guard.mjs');
function run(agent,input,entry=hook){
  const result=spawnSync(process.execPath,[entry,agent],{cwd:root,input:JSON.stringify({cwd:root,...input}),encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,0,result.stderr);
  return result.stdout?JSON.parse(result.stdout).hookSpecificOutput:{};
}
const edit=tool_input=>({hook_event_name:'PreToolUse',tool_name:'apply_patch',tool_input});

test('Shared hook admits both agents in the canonical workspace and its subdirectories',()=>{
  for(const agent of ['claude','codex']){
    assert.match(run(agent,{hook_event_name:'SessionStart'}).additionalContext,/Workspace bersama: OK/);
    assert.match(run(agent,{hook_event_name:'SessionStart',cwd:path.join(root,'backend')}).additionalContext,/Workspace bersama: OK/);
    assert.equal(run(agent,edit({command:'*** Update File: docs/status/fictional-test.md'})).permissionDecision,undefined);
    assert.equal(run(agent,edit({file_path:path.join(root,'AGENTS.md')})).permissionDecision,undefined);
    assert.match(run(agent,edit({file_path:path.join(root,'AGENTS.md')})).additionalContext,/Path bersama/);
  }
});

test('Shared hook rejects historical sources, Git metadata and mixed patches with protected targets',()=>{
  for(const agent of ['claude','codex']){
    for(const target of ['../MSA-claude/app.js','../MSA-codex/app.js','../MSA-codex-xlsx/app.js','.git','.git/config','.claude/worktrees/fictional/file.js']){
      assert.equal(run(agent,edit({file_path:path.resolve(root,target)})).permissionDecision,'deny',target);
    }
    assert.equal(run(agent,edit({command:'*** Update File: AGENTS.md\n*** Update File: .git/config'})).permissionDecision,'deny');
    assert.equal(run(agent,edit({command:'*** Update File: app.js\n*** Move to: ../MSA-claude/app.js'})).permissionDecision,'deny');
    assert.equal(run(agent,{...edit({file_path:'app.js'}),cwd:path.dirname(root)}).permissionDecision,'deny');
  }
});

test('Shared hook rejects Git mutations while allowing read-only shell inspection',()=>{
  for(const agent of ['claude','codex']){
    for(const command of ['git reset --hard','git switch development','git merge codex/example','git commit -m example','git push','git -C "some folder" clean -fd','git worktree remove other','git branch -D old']){
      assert.equal(run(agent,{hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command}}).permissionDecision,'deny',command);
    }
    assert.equal(run(agent,{hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command:'git status --short'}}).permissionDecision,undefined);
  }
});

test('Native registrations use one shared handler per event, with no inactive Beads hook',()=>{
  for(const file of ['.claude/settings.json','.codex/hooks.json']){
    const config=JSON.parse(readFileSync(path.join(root,file),'utf8'));
    for(const event of ['SessionStart','PreToolUse']){
      const commands=config.hooks[event].flatMap(group=>group.hooks.map(hook=>hook.command));
      assert.equal(commands.length,1);assert.match(commands[0],/\.agents\/hooks\/collab-guard\.mjs/);
    }
    assert.doesNotMatch(JSON.stringify(config),/bd codex-hook|\.claude\/hooks/);
  }
  assert.equal(readFileSync(path.join(root,'CLAUDE.md'),'utf8').trim(),'@AGENTS.md');
  assert.match(run('claude',{hook_event_name:'SessionStart'},path.join(root,'.claude/hooks/collab-guard.mjs')).additionalContext,/Workspace bersama: OK/);
  const malformed=spawnSync(process.execPath,[hook,'codex'],{input:'invalid',encoding:'utf8',windowsHide:true});
  assert.equal(malformed.status,2);assert.match(malformed.stderr,/Payload hook tidak valid/);
});
