// Klasifikasi perintah shell berdasarkan argumen terstruktur (bukan teks bebas). Dipakai semua adapter.
// Verdict: 'read' (aman), 'write' (mungkin menulis/tidak dikenal), 'deny' (destruktif), 'delegate' (memanggil agen lain).
const MAX_DEPTH = 3;

// Pecah perintah menjadi segmen sederhana. Teks dalam kutipan dan badan heredoc adalah DATA.
export function splitShell(src) {
  const segments = []; let argv = [], word = '', has = false, redirect = false, dynamic = false;
  const pushWord = () => { if (has) argv.push(word); word = ''; has = false; };
  const pushSeg = () => { pushWord(); if (argv.length || redirect) segments.push({ argv, redirect, dynamic }); argv = []; redirect = false; dynamic = false; };
  const heredocs = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'") { has = true; const j = src.indexOf("'", i + 1); const end = j < 0 ? src.length : j; word += src.slice(i + 1, end); i = end; continue; }
    if (c === '"') {
      has = true; i++;
      for (; i < src.length && src[i] !== '"'; i++) {
        if (src[i] === '\\' && '"\\$`'.includes(src[i + 1] ?? '')) { word += src[++i]; continue; }
        if (src[i] === '`' || (src[i] === '$' && src[i + 1] === '(')) dynamic = true;
        word += src[i];
      }
      continue;
    }
    if (c === '`' || (c === '$' && src[i + 1] === '(')) { dynamic = true; word += c; has = true; continue; }
    if (c === '\n' ) {
      pushSeg();
      for (const delim of heredocs.splice(0)) { // lewati badan heredoc
        let pos = i + 1;
        for (;;) {
          const nl = src.indexOf('\n', pos); const line = src.slice(pos, nl < 0 ? src.length : nl).replace(/\r$/, '');
          pos = nl < 0 ? src.length : nl + 1;
          if (line.trim() === delim || nl < 0) break;
        }
        i = pos - 1;
      }
      continue;
    }
    if (c === ';' || c === '|' || c === '&') { if (src[i + 1] === c) i++; if (c === '&' && src[i + 1] === '>') { redirect = true; continue; } pushSeg(); continue; }
    if (c === '<') {
      if (src[i + 1] === '<' && src[i + 2] !== '<') {
        let j = i + 2; if (src[j] === '-') j++;
        while (src[j] === ' ') j++;
        let d = ''; const q = src[j] === "'" || src[j] === '"' ? src[j++] : '';
        while (j < src.length && !/[\s;|&]/.test(src[j]) && src[j] !== q) d += src[j++];
        if (q) j++;
        heredocs.push(d); i = j - 1; continue;
      }
      continue;
    }
    if (c === '>') { // "2>&1" bukan penulisan berkas; ">" ke NUL//dev/null diabaikan
      let j = i + 1; if (src[j] === '>') j++;
      if (src[j] === '&') { i = j; while (/\d/.test(src[i + 1] ?? '')) i++; has = false; word = ''; continue; }
      while (src[j] === ' ') j++;
      let target = ''; while (j < src.length && !/[\s;|&]/.test(src[j])) target += src[j++];
      if (!/^(\/dev\/null|nul|\$null)$/i.test(target)) redirect = true;
      if (/^\d+$/.test(word)) { word = ''; has = false; }
      i = j - 1; continue;
    }
    if (/\s/.test(c)) { pushWord(); continue; }
    word += c; has = true;
  }
  pushSeg();
  return segments;
}

const READ_CMDS = new Set(['ls', 'dir', 'cat', 'type', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'pwd', 'echo', 'printf', 'which', 'where', 'where.exe', 'whoami', 'date', 'sort', 'uniq', 'diff', 'cut', 'tr', 'stat', 'file', 'du', 'df', 'printenv', 'test', '[', 'true', 'false', 'sleep', 'basename', 'dirname', 'realpath', 'readlink', 'tree', 'hostname', 'cd', 'pushd', 'popd', 'set-location', 'get-content', 'get-childitem', 'select-string', 'get-location', 'test-path', 'get-item', 'get-process', 'measure-object', 'write-output', 'write-host', 'get-command', 'get-date', 'get-filehash', 'resolve-path', 'format-list', 'format-table', 'select-object', 'where-object', 'sort-object', 'foreach-object', 'convertfrom-json', 'convertto-json', 'gc', 'gci', 'ls.exe']);
const AGENT_CLIS = new Set(['codex', 'codex.cmd', 'claude', 'claude.exe', 'agy', 'agy.cmd', 'antigravity', 'antigravity.cmd', 'gemini']);
const GIT_DENY = new Set(['commit', 'merge', 'push', 'reset', 'rebase', 'clean', 'stash', 'switch', 'checkout', 'restore', 'revert', 'cherry-pick', 'pull', 'am', 'update-ref', 'gc', 'prune', 'rm', 'mv']);
const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'ls-tree', 'blame', 'grep', 'describe', 'cat-file', 'check-ignore', 'shortlog', 'merge-base', 'for-each-ref', 'rev-list', 'diff-tree', 'diff-files', 'diff-index', 'name-rev', 'show-ref', 'version', 'help', 'whatchanged', 'count-objects', 'ls-remote', 'check-attr', 'var']);
const base = s => s.replace(/^.*[\\/]/, '').toLowerCase();

