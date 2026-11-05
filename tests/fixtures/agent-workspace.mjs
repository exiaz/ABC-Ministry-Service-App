import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../../',import.meta.url));
export function agentWorkspace(t){
  const parent=realpathSync(tmpdir()),root=mkdtempSync(path.join(parent,'msa-agent-lock-'));
  t.after(()=>{
    assert.equal(path.dirname(realpathSync(root)),parent);
    assert.ok(path.basename(root).startsWith('msa-agent-lock-'));
    rmSync(root,{recursive:true,force:true});
  });
  for(const file of ['.agents/hooks/collab-guard.mjs','.agents/hooks/workspace-lock.mjs','.claude/hooks/collab-guard.mjs','.claude/settings.json','.codex/hooks.json','AGENTS.md','CLAUDE.md','.gitignore']){
    mkdirSync(path.dirname(path.join(root,file)),{recursive:true});copyFileSync(path.join(source,file),path.join(root,file));
  }
  mkdirSync(path.join(root,'backend'));
  writeFileSync(path.join(root,'example.txt'),'original\n');
  const git=(...args)=>{
    const result=spawnSync('git',['-c','core.hooksPath='+path.join(root,'unused-hooks'),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.stderr);return result.stdout;
  };
  git('init','--quiet','--initial-branch=development');git('add','.');git('commit','--quiet','-m','fixture');
  return {root,hook:path.join(root,'.agents/hooks/collab-guard.mjs'),git};
}
