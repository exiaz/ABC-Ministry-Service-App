#!/usr/bin/env node
// Penjaga kolaborasi Claude + Codex (lihat bagian Kolaborasi di AGENTS.md).
// Pemakaian: node collab-guard.mjs <claude|codex>   (payload hook JSON lewat stdin)
//   SessionStart -> menyuntikkan status penjaga dan pemeriksaan tumpang tindih sebagai konteks.
//   PreToolUse   -> deny/ask sebelum Write/Edit/NotebookEdit yang melanggar aturan.
// Darurat: MSA_GUARD_OFF=1 menonaktifkan penjaga (hanya atas keputusan pengguna).
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import path from 'node:path';

const agent = process.argv[2];
const OTHER = { claude: 'codex', codex: 'claude' }[agent];
if (!OTHER || process.env.MSA_GUARD_OFF === '1') process.exit(0);

const WORKTREE = { claude: 'MSA-claude', codex: 'MSA-codex' };

// Path milik agen lain -> ditolak. Path bersama/ditentukan pengguna -> ditanyakan.
const OWNED = {
  codex: [/^backend\//, /-server\.mjs$/, /^local-[^/]*\.mjs$/, /^firestore\.rules$/, /\.cmd$/],
  claude: [/^ui\//, /^msa-[^/]*\.css$/, /^docs\/ui-overhaul\//],
};
const ASK = [
  /^sw\.js$/, /^server\.mjs$/, /^PROJECT_STATUS\.md$/, /^AGENTS\.md$/, /^CLAUDE\.md$/, /^\.gitignore$/,
  /^\.codex\//, /^\.agents\//, /^package(-lock)?\.json$/, /^msa-[^/]*\.js$/, /^tests\//,
];

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
  const target = input.tool_input?.file_path || input.tool_input?.notebook_path;
  if (!target) process.exit(0);
  const abs = norm(path.resolve(cwd, target));
  const here = norm(top);
  const verdict = (permissionDecision, reason) =>
    emit('PreToolUse', { permissionDecision, permissionDecisionReason: `[collab-guard] ${reason}` });

  const insideHere = abs === here || abs.startsWith(`${here}/`);
  if (!insideHere) {
    // Di folder proyek tapi bukan worktree ini (worktree agen lain atau folder integrasi) -> tolak.
    if (workRoot && abs.startsWith(`${workRoot}/`)) {
      verdict('deny', `${abs} berada di worktree/folder lain. ${agent} hanya menulis di ${here}. Tulis permintaannya di berkas status.`);
    }
    process.exit(0); // di luar proyek (scratchpad, memori, dll.): bebas
  }

  const problem = guardProblem();
  if (problem) {
    verdict('deny', `${problem}. Berhenti dan tanyakan kepada pengguna.`);
    process.exit(0);
  }

  const rel = abs.slice(here.length + 1);
  if (rel.startsWith('.git/') || rel.startsWith('docs/status/') || rel.startsWith('docs/reviews/')) {
    if (rel.startsWith('.git/')) verdict('deny', 'tidak boleh menulis ke .git.');
    else if (!path.basename(rel).includes(agent) && path.basename(rel) !== '_TEMPLATE.md') {
      verdict('ask', `berkas status/review sebaiknya memuat nama agen "${agent}" pada namanya (${rel}).`);
    }
    process.exit(0);
  }
  if (OWNED[OTHER].some((re) => re.test(rel))) {
    verdict('deny', `${rel} milik ${OTHER}. Jangan disentuh; tulis permintaannya di docs/status/.`);
    process.exit(0);
  }
  if (ASK.some((re) => re.test(rel))) {
    verdict('ask', `${rel} bersifat bersama/ditentukan pengguna atau hanya disentuh saat merge. Konfirmasi dulu.`);
    process.exit(0);
  }
  const clash = otherTouched().filter((t) => t.files.includes(rel));
  if (clash.length) {
    verdict('ask', `${rel} juga disentuh ${clash.map((t) => t.ref).join(', ')}. Risiko tumpang tindih: konfirmasi dulu.`);
  }
}
