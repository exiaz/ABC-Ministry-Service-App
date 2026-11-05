// Koordinasi berbasis tugas (task) dengan klaim lingkup per worktree. State di git common dir (dibagi semua worktree).
// Transaksi: mutex mkdir atomik + tulis temp lalu rename. Kedaluwarsa hanya jika lease habis DAN pid mati.
import {execFileSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical, within} from './workspace-lock.mjs';

export const LEASE_MS = 10 * 60 * 1000;
const alive = pid => { if (!Number.isSafeInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export class CoordError extends Error { constructor(code, message) { super(message); this.code = code; } }
export const sessionTaskId = (agent, session) => `${agent}-${createHash('sha256').update(String(session)).digest('hex').slice(0, 10)}`;

export function commonDir(cwd) {
  const out = execFileSync('git', ['rev-parse', '--git-common-dir'], {cwd, encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore']}).trim();
  return path.resolve(cwd, out);
}

// Dua lingkup bertabrakan bila salah satunya awalan path yang lain ('.' = seluruh worktree).
export const overlaps = (a, b) => a === '.' || b === '.' || a === b || a.startsWith(b + '/') || b.startsWith(a + '/');

export function createCoord(cwd) {
  const dir = path.join(commonDir(cwd), 'msa-coord'), stateFile = path.join(dir, 'state.json'), mutex = path.join(dir, 'mutex'), auditFile = path.join(dir, 'audit.log');
  mkdirSync(dir, {recursive: true});
  const audit = (event, data) => { try { appendFileSync(auditFile, JSON.stringify({t: new Date().toISOString(), event, ...data}) + '\n'); } catch {} };
  function lock() {
    for (let i = 0; i < 150; i++) {
      try { mkdirSync(mutex); writeFileSync(path.join(mutex, 'owner'), String(process.pid)); return; }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let owner = NaN; try { owner = Number(readFileSync(path.join(mutex, 'owner'), 'utf8')); } catch {}
        if (Number.isSafeInteger(owner) && owner > 0 && !alive(owner)) { rmSync(mutex, {recursive: true, force: true}); continue; } // jangan ambil mutex yang pemiliknya belum diketahui
        sleep(20);
      }
    }
    throw new CoordError('MUTEX_BUSY', 'State koordinasi sedang dipakai; coba lagi.');
  }
  function tx(run) {
    lock();
    try {
      let state = {version: 2, tasks: {}};
      if (existsSync(stateFile)) { state = JSON.parse(readFileSync(stateFile, 'utf8')); if (state.version !== 2) throw new CoordError('STATE_VERSION', 'State koordinasi tidak kompatibel.'); }
      state.sessions ??= {};
      reap(state);
      const result = run(state), tmp = path.join(dir, randomUUID() + '.tmp');
      writeFileSync(tmp, JSON.stringify(state)); renameSync(tmp, stateFile);
      return result;
    } finally { rmSync(mutex, {recursive: true, force: true}); }
  }
  function reap(state) {
    const now = Date.now();
    for (const [id, t] of Object.entries(state.tasks)) if (t.leaseUntil < now && !alive(t.pid) && !children(state, id).length) { delete state.tasks[id]; audit('reaped', {task: id}); }
  }
  const children = (state, id) => Object.values(state.tasks).filter(t => t.parent === id);
  const conflict = (state, id, worktree, scopes) => {
    for (const t of Object.values(state.tasks)) {
      if (t.id === id || t.worktree !== worktree) continue;
      const mine = [...t.scopes, ...Object.values(t.ephemeral).flat()];
      for (const s of scopes) { const hit = mine.find(m => overlaps(m, s)); if (hit) return {task: t.id, scope: hit, wanted: s}; }
    }
    return null;
  };
  const touch = (t, pid) => { t.leaseUntil = Date.now() + LEASE_MS; if (pid) t.pid = pid; };
  const authorizeParent = (state, identity) => {
    const {session, agent, parent, worktree} = identity ?? {};
    if (!session || !agent) throw new CoordError('PARENT_IDENTITY', 'Identitas sesi native pemanggil diperlukan.');
    const s = state.sessions[sessionTaskId(agent, session)];
    if (!s || s.session !== session || s.agent !== agent) throw new CoordError('PARENT_UNKNOWN', 'Sesi induk tidak terdaftar oleh hook native.');
    if (s.leaseUntil <= Date.now()) throw new CoordError('PARENT_EXPIRED', 'Sesi induk sudah kedaluwarsa; jalankan tool melalui sesi native yang aktif.');
    if (s.delegated || s.worktree !== worktree) throw new CoordError('PARENT_UNAUTHORIZED', 'Sesi ini tidak berwenang mendelegasikan dari workspace tersebut.');
    if (parent != null && parent !== s.session && parent !== s.taskId) throw new CoordError('PARENT_MISMATCH', '--parent tidak cocok dengan sesi native pemanggil.');
    return s.taskId;
  };
  return {
    dir,
    audit,
    session({session, agent, worktree, delegated = false}) {
      if (typeof session !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(session)) throw new CoordError('MISSING_ID', 'session_id native tidak valid.');
      return tx(state => {
        const taskId = sessionTaskId(agent, session);
        state.sessions[taskId] = {session, taskId, agent, worktree, delegated, leaseUntil: Date.now() + LEASE_MS};
        return state.sessions[taskId];
      });
    },
    endSession(agent, session) { return tx(state => { delete state.sessions[sessionTaskId(agent, session)]; }); },
    parent(identity) { return tx(state => authorizeParent(state, identity)); },
    // Buka tugas eksplisit (dipakai wrapper delegasi). fixed=true: penulisan dibatasi pada scopes.
    open({id, parent = null, parentIdentity, agent, role = 'worker', mode = 'write', worktree, scopes = [], pid = process.pid, baseline = null, fixed = false}) {
      return tx(state => {
        if (parent !== null && authorizeParent(state, parentIdentity) !== parent) throw new CoordError('PARENT_MISMATCH', 'Pemilik tugas induk tidak cocok.');
        if (parent === id) throw new CoordError('PARENT_MISMATCH', 'ID tugas anak harus berbeda dari induk.');
        if (state.tasks[id]) throw new CoordError('TASK_EXISTS', `Tugas ${id} sudah ada.`);
        if (mode === 'write') { const c = conflict(state, id, worktree, scopes); if (c) throw new CoordError('SCOPE_CONFLICT', `Lingkup ${c.wanted} bertabrakan dengan tugas ${c.task} (${c.scope}) di worktree yang sama.`); }
        state.tasks[id] = {id, parent, agent, role, mode, worktree, scopes: mode === 'write' ? scopes : [], ephemeral: {}, fixed, baseline, pid, leaseUntil: 0, created: new Date().toISOString()};
        touch(state.tasks[id], pid); audit('open', {task: id, parent, agent, role, mode, worktree, scopes});
        return state.tasks[id];
      });
    },
    // Klaim path untuk menulis. ephemeralId: klaim hanya selama satu tool (shell tak dikenal); selain itu bertahan sampai release.
    claim(id, meta, worktree, paths, ephemeralId = null, shell = false) {
      return tx(state => {
        let t = state.tasks[id];
        if (!t) { t = state.tasks[id] = {id, parent: meta.parent ?? null, agent: meta.agent, role: 'implicit', mode: 'write', worktree, scopes: [], ephemeral: {}, fixed: false, baseline: null, pid: meta.pid, leaseUntil: 0, created: new Date().toISOString()}; audit('open', {task: id, implicit: true, agent: meta.agent, worktree}); }
        if (t.mode !== 'write') throw new CoordError('READ_ONLY_TASK', `Tugas ${id} bersifat read-only.`);
        // Shell tak dikenal pada tugas bertingkup tetap: worktree terisolasi menjadi batasnya, bukan daftar path.
        if (t.fixed && shell) { touch(t, meta.pid); return t; }
        if (t.fixed) { const bad = paths.filter(p => !t.scopes.some(s => s === '.' || p === s || p.startsWith(s + '/'))); if (bad.length) throw new CoordError('OUT_OF_SCOPE', `Di luar lingkup tugas ${id}: ${bad.slice(0, 5).join(', ')}`); }
        else { const c = conflict(state, id, worktree, paths); if (c) throw new CoordError('SCOPE_CONFLICT', `Path ${c.wanted} dimiliki tugas ${c.task} (${c.scope}) di worktree yang sama. Tunggu, pakai worktree terpisah, atau minta pengguna.`); }
        if (!t.fixed) { if (ephemeralId) t.ephemeral[ephemeralId] = paths; else for (const p of paths) if (!t.scopes.includes(p)) t.scopes.push(p); }
        touch(t, meta.pid); audit('claim', {task: id, paths, ephemeral: !!ephemeralId});
        return t;
      });
    },
    unclaim(id, ephemeralId) { return tx(state => { const t = state.tasks[id]; if (t && t.ephemeral[ephemeralId]) { delete t.ephemeral[ephemeralId]; touch(t); audit('unclaim', {task: id, toolId: ephemeralId}); } }); },
    renew(id, pid) { return tx(state => { const t = state.tasks[id]; if (t) touch(t, pid); return !!t; }); },
    // Lepas tugas; ditolak selama ada anak aktif yang masih membutuhkan lingkupnya.
    release(id, {force = false} = {}) {
      return tx(state => {
        const live = children(state, id).map(c => c.id);
        if (live.length && !force) { audit('release-refused', {task: id, children: live}); return {released: false, reason: 'ACTIVE_CHILDREN', children: live}; }
        if (!state.tasks[id]) return {released: true};
        delete state.tasks[id]; audit('release', {task: id}); return {released: true};
      });
    },
    get(id) { return tx(state => state.tasks[id] ?? null); },
    list() { return tx(state => Object.values(state.tasks)); },
  };
}

export {canonical, within};

if(process.argv[1]&&canonical(process.argv[1])===canonical(fileURLToPath(import.meta.url))){
  try{
    if(process.argv.length!==3||process.argv[2]!=='status')throw Error('Gunakan: node .agents/hooks/coord.mjs status');
    const dir=path.join(commonDir(fileURLToPath(new URL('../../',import.meta.url))),'msa-coord'),statePath=path.join(dir,'state.json');
    // Status membaca snapshot terakhir tanpa mengambil mutex, memperbarui lease, atau membersihkan tugas.
    const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{version:2,tasks:{}};
    if(state.version!==2||!state.tasks||typeof state.tasks!=='object'||Array.isArray(state.tasks))throw Error('State koordinasi tidak kompatibel.');
    process.stdout.write(JSON.stringify({mode:'task-scoped',statePath,leaseMs:LEASE_MS,tasks:Object.values(state.tasks),mutex:existsSync(path.join(dir,'mutex'))},null,2)+'\n');
  }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
