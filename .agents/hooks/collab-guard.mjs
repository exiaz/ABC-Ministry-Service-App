#!/usr/bin/env node
// Adapter tunggal Claude / Codex / Antigravity -> kebijakan bersama (policy.mjs) + koordinasi tugas (coord.mjs).
// Bukan pengganti sandbox atau otorisasi aplikasi. Argumen: <agen> [event] (event wajib untuk antigravity).
import {execFileSync} from 'node:child_process';
import {appendFileSync, writeSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical, within} from './workspace-lock.mjs';
import {createCoord, sessionTaskId} from './coord.mjs';
import {classifyShell} from './policy.mjs';

const agent = process.argv[2];
if (!['claude', 'codex', 'antigravity'].includes(agent)) process.exit(0);
const ag = agent === 'antigravity';
const workspace = fileURLToPath(new URL('../../', import.meta.url));
const root = canonical(workspace), parent = canonical(path.dirname(workspace));
const out = text => writeSync(1, text);
const git = (cwd, ...args) => { try { return execFileSync('git', args, {cwd, encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch { return null; } };

let input;
try {
  let raw = ''; for await (const chunk of process.stdin) raw += chunk;
  input = JSON.parse(raw.replace(/^﻿/, ''));
  if (!input || typeof input !== 'object') throw Error();
} catch { writeSync(2, '[collab-guard] Payload hook tidak valid.'); process.exit(2); }

// Normalisasi skema asli tiap agen ke satu bentuk.
const call = ag ? (input.toolCall ?? {}) : {};
const n = ag ? {
  event: process.argv[3], session: input.conversationId, tool: call.name, toolId: `${input.conversationId}:${input.stepIdx}`,
  args: call.args ?? {}, cwd: call.args?.Cwd || input.workspacePaths?.[0] || process.cwd(), failed: !!input.error,
} : {
  event: input.hook_event_name, session: input.session_id, tool: input.tool_name, toolId: input.tool_use_id,
  args: input.tool_input ?? {}, cwd: input.cwd || process.cwd(),
  failed: input.tool_response?.isError === true || Number(input.tool_response?.exit_code ?? 0) !== 0,
};
const SHELL = new Set(['Bash', 'PowerShell', 'exec_command', 'shell', 'local_shell', 'run_command']);
const AG_WRITE = new Set(['write_to_file', 'replace_file_content', 'multi_replace_file_content']);
const command = SHELL.has(n.tool) ? String(n.args.command ?? n.args.cmd ?? n.args.CommandLine ?? '') : null;

const env = process.env, delegated = env.MSA_DELEGATED === '1', readOnly = env.MSA_MODE === 'read';
const taskId = delegated ? env.MSA_TASK_ID : sessionTaskId(agent, n.session);
const meta = {agent, parent: env.MSA_PARENT_ID || null, pid: delegated ? Number(env.MSA_WORKER_PID) || process.ppid : process.ppid};
const top = git(n.cwd, 'rev-parse', '--show-toplevel'), branch = top && git(top, 'branch', '--show-current');
const problem = !top ? 'Root Git tidak dapat diverifikasi.' : canonical(top) !== root ? 'Gunakan workspace aktif ' + workspace : !branch ? 'Detached HEAD: pulihkan branch lewat pengguna.' : null;

const emit = (extra) => out(JSON.stringify({hookSpecificOutput: {hookEventName: n.event, ...extra}}));
const deny = (code, reason) => {
  const text = `[collab-guard:${code}] ${reason}`;
  if (!problem) createCoord(top).audit('deny', {agent, session: n.session, task: taskId, toolId: n.toolId, code});
  out(ag ? JSON.stringify({decision: 'deny', reason: text}) : JSON.stringify({hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: text}}));
  process.exit(0);
};
const ctx = {isSelfScript: s => within(canonical(path.resolve(n.cwd, s)), root + '/.agents')};
const finish = () => process.exit(0);
const needIds = () => { if (typeof n.session !== 'string' || !n.session || typeof n.toolId !== 'string' || !n.toolId || n.toolId.endsWith(':undefined')) deny('MISSING_ID', 'session_id/tool_use_id diperlukan sebelum penulisan.'); };

try {
  if (!problem && n.session) {
    const coord = createCoord(top);
    coord.audit('hook', {agent, session: n.session, hook: n.event, tool: n.tool, toolId: n.toolId, task: taskId});
    if (['SessionStart', 'PreToolUse'].includes(n.event)) coord.session({session: n.session, agent, worktree: root, delegated});
  }
  if (n.event === 'SessionStart') {
    if (!problem && agent === 'claude' && env.CLAUDE_ENV_FILE && n.session) {
      appendFileSync(env.CLAUDE_ENV_FILE, `\nexport MSA_NATIVE_SESSION_ID='${n.session}'\nexport MSA_NATIVE_AGENT='claude'\n`);
    }
    const note = delegated ? `Pekerja terdelegasi: tugas=${taskId}, mode=${env.MSA_MODE}, tidak boleh mendelegasikan lagi.` : 'Workspace bersama: OK. Koordinasi per tugas aktif; operasi baca tidak pernah diblokir.';
    if (ag) out('{}'); else emit({additionalContext: `[collab-guard] agen=${agent} session_id=${n.session || '(tidak ada)'} workspace=${workspace} branch=${branch || '(tidak terverifikasi)'}\n${problem || note}\nBaca AGENTS.md.`});
    finish();
  }
  if (n.event === 'PostToolBatch') {
    // PermissionDenied hanya untuk auto mode; batch juga selesai setelah deny rule/dontAsk.
    if (!problem) for (const call of input.tool_calls ?? []) if (typeof call.tool_use_id === 'string') createCoord(top).unclaim(taskId, call.tool_use_id);
    out('{}'); finish();
  }
  if (['PostToolUse', 'PostToolUseFailure', 'PermissionDenied'].includes(n.event)) {
    if (command !== null && !problem && ['write', 'delegate'].includes(classifyShell(command, ctx))) createCoord(top).unclaim(taskId, n.toolId);
    out('{}'); finish();
  }
  if (['Stop', 'SessionEnd', 'Interrupt'].includes(n.event)) {
    if (n.event === 'SessionEnd' && !problem) createCoord(top).endSession(agent, n.session);
    if (!delegated && !problem) { const r = createCoord(top).release(taskId); if (!r.released) createCoord(top).audit('stop-kept', {task: taskId, children: r.children}); }
    out('{}'); finish();
  }
  if (n.event !== 'PreToolUse') finish();

  const allow = () => { if (ag) out('{"decision":"allow"}'); finish(); };
  if (delegated && ['Agent', 'Task', 'invoke_subagent', 'spawn_agent'].includes(n.tool)) deny('NESTED_DELEGATION', 'Pekerja terdelegasi tidak boleh mendelegasikan lagi.');

  if (command !== null) {
    const verdict = classifyShell(command, ctx);
    if (verdict === 'read' || verdict === 'self') allow();
    if (verdict === 'deny') deny('DESTRUCTIVE_GIT', 'Operasi Git ini mengubah branch, riwayat atau data. Jalankan hanya lewat pengguna setelah persetujuan eksplisit.');
    if (verdict === 'delegate' && delegated) deny('NESTED_DELEGATION', 'Pekerja terdelegasi tidak boleh memanggil agen lain.');
    if (readOnly) deny('READ_ONLY_WORKER', 'Pekerja read-only tidak boleh menjalankan perintah yang dapat menulis.');
    if (problem) deny('WORKSPACE', problem);
    needIds();
    createCoord(top).claim(taskId, meta, root, ['.'], n.toolId, true);
    allow();
  }

  // Tool penyunting berkas: kumpulkan target dari field terstruktur dan header patch.
  const a = n.args, targets = [];
  for (const t of [a.file_path, a.notebook_path, a.filePath, a.path, a.TargetFile, ...(Array.isArray(a.paths) ? a.paths : [])]) if (typeof t === 'string') targets.push(t);
  for (const value of Object.values(a)) if (typeof value === 'string') for (const m of value.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+?)\s*$/gm)) targets.push(m[1]);
  if (!targets.length) allow();
  if (['Read', 'Glob', 'Grep', 'view_file', 'list_dir', 'grep_search', 'find_by_name'].includes(n.tool)) allow();
  if (ag && !AG_WRITE.has(n.tool)) allow();

  const reminders = new Set(), inside = [];
  for (const target of targets) {
    const abs = canonical(path.resolve(n.cwd, target));
    if (!within(abs, root)) { if (within(abs, parent)) deny('FOREIGN_WORKSPACE', 'Folder sumber historis atau workspace lain tidak boleh ditulis: ' + target); continue; }
    if (problem) deny('WORKSPACE', problem);
    const rel = abs === root ? '.' : abs.slice(root.length + 1);
    if (rel === '.git' || rel.startsWith('.git/') || rel === '.claude/worktrees' || rel.startsWith('.claude/worktrees/') || rel === '.agents/.runtime' || rel.startsWith('.agents/.runtime/')) deny('PROTECTED_PATH', 'Jangan menulis metadata Git atau worktree bersarang.');
    if (delegated && /^(\.agents\/|\.claude\/|\.codex\/|\.gitignore$|AGENTS\.md$|CLAUDE\.md$)/.test(rel)) deny('PROTECTED_PATH', 'Pekerja terdelegasi tidak boleh mengubah konfigurasi agen: ' + rel);
    if (/^(?:sw\.js|server\.mjs|PROJECT_STATUS\.md|AGENTS\.md|CLAUDE\.md|package(?:-lock)?\.json|\.gitignore)$|^\.(?:agents|claude|codex)\//i.test(rel)) reminders.add('Path bersama: pertahankan perubahan lokal dan lingkup integrasi yang diminta pengguna.');
    inside.push(rel);
  }
  if (inside.length) {
    if (readOnly) deny('READ_ONLY_WORKER', 'Pekerja read-only tidak boleh menulis berkas.');
    needIds();
    createCoord(top).claim(taskId, meta, root, [...new Set(inside)]);
  }
  if (reminders.size && !ag) emit({additionalContext: '[collab-guard] ' + [...reminders].join(' ')});
  allow();
} catch (error) {
  if (n.event !== 'PreToolUse') { out('{}'); process.exit(0); }
  deny(error.code || 'INTERNAL', error.message); // gagal tertutup untuk tool yang mungkin menulis
}