function classifyGit(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) { // opsi global
    const a = args[i];
    i += (a === '-C' || a === '-c' || a === '--git-dir' || a === '--work-tree' || a === '--namespace') ? 2 : 1;
  }
  const sub = (args[i] ?? '').toLowerCase(), rest = args.slice(i + 1);
  if (!sub) return 'read';
  if (GIT_DENY.has(sub)) return 'deny';
  if (GIT_READ.has(sub)) return 'read';
  if (sub === 'branch') return rest.some(a => /^(-[dDmMcC]|--(delete|move|copy|set-upstream-to|unset-upstream|edit-description))/.test(a)) ? 'deny' : rest.some(a => !a.startsWith('-') && !a.startsWith('--list')) && !rest.some(a => /^(-l|--list|-a|-r|-v|-vv|--show-current|--contains|--merged|--no-merged)/.test(a)) ? 'deny' : 'read';
  if (sub === 'worktree') return (rest[0] ?? 'list') === 'list' ? 'read' : 'deny';
  if (sub === 'tag') return rest.some(a => /^(-d|--delete|-f|--force)/.test(a)) ? 'deny' : rest.every(a => a.startsWith('-')) ? 'read' : 'write';
  if (sub === 'remote') return rest.length === 0 || ['-v', 'show', 'get-url'].includes(rest[0]) ? 'read' : 'deny';
  if (sub === 'config') return rest.some(a => /^(--get|--get-all|--list|-l|--get-regexp)/.test(a)) ? 'read' : 'write';
  if (sub === 'stash' || sub === 'submodule') return 'deny';
  return 'write'; // add, apply, fetch, dll: boleh, tetapi diperlakukan sebagai penulis
}

function classifyArgv(argv, ctx, depth) {
  while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) argv = argv.slice(1); // VAR=x cmd
  if (!argv.length) return 'read';
  const cmd = base(argv[0]), args = argv.slice(1);
  if (['bash', 'sh', 'zsh', 'cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(cmd)) {
    const k = args.findIndex(a => /^(-c|-command|-lc|\/c|\/k)$/i.test(a));
    if (k >= 0 && args[k + 1] !== undefined && depth < MAX_DEPTH) return classifyShell(args.slice(k + 1).join(' '), ctx, depth + 1);
    return 'write';
  }
  if (cmd === 'env' || cmd === 'command' || cmd === 'time' || cmd === 'nohup') return classifyArgv(args.filter(a => !a.startsWith('-')), ctx, depth + 1);
  if (cmd === 'git' || cmd === 'git.exe') return classifyGit(args);
  if (cmd === 'node' || cmd === 'node.exe') {
    const script = args.find(a => !a.startsWith('-'));
    if (args.some(a => a === '--check' || a === '-c' || a === '-v' || a === '--version')) return 'read';
    if (script && ctx.isSelfScript?.(script)) return 'self';
    return 'write';
  }
  if (AGENT_CLIS.has(cmd)) return args.every(a => /^(-v|--version|--help|-h|help|--status)$/.test(a)) ? 'read' : 'delegate';
  if (cmd === 'find') return args.some(a => /^-(delete|exec|execdir|ok|okdir|fprint|fprintf|fls)$/.test(a)) ? 'write' : 'read';
  if (cmd === 'sed') return args.some(a => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place')) ? 'write' : 'read';
  if (cmd === 'sort') return args.some(a => /^(-o|--output)/.test(a)) ? 'write' : 'read';
  if (cmd === 'npm' || cmd === 'npm.cmd') return ['ls', 'list', '--version', '-v', 'view', 'outdated', 'help'].includes(args[0]) ? 'read' : 'write';
  if (READ_CMDS.has(cmd)) return 'read';
  return 'write';
}

const RANK = { read: 0, write: 1, self: 1, delegate: 2, deny: 3 };
export function classifyShell(command, ctx = {}, depth = 0) {
  let worst = 'read';
  for (const seg of splitShell(String(command ?? ''))) {
    let v = seg.argv.length ? classifyArgv(seg.argv, ctx, depth) : 'read';
    if ((seg.redirect || seg.dynamic) && v === 'read') v = 'write';
    if (RANK[v] > RANK[worst]) worst = v;
  }
  return worst;
}
