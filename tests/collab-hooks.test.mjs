// Tes entrypoint hook sungguhan: menyalin .agents/hooks ke repo Git sementara dan menjalankan guard lewat stdin/stdout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '.agents');
const GUARD = process.env.GUARD_FILE || 'collab-guard.mjs';
const repo = mkdtempSync(path.join(tmpdir(), 'msa-hooks-'));
const g = (...a) => execFileSync('git', a, {cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@test.invalid'); g('config', 'user.name', 'tes');
mkdirSync(path.join(repo, '.agents'), {recursive: true});
cpSync(path.join(src, 'hooks'), path.join(repo, '.agents', 'hooks'), {recursive: true});
writeFileSync(path.join(repo, 'a.txt'), 'a'); writeFileSync(path.join(repo, 'b.txt'), 'b');
g('add', '-A'); g('commit', '-q', '-m', 'init');
test.after(() => rmSync(repo, {recursive: true, force: true}));

let seq = 0;
function hook(agent, payload, {env = {}, event} = {}) {
  const r = spawnSync('node', [path.join(repo, '.agents', 'hooks', GUARD), agent, ...(event ? [event] : [])], {
    cwd: repo, input: JSON.stringify(payload), encoding: 'utf8', env: {...process.env, MSA_TASK_ID: '', MSA_DELEGATED: '', MSA_MODE: '', ...env}});
  let json = null; try { json = r.stdout ? JSON.parse(r.stdout) : null; } catch {}
  const o = json?.hookSpecificOutput ?? json ?? {};
  return {status: r.status, stderr: r.stderr, out: json, denied: o.permissionDecision === 'deny' || o.decision === 'deny', reason: o.permissionDecisionReason ?? o.reason ?? ''};
}
const pre = (session, tool, input, opts) => { const id = 'tu' + ++seq; return {...hook('claude', {hook_event_name: 'PreToolUse', session_id: session, cwd: repo, tool_name: tool, tool_use_id: id, tool_input: input}, opts), id}; };
const post = (session, id, tool, input) => hook('claude', {hook_event_name: 'PostToolUse', session_id: session, cwd: repo, tool_name: tool, tool_use_id: id, tool_input: input, tool_response: {}});
const sh = (session, command, opts) => pre(session, 'Bash', {command}, opts);
const stop = session => hook('claude', {hook_event_name: 'Stop', session_id: session, cwd: repo});
const file = p => path.join(repo, p);

test('1. git status/diff/log tetap lolos saat agen lain memegang tugas penulis', () => {
  assert.equal(pre('A1', 'Write', {file_path: file('a.txt')}).denied, false);
  for (const c of ['git status --short', 'git diff', 'git -C . log --oneline -3', 'git branch --show-current', 'git worktree list', 'ls -la | head', 'git diff > /dev/null 2>&1'])
    assert.equal(sh('B1', c).denied, false, c);
  assert.equal(pre('B1', 'Read', {file_path: file('a.txt')}).denied, false);
  assert.equal(pre('B1', 'PowerShell', {command: 'git status'}).denied, false);
  stop('A1');
});

test('2. teks "git reset" dalam prompt/heredoc/kutipan tidak diblokir palsu', () => {
  assert.equal(sh('S2', 'node .agents/hooks/coord.mjs "jangan jalankan git reset --hard atau git push"').denied, false);
  assert.equal(sh('S2', "cat <<'EOF'\nPrompt: git reset --hard && git push --force\nEOF").denied, false);
  assert.equal(sh('S2', 'echo "git commit -m x"').denied, false);
  assert.equal(sh('S2', 'codex exec "tolong jelaskan git reset --hard"').denied, false);
  assert.equal(sh('S2', 'grep -rn "git checkout" docs').denied, false);
  stop('S2');
});

test('3. perintah Git destruktif asli ditolak (termasuk dibungkus)', () => {
  for (const c of ['git reset --hard', 'git -C . push origin main', 'git commit -m x', 'echo hi && git clean -fd', 'bash -c "git checkout ."', 'powershell -Command "git rebase main"', 'git branch -D x', 'git worktree remove x', 'git stash', 'FOO=1 git merge x', 'git status; git push'])
    assert.equal(sh('D3', c).denied, true, c);
  assert.equal(pre('D3', 'PowerShell', {command: 'git reset --hard'}).denied, true);
});

test('8. penulisan ke berkas logis yang sama dicegah, berkas lain boleh', () => {
  assert.equal(pre('W1', 'Write', {file_path: file('a.txt')}).denied, false);
  const r = pre('W2', 'Edit', {file_path: file('a.txt')});
  assert.equal(r.denied, true); assert.match(r.reason, /SCOPE_CONFLICT/);
  assert.equal(pre('W2', 'Edit', {file_path: file('b.txt')}).denied, false);
  stop('W1'); stop('W2');
  assert.equal(pre('W3', 'Write', {file_path: file('a.txt')}).denied, false); // lepas setelah Stop
  stop('W3');
});

test('8b. shell penulis tak dikenal memegang klaim hanya selama tool berjalan', () => {
  const r = sh('X1', 'npm install'); assert.equal(r.denied, false);
  assert.equal(pre('X2', 'Write', {file_path: file('b.txt')}).denied, true);
  post('X1', r.id, 'Bash', {command: 'npm install'});
  assert.equal(pre('X2', 'Write', {file_path: file('b.txt')}).denied, false);
  stop('X1'); stop('X2');
});

test('10. crash pekerja tidak memblokir selamanya (lease habis + pid mati)', () => {
  assert.equal(pre('Z1', 'Write', {file_path: file('a.txt')}).denied, false);
  assert.equal(pre('N1', 'Write', {file_path: file('a.txt')}).denied, true); // pemilik masih hidup
  const stateFile = path.join(repo, '.git', 'msa-coord', 'state.json');
  const s = JSON.parse(readFileSync(stateFile, 'utf8'));
  for (const t of Object.values(s.tasks)) { t.leaseUntil = Date.now() - 1000; t.pid = 2 ** 22 - 1; }
  writeFileSync(stateFile, JSON.stringify(s));
  assert.equal(pre('N1', 'Write', {file_path: file('a.txt')}).denied, false);
  stop('N1');
});

test('11. delegasi bersarang dan pekerja read-only ditolak', () => {
  const env = {MSA_DELEGATED: '1', MSA_TASK_ID: 'child-r', MSA_MODE: 'read'};
  assert.equal(sh('C1', 'codex exec "x"', {env}).denied, true);
  assert.equal(pre('C1', 'Agent', {prompt: 'x'}, {env}).denied, true);
  assert.equal(sh('C1', 'git status', {env}).denied, false);
  assert.equal(pre('C1', 'Write', {file_path: file('a.txt')}, {env}).denied, true);
  assert.equal(sh('C1', 'npm install', {env}).denied, true);
});

test('adapter Codex: apply_patch dan Antigravity: run_command/write_to_file', () => {
  const patch = '*** Begin Patch\n*** Update File: a.txt\n@@\n-a\n+z\n*** End Patch';
  assert.equal(hook('codex', {hook_event_name: 'PreToolUse', session_id: 'CX', cwd: repo, tool_name: 'apply_patch', tool_use_id: 'cx1', tool_input: {command: patch}}).denied, false);
  assert.equal(pre('CL', 'Write', {file_path: file('a.txt')}).denied, true);
  const ag = (name, args, i, session = 'AG1') => hook('antigravity', {toolCall: {name, args}, stepIdx: i, conversationId: session, workspacePaths: [repo]}, {event: 'PreToolUse'});
  assert.deepEqual(ag('run_command', {CommandLine: 'git status', Cwd: repo}, 1).out, {decision: 'allow'});
  assert.equal(ag('run_command', {CommandLine: 'git reset --hard', Cwd: repo}, 2).denied, true);
  assert.equal(ag('write_to_file', {TargetFile: file('a.txt'), CodeContent: 'x'}, 3).denied, true); // dimiliki Codex
  assert.equal(ag('write_to_file', {TargetFile: file('b.txt'), CodeContent: 'x'}, 4).denied, false);
  assert.equal(ag('view_file', {AbsolutePath: file('a.txt')}, 5).denied, false);
  assert.deepEqual(hook('antigravity', {conversationId: 'AG1', stepIdx: 6, toolCall: {name: 'run_command', args: {}}}, {event: 'PostToolUse'}).out, {});
});

test('protected path dan root bukan Git', () => {
  assert.equal(pre('P1', 'Write', {file_path: file('.git/config')}).denied, true);
  const bad = hook('claude', {hook_event_name: 'PreToolUse', session_id: 'P2', cwd: tmpdir(), tool_name: 'Bash', tool_use_id: 'p', tool_input: {command: 'npm install'}});
  assert.equal(bad.denied, true);
  const ok = hook('claude', {hook_event_name: 'PreToolUse', session_id: 'P2', cwd: tmpdir(), tool_name: 'Bash', tool_use_id: 'p', tool_input: {command: 'ls'}});
  assert.equal(ok.denied, false);
});

test('penulisan tanpa session_id/tool_use_id ditolak (gagal tertutup); baca tetap lolos', () => {
  const bare = (tool_input, tool_name = 'Write') => hook('claude', {hook_event_name: 'PreToolUse', cwd: repo, tool_name, tool_input});
  assert.equal(bare({file_path: file('a.txt')}).denied, true);
  assert.equal(bare({command: 'npm install'}, 'Bash').denied, true);
  assert.equal(bare({command: 'git status'}, 'Bash').denied, false);
});
