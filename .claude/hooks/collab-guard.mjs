#!/usr/bin/env node
// Penjaga kolaborasi Claude + Codex (lihat bagian Kolaborasi di AGENTS.md).
// Pemakaian: node collab-guard.mjs <claude|codex>   (payload hook JSON lewat stdin)
//   SessionStart -> menyuntikkan status penjaga dan pemeriksaan tumpang tindih sebagai konteks.
//   PreToolUse   -> deny/ask sebelum penulisan berkas (Write/Edit/NotebookEdit/apply_patch) atau
//                   perintah git berisiko (Bash) yang melanggar aturan.
// Codex hanya mendukung permissionDecision "deny" (bukan "ask"): keputusan ask dipetakan menjadi
// deny untuk path terlindungi/tumpang tindih, dan menjadi peringatan konteks untuk path bersama.
// Darurat: MSA_GUARD_OFF=1 menonaktifkan penjaga (hanya atas keputusan pengguna).
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import path from 'node:path';

const agent = process.argv[2];
const OTHER = { claude: 'codex', codex: 'claude' }[agent];
if (!OTHER || process.env.MSA_GUARD_OFF === '1') process.exit(0);

const WORKTREE = { claude: 'MSA-claude', codex: 'MSA-codex' };

// Path milik agen lain -> ditolak.
const OWNED = {
  codex: [/^backend\//, /-server\.mjs$/, /^local-[^/]*\.mjs$/, /^firestore\.rules$/, /\.cmd$/],
  claude: [/^ui\//, /^msa-[^/]*\.css$/, /^docs\/ui-overhaul\//],
};
// Hanya saat merge atau atas permintaan pengguna.
const PROTECTED = [
  /^sw\.js$/, /^server\.mjs$/, /^PROJECT_STATUS\.md$/, /^AGENTS\.md$/, /^CLAUDE\.md$/, /^\.gitignore$/,
  /^\.codex\//, /^\.agents\//,
];
// Ditentukan pengguna per tugas.
const SHARED = [/^package(-lock)?\.json$/, /^msa-[^/]*\.js$/, /^tests\//];
// Perintah git yang mengubah branch/riwayat; membuat branch tugas baru (switch -c, checkout -b) diizinkan.
const RISKY_GIT = /(?:^|[;&|(]\s*)git(?:\s+-C\s+(?:"[^"]*"|\S+))?\s+(reset|rebase|stash|switch|checkout|worktree\s+(?:add|remove)|branch\s+-[dD]\b|push\b[^;&|]*\s(?:--force\b|-f\b))/;
const NEW_BRANCH = /\s(?:switch\s+-c|checkout\s+-b)\s/;

const git = (cwd, ...args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const norm = (p) => p.replace(/\\/g, '/');

let input = {};
try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  raw = raw.replace(/^﻿/, ''); // PowerShell 5.1 menambahkan BOM saat memipa teks
  input = raw ? JSON.parse(raw) : {};
} catch { /* payload kosong/rusak: pakai cwd proses */ }

const cwd = input.cwd || process.cwd();
const top = git(cwd, 'rev-parse', '--show-toplevel');
if (!top) process.exit(0); // bukan repositori: tidak ada yang dijaga

const branch = git(top, 'branch', '--show-current') || '(detached)';
const commonDir = git(top, 'rev-parse', '--path-format=absolute', '--git-common-dir');
const workRoot = commonDir ? norm(path.dirname(path.dirname(commonDir))) : null; // folder di atas repo utama

// Pelanggaran penjaga awal sesi.
function guardProblem() {
  const folder = path.basename(top);
  const inClaudeTree = agent === 'claude' && norm(top).includes('/.claude/worktrees/');
  if (folder !== WORKTREE[agent] && !inClaudeTree) {
    return `folder ${top} bukan worktree milik ${agent} (seharusnya ${WORKTREE[agent]})`;
  }
  if (branch === 'development' || branch === '(detached)' || /^wip\//.test(branch) || /\/setup$/.test(branch)) {
    return `branch aktif "${branch}" tidak boleh dipakai untuk tugas (development, wip/*, */setup, detached)`;
  }
  if (!branch.startsWith(`${agent}/`)) {
    return `branch aktif "${branch}" tidak berprefiks ${agent}/`;
  }
  return null;
}

// Berkas yang disentuh tiap branch agen lain terhadap development.
function otherTouched() {
  const refs = git(top, 'for-each-ref', '--format=%(refname:short)', `refs/heads/${OTHER}/`, `refs/heads/${agent}/`);
  const out = [];
  for (const ref of (refs || '').split('\n').filter(Boolean)) {
    if (ref === branch || !ref.startsWith(`${OTHER}/`)) continue;
    const files = (git(top, 'diff', '--name-only', `development...${ref}`) || '').split('\n').filter(Boolean);
    if (files.length) out.push({ ref, files });
  }
  return out;
}

const emit = (hookEventName, extra) =>
  writeSync(1, JSON.stringify({ hookSpecificOutput: { hookEventName, ...extra } })); // sinkron: process.exit tidak memotong keluaran

// Berkas yang akan ditulis: file_path/notebook_path (Claude) atau header patch (Codex apply_patch).
function targetsOf(toolInput = {}) {
  const direct = toolInput.file_path || toolInput.notebook_path;
  if (direct) return [direct];
  const found = [];
  for (const v of Object.values(toolInput)) {
    if (typeof v !== 'string') continue;
    for (const m of v.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+?)\s*$/gm)) found.push(m[1]);
  }
  return found;
}

if (input.hook_event_name === 'SessionStart') {
  const problem = guardProblem();
  const touched = otherTouched();
  const mine = new Set((git(top, 'diff', '--name-only', 'development...HEAD') || '').split('\n').filter(Boolean));
  const overlap = touched.flatMap((t) => t.files.filter((f) => mine.has(f)).map((f) => `${f} (juga di ${t.ref})`));
  const lines = [
    `[collab-guard] agen=${agent} folder=${top} branch=${branch}`,
    problem
      ? `PELANGGARAN PENJAGA AWAL SESI: ${problem}. Jangan menulis berkas apa pun; tanyakan kepada pengguna.`
      : 'Penjaga awal sesi: OK.',
    touched.length
      ? `Branch ${OTHER} aktif dan berkas yang disentuhnya:\n` +
        touched.map((t) => `- ${t.ref}: ${t.files.slice(0, 15).join(', ')}${t.files.length > 15 ? ', ...' : ''}`).join('\n')
      : `Tidak ada branch ${OTHER} dengan perubahan terhadap development.`,
    overlap.length
      ? `TUMPANG TINDIH: ${overlap.join('; ')}. Berhenti dan tanyakan kepada pengguna sebelum melanjutkan.`
      : 'Tumpang tindih: tidak ada.',
  ];
  emit('SessionStart', { additionalContext: lines.join('\n') });
  process.exit(0);
}

if (input.hook_event_name === 'PreToolUse') {
  const here = norm(top);
  const msg = (reason) => `[collab-guard] ${reason}`;
  const deny = (reason) => emit('PreToolUse', { permissionDecision: 'deny', permissionDecisionReason: msg(reason) });
  // hard=true: perlu persetujuan pengguna (Claude: ask; Codex tidak punya ask -> deny).
  // hard=false: peringatan saja untuk Codex.
  const confirm = (reason, hard) => {
    if (agent === 'claude') emit('PreToolUse', { permissionDecision: 'ask', permissionDecisionReason: msg(reason) });
    else if (hard) deny(`${reason} Berhenti dan minta persetujuan pengguna di chat.`);
    else emit('PreToolUse', { additionalContext: msg(`${reason} Pastikan pengguna menugaskan ini.`) });
  };

  if (input.tool_name === 'Bash') {
    const cmd = String(input.tool_input?.command ?? '');
    if (RISKY_GIT.test(cmd) && !NEW_BRANCH.test(cmd)) {
      confirm('perintah git ini mengubah branch/riwayat/worktree dan di luar tugas agen (lihat AGENTS.md).', true);
    }
    process.exit(0);
  }

  for (const target of targetsOf(input.tool_input)) {
    const abs = norm(path.resolve(cwd, target));
    if (!(abs === here || abs.startsWith(`${here}/`))) {
      // Di folder proyek tapi bukan worktree ini (worktree agen lain atau folder integrasi) -> tolak.
      if (workRoot && abs.startsWith(`${workRoot}/`)) {
        deny(`${abs} berada di worktree/folder lain. ${agent} hanya menulis di ${here}. Tulis permintaannya di berkas status.`);
        process.exit(0);
      }
      continue; // di luar proyek (scratchpad, memori, dll.): bebas
    }

    const problem = guardProblem();
    if (problem) {
      deny(`${problem}. Berhenti dan tanyakan kepada pengguna.`);
      process.exit(0);
    }

    const rel = abs.slice(here.length + 1);
    if (rel.startsWith('.git/')) {
      deny('tidak boleh menulis ke .git.');
      process.exit(0);
    }
    if (rel.startsWith('docs/status/') || rel.startsWith('docs/reviews/')) {
      const name = path.basename(rel);
      if (!name.includes(agent) && name !== '_TEMPLATE.md') {
        confirm(`berkas status/review sebaiknya memuat nama agen "${agent}" pada namanya (${rel}).`, false);
        process.exit(0);
      }
      continue;
    }
    if (OWNED[OTHER].some((re) => re.test(rel))) {
      deny(`${rel} milik ${OTHER}. Jangan disentuh; tulis permintaannya di docs/status/.`);
      process.exit(0);
    }
    if (PROTECTED.some((re) => re.test(rel))) {
      confirm(`${rel} hanya disentuh saat merge atau atas permintaan pengguna.`, true);
      process.exit(0);
    }
    const clash = otherTouched().filter((t) => t.files.includes(rel));
    if (clash.length) {
      confirm(`${rel} juga disentuh ${clash.map((t) => t.ref).join(', ')} (tumpang tindih).`, true);
      process.exit(0);
    }
    if (SHARED.some((re) => re.test(rel))) {
      confirm(`${rel} bersifat bersama/ditentukan pengguna per tugas.`, false);
      process.exit(0);
    }
  }
}
