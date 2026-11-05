import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCoord, sessionTaskId, canonical} from '../.agents/hooks/coord.mjs';
import {agentWorkspace} from './fixtures/agent-workspace.mjs';

function setup(t) {
  const f = agentWorkspace(t), coord = createCoord(f.root), marker = path.join(f.root, 'started.txt');
  const script = path.join(f.root, 'worker.mjs'), cli = path.join(f.root, process.platform === 'win32' ? 'worker.cmd' : 'worker');
  writeFileSync(script, `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(marker)}, process.argv.includes('--version') ? 'version\\n' : 'worker\\n'); console.log('fixture worker');`);
  writeFileSync(cli, process.platform === 'win32' ? `@"${process.execPath}" "${script}" %*\r\n` : `#!/bin/sh\nexec '${process.execPath}' '${script}' "$@"\n`);
  chmodSync(cli, 0o755);
  const env = {...process.env, CODEX_THREAD_ID: 'parent-session', CODEX_SESSION_ID: 'parent-session', MSA_NATIVE_SESSION_ID: '', MSA_NATIVE_AGENT: '', MSA_TASK_ID: '', MSA_PARENT_ID: '', MSA_DELEGATED: '', MSA_MODE: '', MSA_CLAUDE_CLI: cli};
  const hook = (event, extra = {}, agent = 'codex', overrides = {}) => spawnSync(process.execPath, [f.hook, agent], {cwd: f.root, env: {...env, ...overrides}, encoding: 'utf8', input: JSON.stringify({hook_event_name: event, session_id: 'parent-session', cwd: f.root, ...extra})});
  assert.equal(hook('SessionStart').status, 0);
  const run = (args = [], overrides = {}) => {
    const r = spawnSync(process.execPath, [path.join(f.root, '.agents/bin/delegate.mjs'), '--to', 'claude', '--task', 'test-child', '--prompt', 'fixture', ...args], {cwd: f.root, env: {...env, ...overrides}, encoding: 'utf8'});
    return {...r, result: JSON.parse(r.stdout)};
  };
  return {...f, coord, marker, hook, run};
}

test('Valid native session/raw parent/task parent delegates; completion releases only the worker', t => {
  const f = setup(t), parent = sessionTaskId('codex', 'parent-session');
  for (const args of [[], ['--parent', 'parent-session'], ['--parent', parent]]) {
    const r = f.run(args);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(r.result.parent, parent);
    assert.equal(r.result.released, true);
    assert.equal(f.coord.get('test-child'), null);
    assert.equal(f.coord.parent({agent: 'codex', session: 'parent-session', worktree: canonical(f.root)}), parent);
  }
  assert.equal(readFileSync(f.marker, 'utf8'), 'version\nworker\n'.repeat(3));
});

test('Mismatched, unknown, expired, ended and unauthorized parents fail before any CLI starts', t => {
  const cases = ['mismatch', 'unknown', 'expired', 'ended', 'delegated', 'foreign', 'missing'];
  for (const kind of cases) {
    const f = setup(t), overrides = {}, args = ['--parent', 'parent-session'];
    let code;
    if (kind === 'mismatch') {
      f.coord.session({session: 'other', agent: 'codex', worktree: canonical(f.root)});
      args[1] = 'other'; code = 'PARENT_MISMATCH';
    } else if (kind === 'unknown') { overrides.CODEX_THREAD_ID = overrides.CODEX_SESSION_ID = 'unknown'; args[1] = 'unknown'; code = 'PARENT_UNKNOWN'; }
    else if (kind === 'expired') {
      const file = path.join(f.coord.dir, 'state.json'), state = JSON.parse(readFileSync(file, 'utf8'));
      state.sessions[sessionTaskId('codex', 'parent-session')].leaseUntil = Date.now() - 1;
      writeFileSync(file, JSON.stringify(state)); code = 'PARENT_EXPIRED';
    } else if (kind === 'ended') { f.hook('SessionEnd'); code = 'PARENT_UNKNOWN'; }
    else if (kind === 'missing') { overrides.CODEX_THREAD_ID = overrides.CODEX_SESSION_ID = ''; code = 'PARENT_IDENTITY'; }
    else { f.coord.session({session: 'parent-session', agent: 'codex', worktree: kind === 'foreign' ? 'other' : canonical(f.root), delegated: kind === 'delegated'}); code = 'PARENT_UNAUTHORIZED'; }
    const r = f.run(args, overrides);
    assert.equal(r.status, 1, kind);
    assert.equal(r.result.code, code, kind);
    assert.equal(existsSync(f.marker), false, `${kind}: no version probe or worker`);
    assert.equal(f.coord.get('test-child'), null);
    assert.equal(f.git('worktree', 'list', '--porcelain').match(/^worktree /gm).length, 1);
  }
});

