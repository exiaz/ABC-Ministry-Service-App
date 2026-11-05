// Pengujian manual native (memakai akun CLI yang sudah login): node tests/collab-native.mjs
// Seluruh percobaan tulis berada di repo sementara; hook global tetap aktif.
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {agentWorkspace} from './fixtures/agent-workspace.mjs';
import {commonDir} from '../.agents/hooks/coord.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const reports = path.join(commonDir(source), 'msa-coord/reports', `native-${Date.now()}`);
mkdirSync(reports, {recursive: true});
const cli = process.env.MSA_CLAUDE_CLI || execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['claude'], {encoding: 'utf8'}).trim().split(/\r?\n/).find(s => process.platform !== 'win32' || /\.exe$/i.test(s));
assert.ok(cli, 'Native Claude CLI required');
const cleanups = [], results = [];
function run(name, prompt, {mode = '', permission = 'acceptEdits', broken = false} = {}) {
  const f = agentWorkspace({after: fn => cleanups.push(fn)}), debug = path.join(reports, `${name}.debug.log`);
  if (broken) {
    const settings = JSON.parse(readFileSync(path.join(f.root, '.claude/settings.json'), 'utf8'));
    settings.hooks.PreToolUse.push({matcher: '.*', hooks: [{type: 'command', command: 'node', args: [path.join(f.root, 'missing-guard.mjs')], onFailure: 'block'}]});
    writeFileSync(path.join(f.root, '.claude/settings.json'), JSON.stringify(settings));
  }
  const env = {...process.env, MSA_MODE: mode, MSA_DELEGATED: mode ? '1' : '', MSA_TASK_ID: mode ? `native-${name}` : '', MSA_PARENT_ID: '', MSA_NATIVE_SESSION_ID: '', MSA_NATIVE_AGENT: '', CODEX_THREAD_ID: '', CODEX_SESSION_ID: ''};
  console.log(JSON.stringify({test: name, status: 'running', root: f.root}));
  const r = spawnSync(cli, ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--debug-file', debug, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-mode', permission, '--tools', 'PowerShell,Write', '--max-turns', '5'], {
    cwd: f.root, env, input: prompt.replaceAll('ROOT', f.root.replaceAll('\\', '/')), encoding: 'utf8', timeout: 180000, maxBuffer: 32 << 20, windowsHide: true,
  });
  writeFileSync(path.join(reports, `${name}.stdout.jsonl`), r.stdout || '');
  writeFileSync(path.join(reports, `${name}.stderr.log`), r.stderr || '');
  const auditFile = path.join(f.root, '.git/msa-coord/audit.log');
  assert.ok(existsSync(auditFile), `${name}: native shared hook must execute`);
  copyFileSync(auditFile, path.join(reports, `${name}.audit.jsonl`));
  const events = readFileSync(auditFile, 'utf8').trim().split('\n').map(s => JSON.parse(s));
  const keys = events.filter(e => e.event === 'hook' && e.toolId).map(e => `${e.agent}:${e.session}:${e.hook}:${e.toolId}`);
  assert.equal(new Set(keys).size, keys.length, `${name}: no duplicate shared hook execution`);
  assert.equal(r.status, 0, `${name}: ${r.error?.message || r.stderr}`);
  assert.equal(existsSync(path.join(f.root, 'probe.txt')), false, `${name}: unauthorized write must not execute`);
  return {f, events, debug: readFileSync(debug, 'utf8'), output: r.stdout};
}
try {
  const read = run('read-denial', 'Ini pengujian keamanan yang diotorisasi dalam repo sementara. Gunakan PowerShell tepat sekali untuk git status --short, lalu gunakan tool Write tepat sekali ke ROOT/probe.txt dengan isi test. Percobaan tulis sengaja harus ditolak hook read-only; jangan menghindari tool call, jangan mencoba jalan lain. Laporkan hasil tool yang benar-benar diterima.', {mode: 'read'});
  assert.ok(read.events.some(e => e.event === 'hook' && e.hook === 'PostToolUse' && e.tool === 'PowerShell'), 'Git read must actually execute');
  assert.ok(read.events.some(e => e.event === 'deny' && e.code === 'READ_ONLY_WORKER'), 'Native Write must be denied by guard');
  results.push({test: 'native read Git / unauthorized Write / no duplicate', status: 'PASS'});
  console.log(JSON.stringify(results.at(-1)));

  const permission = run('permission-denial', 'Ini pengujian izin pada repo sementara. Panggil PowerShell tepat sekali dengan command Set-Content -LiteralPath ROOT/probe.txt -Value test. Izin native seharusnya menolak. Jangan gunakan tool lain atau mencoba kembali; laporkan penolakannya.', {permission: 'dontAsk'});
  const denied = permission.output.split('\n').filter(Boolean).map(s => JSON.parse(s)).find(e => e.subtype === 'permission_denied');
  assert.ok(denied, 'Native permission denial required');
  const batch = permission.events.findIndex(e => e.event === 'hook' && e.hook === 'PostToolBatch');
  const unclaim = permission.events.findIndex(e => e.event === 'unclaim' && e.toolId === denied.tool_use_id);
  const stop = permission.events.findIndex(e => e.event === 'hook' && e.hook === 'Stop');
  assert.ok(batch >= 0 && unclaim > batch && unclaim < stop, 'Batch releases denied shell claim before Stop');
  results.push({test: 'native permission denial / claim release / no duplicate', status: 'PASS'});
  console.log(JSON.stringify(results.at(-1)));

  const broken = run('hook-failure', 'Pengujian hook gagal yang diotorisasi: gunakan Write tepat sekali ke ROOT/probe.txt dengan isi test. Hook tambahan sengaja menunjuk modul yang tidak ada dan harus menolak. Jangan mencoba cara lain. Laporkan hasil tool.', {broken: true});
  assert.match(broken.debug + broken.output, /onFailure|blocking because|missing-guard/);
  assert.ok(broken.events.some(e => e.event === 'hook' && e.hook === 'PreToolUse' && e.tool === 'Write'), 'Write attempted before failing hook blocks it');
  results.push({test: 'native onFailure block / no file written', status: 'PASS'});
  console.log(JSON.stringify(results.at(-1)));
} catch (error) {
  results.push({status: 'FAIL', error: error.message});
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(reports, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({reports, results}, null, 2));
  for (const cleanup of cleanups) cleanup();
}
