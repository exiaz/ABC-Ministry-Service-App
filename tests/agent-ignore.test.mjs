import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

function fixture(t){
  const tempRoot=realpathSync(tmpdir()),cwd=mkdtempSync(path.join(tempRoot,'msa-agent-ignore-'));
  t.after(()=>{
    assert.equal(path.dirname(realpathSync(cwd)),tempRoot);
    assert.ok(path.basename(cwd).startsWith('msa-agent-ignore-'));
    rmSync(cwd,{recursive:true,force:true});
  });
  const git=(...args)=>spawnSync('git',['-c','core.excludesFile='+(process.platform==='win32'?'NUL':'/dev/null'),...args],{cwd,encoding:'utf8',windowsHide:true,timeout:10000});
  const init=git('init','--quiet');assert.equal(init.status,0,init.stderr);
  writeFileSync(path.join(cwd,'.gitignore'),readFileSync(new URL('../.gitignore',import.meta.url)));
  return file=>{
    const result=git('check-ignore','--no-index','--quiet','--',file);
    assert.ok(result.status===0||result.status===1,result.stderr);
    return result.status===0;
  };
}

test('Design sources and licenses remain addable in a fresh checkout, including nested app-kit files',t=>{
  const ignored=fixture(t);
  const sources=['.taste/assets.json','.taste/brand.json','.taste/brief.json','.taste/page.json','.taste/review.json','.taste/app-kit/LICENSE','.taste/app-kit/app-screens.md','.taste/app-kit/app.css','.taste/app-kit/charts.js','.impeccable/config.json','ui/absen.js','assets/fonts/OFL-Geist.txt','.agents/hooks/collab-guard.mjs','.claude/settings.json','.claude/skills/msa-workflow/SKILL.md','.codex/config.toml','.codex/hooks.json'];
  for(const file of sources)assert.equal(ignored(file),false,file);
});

test('Generated design output and existing local agent, environment and emulator files stay ignored',t=>{
  const ignored=fixture(t);
  for(const file of ['.agents/.runtime/state.json','.agents/.runtime/mutex/owner.json','.taste/scratch.json','.taste/cache/temporary.svg','.taste/app-kit/cache.json','.taste/app-kit/cache/temporary.svg','.impeccable/hook.cache.json','.impeccable/report.json','.impeccable/cache/temporary.json','.claude/settings.local.json','.claude/worktrees/example/app.js','.env','.env.local','node_modules/example/index.js','.emulator-data/example/snapshot.json'])assert.equal(ignored(file),true,file);
});
