#!/usr/bin/env node
// Pembungkus delegasi antaragen: node .agents/bin/delegate.mjs --to codex|claude|antigravity --mode read|write --prompt-file f [opsi]
// Pekerja write mendapat git worktree terisolasi; pekerja read memakai workspace tanpa kunci eksklusif.
// Tidak ada merge/push otomatis. Laporan ringkas JSON ke stdout; transkrip penuh ke <git-common-dir>/msa-coord/reports/.
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical} from '../hooks/workspace-lock.mjs';
import {createCoord} from '../hooks/coord.mjs';

const workspace = path.resolve(fileURLToPath(new URL('../../', import.meta.url))); // tanpa "\" akhir: merusak kutipan cmd
const die = (code, message, extra = {}) => { process.stdout.write(JSON.stringify({status: 'error', code, message, ...extra}, null, 2) + '\n'); process.exit(1); };
const opt = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--dry-run') opt.dry = true;
  else if (k.startsWith('--')) opt[k.slice(2)] = process.argv[++i];
}
if (process.env.MSA_DELEGATED === '1') die('NESTED_DELEGATION', 'Pekerja terdelegasi tidak boleh mendelegasikan lagi.');
const to = opt.to, mode = opt.mode ?? 'read', role = opt.role ?? (mode === 'read' ? 'reviewer' : 'worker');
if (!['codex', 'claude', 'antigravity'].includes(to)) die('BAD_ARGS', '--to harus codex, claude, atau antigravity.');
if (!['read', 'write'].includes(mode)) die('BAD_ARGS', '--mode harus read atau write.');
const prompt = opt['prompt-file'] ? readFileSync(path.resolve(opt['prompt-file']), 'utf8') : opt.prompt;
if (!prompt) die('BAD_ARGS', 'Berikan --prompt-file atau --prompt.');
const taskId = (opt.task ?? `${to}-${Date.now().toString(36)}`).replace(/[^A-Za-z0-9._-]/g, '-');
const parent = opt.parent ?? (process.env.MSA_TASK_ID || null);
const scopes = mode === 'write' ? (opt.scope ?? '.').split(',').map(s => s.trim().replace(/\\/g, '/').replace(/\/$/, '')).filter(Boolean) : [];
const timeout = Number(opt.timeout ?? 900) * 1000;