test('Registry revalidates parent atomically; active children prevent parent release', t => {
  const f = setup(t), identity = {agent: 'codex', session: 'parent-session', worktree: canonical(f.root)};
  const parent = f.coord.parent(identity);
  assert.throws(() => f.coord.open({id: parent, parent, parentIdentity: identity, agent: 'claude', worktree: canonical(f.root)}), {code: 'PARENT_MISMATCH'});
  assert.throws(() => f.coord.open({id: 'unowned', parent, agent: 'claude', worktree: canonical(f.root)}), {code: 'PARENT_IDENTITY'});
  f.coord.open({id: 'child', parent, parentIdentity: identity, agent: 'claude', mode: 'read', worktree: canonical(f.root)});
  assert.equal(f.coord.release(parent).released, false);
  f.coord.open({id: parent, agent: 'codex', worktree: canonical(f.root), pid: 2 ** 22 - 1});
  const file = path.join(f.coord.dir, 'state.json'), state = JSON.parse(readFileSync(file, 'utf8'));
  state.tasks[parent].leaseUntil = Date.now() - 1;
  writeFileSync(file, JSON.stringify(state));
  assert.ok(f.coord.get(parent), 'Expired parent with a live child must not be reaped');
  f.coord.release('child');
  assert.equal(f.coord.release(parent).released, true);
  f.hook('SessionEnd');
  assert.throws(() => f.coord.open({id: 'late', parent, parentIdentity: identity, agent: 'claude', worktree: canonical(f.root)}), {code: 'PARENT_UNKNOWN'});
});

test('Mutex with unknown ownership is never stolen', t => {
  const f = setup(t), mutex = path.join(f.coord.dir, 'mutex');
  mkdirSync(mutex);
  assert.throws(() => f.coord.list(), {code: 'MUTEX_BUSY'});
  assert.equal(existsSync(mutex), true);
});

test('Claude session identity is persisted safely for Bash and PowerShell delegation', t => {
  const f = setup(t), envFile = path.join(f.root, 'session-env');
  assert.equal(f.hook('SessionStart', {session_id: 'claude-parent'}, 'claude', {CLAUDE_ENV_FILE: envFile}).status, 0);
  assert.match(readFileSync(envFile, 'utf8'), /export MSA_NATIVE_SESSION_ID='claude-parent'/);
  const r = f.run(['--parent', 'claude-parent'], {MSA_NATIVE_SESSION_ID: 'claude-parent', MSA_NATIVE_AGENT: 'claude'});
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.result.parent, sessionTaskId('claude', 'claude-parent'));
});

test('Native event payloads release exact shell claims on denial, failure and batch completion', t => {
  const f = setup(t), tool_input = {command: 'node fixture-write.mjs'};
  const payload = {tool_name: 'PowerShell', tool_use_id: 'native-tool', tool_input};
  for (const event of ['PermissionDenied', 'PostToolUseFailure', 'PostToolUse']) {
    assert.equal(f.hook('PreToolUse', payload).status, 0);
    const parent = sessionTaskId('codex', 'parent-session');
    assert.deepEqual(f.coord.get(parent).ephemeral['native-tool'], ['.']);
    const read = f.hook('PreToolUse', {...payload, session_id: 'reader', tool_input: {command: 'git status --short'}});
    assert.equal(read.status, 0); assert.equal(read.stdout, '');
    assert.equal(f.hook(event, payload).status, 0);
    assert.deepEqual(f.coord.get(parent).ephemeral, {});
  }
  f.hook('Stop');
  assert.equal(f.coord.get(sessionTaskId('codex', 'parent-session')), null);
  f.hook('PreToolUse', payload);
  f.hook('PreToolUse', {...payload, tool_use_id: 'still-running'});
  f.hook('PostToolBatch', {tool_calls: [{tool_use_id: 'native-tool'}]});
  assert.deepEqual(f.coord.get(sessionTaskId('codex', 'parent-session')).ephemeral, {'still-running': ['.']});
  f.hook('PostToolBatch', {tool_calls: [{tool_use_id: 'still-running'}]});
  assert.deepEqual(f.coord.get(sessionTaskId('codex', 'parent-session')).ephemeral, {});
});