// Temukan CLI dan verifikasi bendera yang dipakai.
const win = process.platform === 'win32';
const quote = a => `"${String(a).replace(/"/g, '\\"')}"`;
function run(bin, args, o = {}) {
  const useShell = win && !/\.exe$/i.test(bin);
  const r = useShell
    ? spawnSync(`${quote(bin)} ${args.map(quote).join(' ')}`, {shell: true, windowsHide: true, encoding: 'utf8', maxBuffer: 64 << 20, ...o})
    : spawnSync(bin, args, {windowsHide: true, encoding: 'utf8', maxBuffer: 64 << 20, ...o});
  return r;
}
function locate(name) {
  const r = spawnSync(win ? 'where.exe' : 'which', [name], {encoding: 'utf8', windowsHide: true});
  const lines = r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
  return lines.find(l => /\.(exe|cmd)$/i.test(l)) ?? lines[0] ?? null;
}
// Cadangan bila PATH sandbox tidak memuat CLI (mis. Codex): MSA_<AGEN>_CLI, lalu lokasi instalasi WinGet/npm.
function fallback(name) {
  const local = process.env.LOCALAPPDATA ?? '', roaming = process.env.APPDATA ?? '';
  const pkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');
  const hit = name === 'claude' && existsSync(pkgs) ? readdirSync(pkgs).find(d => d.startsWith('Anthropic.ClaudeCode')) : null;
  return [hit && path.join(pkgs, hit, 'claude.exe'), path.join(roaming, 'npm', `${name}.cmd`)].find(p => p && existsSync(p)) ?? null;
}
// Sandbox Codex berjalan sebagai pengguna lain: ingat jalur CLI yang ditemukan di lingkungan normal (cache di git common dir).
const cacheFile = path.join(createCoord(workspace).dir, 'cli.json');
let cache = {}; try { cache = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch {}
const cli = process.env[`MSA_${to.toUpperCase()}_CLI`] || (to === 'antigravity' ? locate('agy') || locate('antigravity-cli') : locate(to) || fallback(to) || (existsSync(cache[to] ?? '') ? cache[to] : null));
if (cli && cache[to] !== cli && to !== 'antigravity') { cache[to] = cli; try { writeFileSync(cacheFile, JSON.stringify(cache)); } catch {} }
if (!cli) die('CLI_UNAVAILABLE', `CLI ${to} tidak ditemukan di PATH${to === 'antigravity' ? ' (set MSA_ANTIGRAVITY_CLI dan MSA_ANTIGRAVITY_ARGS jika CLI-nya ada)' : ' (atau set MSA_' + to.toUpperCase() + '_CLI)'}.`, {agent: to});
const ver = run(cli, ['--version'], {timeout: 20000});
if (ver.status !== 0) die('CLI_UNUSABLE', `${to} --version gagal.`, {stderr: String(ver.stderr).slice(0, 300)});
if (to === 'antigravity' && !process.env.MSA_ANTIGRAVITY_ARGS) die('CLI_UNVERIFIED', 'Flag non-interaktif Antigravity CLI belum terverifikasi; set MSA_ANTIGRAVITY_ARGS (array JSON, prompt lewat stdin).');

const coord = createCoord(workspace);
const reportDir = path.join(coord.dir, 'reports'); mkdirSync(reportDir, {recursive: true});
const out = path.join(reportDir, `${taskId}.last.txt`);
let cwd = workspace, branch = null;
const git = (cwdir, ...a) => spawnSync('git', a, {cwd: cwdir, encoding: 'utf8', windowsHide: true});
if (mode === 'write') {
  branch = `agent/${taskId}`;
  cwd = path.join(path.dirname(workspace), 'abc-msa-wt', taskId);
  if (opt.dry) { /* hanya rencana */ }
  else {
    const add = git(workspace, 'worktree', 'add', '-b', branch, cwd, opt['base-ref'] ?? 'HEAD');
    if (add.status !== 0) die('WORKTREE_FAILED', add.stderr.trim());
    for (const p of ['.agents', '.codex']) cpSync(path.join(workspace, p), path.join(cwd, p), {recursive: true, force: true, filter: s => !s.includes('.runtime')});
    mkdirSync(path.join(cwd, '.claude'), {recursive: true}); cpSync(path.join(workspace, '.claude', 'settings.json'), path.join(cwd, '.claude', 'settings.json'));
  }
}
const preamble = `Tugas ${taskId} (peran ${role}, mode ${mode}${scopes.length ? ', lingkup ' + scopes.join(',') : ''}). Jangan mendelegasikan ke agen lain; jangan commit/merge/push; jangan mengubah konfigurasi agen. ` +
  `Akhiri dengan laporan ringkas (maks 200 kata): perubahan, berkas, tes yang dijalankan beserta hasilnya, risiko.\n\n`;
const full = preamble + prompt;
let args;
if (to === 'codex') args = ['exec', '--cd', cwd, '--sandbox', mode === 'read' ? 'read-only' : 'workspace-write', '--ephemeral', '-o', out, '-'];
else if (to === 'claude') args = ['-p', '--output-format', 'text', '--no-session-persistence', '--permission-mode', mode === 'read' ? 'plan' : 'acceptEdits',
  ...(mode === 'write' ? ['--allowedTools', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(node --test:*)', 'Bash(npm.cmd test:*)', 'Bash(npm.cmd run check:*)'] : [])];
else args = JSON.parse(process.env.MSA_ANTIGRAVITY_ARGS);
if (opt.dry) { process.stdout.write(JSON.stringify({status: 'dry-run', taskId, parent, to, mode, cli, version: String(ver.stdout).trim().split('\n')[0], cwd, branch, args, scopes}, null, 2) + '\n'); process.exit(0); }

const wtKey = canonical(cwd);
try { coord.open({id: taskId, parent, agent: to, role, mode, worktree: wtKey, scopes: mode === 'write' ? scopes : [], fixed: mode === 'write', pid: process.pid, baseline: git(workspace, 'rev-parse', 'HEAD').stdout.trim()}); }
catch (e) { die(e.code ?? 'COORD', e.message); }
const warnings = coord.list().filter(t => t.id !== taskId && t.mode === 'write' && mode === 'write' && t.worktree !== wtKey && t.scopes.some(a => scopes.some(b => a === '.' || b === '.' || a === b || a.startsWith(b + '/') || b.startsWith(a + '/')))).map(t => `Lingkup beririsan dengan tugas ${t.id} (worktree lain): integrasi perlu tinjauan konflik.`);

const env = {...process.env, MSA_TASK_ID: taskId, MSA_PARENT_ID: parent ?? '', MSA_DELEGATED: '1', MSA_DEPTH: '1', MSA_MODE: mode, MSA_ROLE: role, MSA_WORKTREE: cwd, MSA_SCOPE: scopes.join(','), MSA_WORKER_PID: String(process.pid)};
const started = Date.now();
const r = run(cli, args, {cwd, env, input: full, timeout});
const log = path.join(reportDir, `${taskId}.log`);
writeFileSync(log, `# stdout\n${r.stdout ?? ''}\n# stderr\n${r.stderr ?? ''}\n`);
let summary = to === 'codex' && existsSync(out) ? readFileSync(out, 'utf8') : String(r.stdout ?? '');
summary = summary.trim().slice(-1800);
const changed = mode === 'write' ? git(cwd, 'status', '--short').stdout.split('\n').filter(Boolean).filter(l => !/\s\.(agents|codex|claude)\//.test(l)) : [];
const released = coord.release(taskId, {force: true});
process.stdout.write(JSON.stringify({
  status: r.status === 0 ? 'ok' : (r.error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed'), taskId, parent, agent: to, mode, role, exitCode: r.status, seconds: Math.round((Date.now() - started) / 1000),
  worktree: mode === 'write' ? cwd : null, branch, changedFiles: changed, summary, warnings, transcript: log, released: released.released,
  integrate: mode === 'write' ? `Tinjau: git diff HEAD...${branch}; integrasi/penghapusan worktree dilakukan orkestrator atas persetujuan pengguna.` : null,
}, null, 2) + '\n');
process.exit(r.status === 0 ? 0 : 1);
