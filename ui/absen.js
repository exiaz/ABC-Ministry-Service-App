// Layar absen ABC MSA: rute hash, render dari data contoh, tanda absen, laci, menu.
// Tidak ada backend: "Simpan absen" hanya menyimpan di memori halaman ini.
import { REF, siswa, KEADAAN, LABEL, riwayat, kelompok, rundown } from './absen-data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (n) => `<svg class="ic" aria-hidden="true"><use href="assets/icons/ui-sprite.svg#ui-i-${n}"/></svg>`;
const fmtTgl = (iso, o) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...o }).format(new Date(`${iso}T00:00:00Z`));
const TGL_PANJANG = fmtTgl(REF.tanggal, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^(\w+) /, '$1, ');
const params = new URLSearchParams(location.search);
const MODE_DAFTAR = params.get('daftar'); // memuat | galat | kosong, untuk memeriksa keadaan
let gagalSimpan = params.get('simpan') === 'galat';

const IKON_KEADAAN = { hadir: 'circle-check', izin: 'circle-alert', tidak: 'circle-x', belum: 'info' };
const PIL = { hadir: 'pos', izin: 'warn', tidak: 'neg', belum: '' };
const state = { filter: 'semua', q: '', expanded: false, save: 'idle', sort: { key: 'nama', dir: 1 }, qSiswa: '', bulan: 11, cap: 11 };
let nextId = siswa.length + 1;

const hitung = () => Object.fromEntries(KEADAAN.map((k) => [k, siswa.filter((s) => s.sekarang === k).length]));
const kotor = () => siswa.filter((s) => s.sekarang !== s.tersimpan);
const inisial = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');
const hariKe = (b, h) => Math.round((Date.UTC(2026, b - 1, h) - Date.parse(`${REF.tanggal}T00:00:00Z`)) / 864e5);
const tglUlang = (b, h) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(2026, b - 1, h)));
const BULAN = { 11: 'November', 12: 'Desember' };
const menit = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const avatar = (s) => `<span class="avatar" style="--h:${s.hue}" aria-hidden="true">${esc(inisial(s.nama))}</span>`;
const notice = (teks) => `<p class="notice" role="note">${ic('info')}<span>Sample data. ${esc(teks)}</span></p>`;

/* ---------- menu (tanggal, kelompok) ---------- */
const MENUS = {
  grup: [
    { label: 'Kelompok Merpati', sub: `${siswa.length} siswa`, on: true },
    { label: 'Kelompok Elang', sub: 'Contoh belum ada', off: true },
    { label: 'Kelompok Camar', sub: 'Contoh belum ada', off: true },
  ],
  tanggal: [
    { label: TGL_PANJANG, sub: 'Hari ini', on: true },
    { label: 'Minggu, 1 November 2026', sub: `Ditutup, ${riwayat[1].hadir} hadir`, off: true },
    { label: 'Minggu, 25 Oktober 2026', sub: `Ditutup, ${riwayat[0].hadir} hadir`, off: true },
  ],
};
const menuHtml = (id, trigger, label, icon) => `<span class="menu-wrap" data-menu-wrap="${id}" style="position:relative;display:inline-flex"><button type="button" class="btn" aria-haspopup="menu" aria-expanded="false" data-menu="${id}">${ic(icon)}<span class="lbl"><span class="long">${esc(label[0])}</span><span class="short">${esc(label[1])}</span></span>${ic('chevron-down')}</button><div class="menu" role="menu" hidden>${MENUS[id].map((m) => `<button type="button" role="menuitemradio" aria-checked="${!!m.on}" ${m.off ? 'aria-disabled="true"' : ''}><span>${esc(m.label)}</span><small>${esc(m.sub)}</small></button>`).join('')}</div></span>`;
function tutupMenu(fokus) {
  $$('.menu:not([hidden])').forEach((m) => { m.hidden = true; const b = m.previousElementSibling; b.setAttribute('aria-expanded', 'false'); if (fokus) b.focus(); });
}

/* ---------- laci ---------- */
let laci = null;
function bukaLaci({ judul, isi, onSubmit, pemicu, kirim = 'Simpan' }) {
  const root = $('#drawer-root');
  root.innerHTML = `<div class="scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="laci-judul"><h2 id="laci-judul">${esc(judul)}</h2><form novalidate>${isi}<div class="foot"><button type="button" class="btn" data-tutup>Batal</button><button type="submit" class="btn primary">${esc(kirim)}</button></div></form></aside>`;
  laci = { pemicu, onSubmit };
  $('#main').inert = true; $('.sidebar').inert = true; $('.topbar').inert = true;
  requestAnimationFrame(() => { $('.scrim', root).classList.add('open'); $('.drawer', root).classList.add('open'); });
  ($('input, button.chips-first, [data-first]', root) || $('[data-tutup]', root)).focus();
}
function tutupLaci() {
  if (!laci) return;
  const { pemicu } = laci; laci = null;
  $('#drawer-root').innerHTML = '';
  $('#main').inert = false; $('.topbar').inert = false; syncSidebar();
  if (pemicu) $(pemicu)?.focus();
}

/* ---------- navigasi ---------- */
const NAV = [
  { grup: 'Pelayanan', items: [['#/', 'Absen', 'clipboard-check'], ['#/rundown', 'Rundown', 'list-checks']] },
  { grup: 'Pengelolaan', items: [['#/siswa', 'Siswa', 'users'], ['#/ulang-tahun', 'Ulang tahun', 'calendar-days'], ['#/kelompok', 'Kelompok', 'school']] },
];
const mq = matchMedia('(max-width: 1100px)');
let navTerbuka = false;
function syncSidebar() { const s = $('#sidebar'); s.inert = mq.matches && !navTerbuka; }
function bukaNav() { navTerbuka = true; $('#sidebar').classList.add('open'); $('#open-nav').setAttribute('aria-expanded', 'true'); syncSidebar(); $('#main').inert = true; $('#close-nav').focus(); }
function tutupNav(fokus = true) { if (!navTerbuka) return; navTerbuka = false; $('#sidebar').classList.remove('open'); $('#open-nav').setAttribute('aria-expanded', 'false'); $('#main').inert = false; syncSidebar(); if (fokus) $('#open-nav').focus(); }
function renderNav(rute) {
  $('#nav').innerHTML = NAV.map((g) => `<p class="group-label">${g.grup}</p>${g.items.map(([h, l, i]) => `<a class="nav-item" href="${h}" ${h === rute ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`).join('')}`).join('');
  $('#switcher-slot').innerHTML = `<span class="menu-wrap" data-menu-wrap="grup" style="position:relative;display:block"><button type="button" class="btn switch-btn" aria-haspopup="menu" aria-expanded="false" data-menu="grup"><span><b style="font-weight:500">${esc(REF.sekolah)}</b><small>Kelompok ${esc(REF.kelompok)}</small></span>${ic('chevron-down')}</button><div class="menu" role="menu" hidden>${MENUS.grup.map((m) => `<button type="button" role="menuitemradio" aria-checked="${!!m.on}" ${m.off ? 'aria-disabled="true"' : ''}><span>${esc(m.label)}</span><small>${esc(m.sub)}</small></button>`).join('')}</div></span>`;
}

/* ---------- pil simpan ---------- */
function pilSimpan() {
  const n = kotor().length;
  if (state.save === 'saving') return `<span class="pill">${ic('loader-circle')}Menyimpan</span>`;
  if (state.save === 'error') return `<span class="pill neg">${ic('circle-x')}Gagal menyimpan</span>`;
  if (n) return `<span class="pill warn">${ic('circle-alert')}${n} perubahan belum disimpan</span>`;
  if (state.save === 'saved') return `<span class="pill pos">${ic('circle-check')}Tersimpan</span>`;
  return `<span class="pill">${ic('info')}Tidak ada perubahan</span>`;
}

/* ---------- tampilan Absen ---------- */
function temuan() {
  const belum = siswa.filter((s) => s.sekarang === 'belum');
  if (!belum.length) return 'Semua siswa sudah ditandai.';
  return belum.length === 1 ? `${belum[0].nama} belum ditandai.` : `${belum.length} siswa belum ditandai, mulai dari ${belum[0].nama}.`;
}
const tampil = () => {
  const q = state.q.trim().toLowerCase();
  return siswa.filter((s) => (state.filter === 'semua' || s.sekarang === state.filter) && (!q || s.nama.toLowerCase().includes(q))).sort((a, b) => (b.sekarang === 'belum') - (a.sekarang === 'belum'));
};
function barisSiswa(s) {
  const sub = [`Kelas ${s.kelas}`, s.sekarang === 'belum' ? 'Belum ditandai' : '', s.sekarang !== s.tersimpan ? 'Belum disimpan' : ''].filter(Boolean).join(' · ');
  const sedang = state.save === 'saving';
  const tombol = ['hadir', 'izin', 'tidak'].map((k) => `<button type="button" data-set="${k}" data-key="${s.id}-${k}" aria-pressed="${s.sekarang === k}" ${sedang ? 'disabled' : ''}>${ic(IKON_KEADAAN[k])}<span>${LABEL[k]}</span></button>`).join('');
  return `<li class="siswa-row" data-id="${s.id}" ${sedang ? 'data-sedang="1"' : ''}>${avatar(s)}<span class="who"><b>${esc(s.nama)}</b><small>${esc(sub)}</small></span><div class="seg" role="group" aria-label="Absen ${esc(s.nama)}">${tombol}</div></li>`;
}
function isiDaftar() {
  if (MODE_DAFTAR === 'memuat') return `<div class="list-state" aria-busy="true" aria-label="Memuat daftar siswa">${'<div class="skeleton"></div>'.repeat(6)}</div>`;
  if (MODE_DAFTAR === 'galat') return `<div class="err" role="alert">${ic('circle-x')}<span>Daftar siswa gagal dimuat. Data terakhir baik pukul 09.14.</span><button type="button" class="btn" data-ulang>Coba lagi</button></div>`;
  const semua = MODE_DAFTAR === 'kosong' ? [] : tampil();
  if (!semua.length) return `<p class="empty">${MODE_DAFTAR === 'kosong' || (!state.q && state.filter === 'semua') ? 'Belum ada siswa di kelompok ini.' : state.q ? `Tidak ada siswa bernama “${esc(state.q)}”.` : `Tidak ada siswa dengan keadaan ${LABEL[state.filter].toLowerCase()}.`}</p>`;
  const lihat = state.expanded ? semua : semua.slice(0, state.cap);
  return `<ul class="siswa-rows" aria-label="Daftar siswa">${lihat.map(barisSiswa).join('')}</ul>`;
}
function footDaftar() {
  const n = MODE_DAFTAR ? 0 : tampil().length;
  if (n <= state.cap) return '';
  return `<button type="button" class="card-link" id="lihat" aria-expanded="${state.expanded}">${state.expanded ? 'Tampilkan lebih sedikit' : `Lihat semua ${n}`}</button>`;
}
const kotakHtml = (s) => `<li class="kotak" data-k="${s.sekarang}" data-id="${s.id}" title="${esc(s.nama)}: ${LABEL[s.sekarang].toLowerCase()}">${ic('x')}<span class="sr">${esc(s.nama)}: ${LABEL[s.sekarang].toLowerCase()}</span></li>`;
function kehadiranHtml() {
  const c = hitung();
  return `<section class="panel kehadiran" aria-labelledby="h-kehadiran"><header class="kh-head"><h2 id="h-kehadiran">Kehadiran</h2><span class="meta">${esc(fmtTgl(REF.tanggal, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></header>
  <p class="kpi-value big"><span id="k-hadir">${c.hadir}</span> <small id="k-total">dari ${siswa.length} hadir</small></p>
  <ul class="garis" id="garis" aria-label="Garis absen, satu kotak per siswa">${siswa.map(kotakHtml).join('')}</ul>
  <ul class="legend-k" id="legend-k">${KEADAAN.map((k) => `<li><span class="kotak" data-k="${k}">${ic('x')}</span>${LABEL[k]}${k === 'hadir' ? '' : `<b data-c="${k}">${c[k]}</b>`}</li>`).join('')}</ul>
  <div class="card-foot"><button type="button" class="card-link" id="ke-belum">Lihat siswa belum ditandai</button></div></section>`;
}
function mingguHtml() {
  const c = hitung(), prev = riwayat.at(-1), selisih = prev.hadir - c.hadir;
  const rata = Math.round((riwayat.reduce((a, r) => a + r.hadir, 0) + c.hadir) / (riwayat.length + 1));
  const tglPrev = fmtTgl(prev.tanggal, { day: 'numeric', month: 'long' });
  const banding = selisih > 0 ? `<span class="neg">${selisih} lebih sedikit</span>` : selisih < 0 ? `${-selisih} lebih banyak` : 'sama banyak';
  return `<section class="panel minggu" aria-labelledby="h-minggu"><header><h2 id="h-minggu">Hadir per Minggu</h2><span class="meta">3 Minggu terakhir</span></header><div class="chart chart-week" id="chart-minggu"></div>
  <p class="summary-line" id="minggu-teks">${c.hadir} hadir hari ini, ${banding} dari Minggu ${esc(tglPrev)} (${prev.hadir}). Rata-rata tiga Minggu: ${rata} siswa.</p>
  <div class="card-foot"><a class="card-link" href="#/kelompok">Lihat riwayat</a></div></section>`;
}
function gambarMinggu() {
  const host = $('#chart-minggu'); if (!host || !window.Charts) return;
  const baru = host.cloneNode(false); host.replaceWith(baru);
  const c = hitung();
  const labels = [...riwayat.map((r) => fmtTgl(r.tanggal, { day: 'numeric', month: 'short' })), fmtTgl(REF.tanggal, { day: 'numeric', month: 'short' })];
  window.Charts.bars(baru, { labels, values: [...riwayat.map((r) => r.hadir), c.hadir], highlight: 2, height: 160, tickFormat: window.Charts.fmt.int });
}
function ulangHtml() {
  const dekat = siswa.filter((s) => s.lahir).map((s) => ({ s, h: hariKe(s.lahir.bulan, s.lahir.hari) })).filter((x) => x.h >= 0 && x.h <= 14).sort((a, b) => a.h - b.h);
  return `<section class="panel ulang" aria-labelledby="h-ulang"><header><h2 id="h-ulang">Ulang tahun</h2><a class="card-link" href="#/ulang-tahun">Lihat semua</a></header>
  ${dekat.length ? `<ul class="rows-b">${dekat.map(({ s, h }) => `<li>${avatar(s)}<span class="who"><b style="font-weight:500">${esc(s.nama)}</b><small>${esc(tglUlang(s.lahir.bulan, s.lahir.hari))}</small></span><span class="when">${h === 0 ? 'Hari ini' : `dalam ${h} hari`}</span></li>`).join('')}</ul>` : '<p class="empty">Tidak ada ulang tahun dalam 14 hari.</p>'}</section>`;
}
function viewAbsen() {
  const c = hitung();
  const jmlTab = { semua: siswa.length, belum: c.belum, izin: c.izin };
  return `<div class="title-row has-save"><div><h1 id="h1" tabindex="-1">Absen hari ini</h1><p class="sub" id="temuan">${esc(temuan())}</p></div><div class="title-actions"><span id="pil-simpan" role="status" aria-live="polite">${pilSimpan()}</span><button type="button" class="btn primary" id="simpan" ${kotor().length && state.save !== 'saving' ? '' : 'disabled'}>${state.save === 'saving' ? 'Menyimpan' : 'Simpan absen'}</button></div></div>
  ${notice(`${TGL_PANJANG}, ${REF.sekolah}, Kelompok ${REF.kelompok}. Nama dan angka di layar ini hanya contoh.`)}
  <div class="context-row">${menuHtml('tanggal', 'tanggal', [TGL_PANJANG, fmtTgl(REF.tanggal, { day: 'numeric', month: 'short', year: 'numeric' })], 'calendar')}${menuHtml('grup', 'grup', [`Kelompok ${REF.kelompok}`, REF.kelompok], 'users')}</div>
  <div class="layout"><div class="col-main"><section class="panel daftar" aria-labelledby="h-daftar"><header><h2 id="h-daftar">Siswa ${esc(REF.kelompok)}</h2><button type="button" class="btn" id="sisa-hadir" ${c.belum && !MODE_DAFTAR ? '' : 'disabled'}>Tandai sisanya hadir</button></header>
  <div class="list-tools"><div class="search">${ic('search')}<input class="input" type="search" id="cari" placeholder="Cari siswa" aria-label="Cari siswa" autocomplete="off" value="${esc(state.q)}"></div>
  <div class="tabs" role="tablist" aria-label="Saring siswa" id="tabs">${[['semua', 'Semua'], ['belum', 'Belum ditandai'], ['izin', 'Izin']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.filter === k}">${l} <span class="num" data-n="${k}">${jmlTab[k]}</span></button>`).join('')}<span class="ink" aria-hidden="true"></span></div></div>
  <div id="daftar-isi">${isiDaftar()}</div><div class="card-foot" id="daftar-foot">${footDaftar()}</div></section></div>
  <div class="col-side">${kehadiranHtml()}${mingguHtml()}${ulangHtml()}</div></div>`;
}
function setelahAbsen() { letakkanInk(); gambarMinggu(); }

/* menyegarkan bagian yang bergantung pada tanda, tanpa menggambar ulang baris yang sedang difokus */
function segarkan(idBaris) {
  const c = hitung();
  $('#k-hadir').textContent = c.hadir; $('#k-total').textContent = `dari ${siswa.length} hadir`;
  $$('#garis .kotak').forEach((el) => { const s = siswa.find((x) => x.id === el.dataset.id); el.dataset.k = s.sekarang; el.title = `${s.nama}: ${LABEL[s.sekarang].toLowerCase()}`; $('.sr', el).textContent = el.title; });
  KEADAAN.forEach((k) => { const b = $(`#legend-k [data-c="${k}"]`); if (b) b.textContent = c[k]; });
  const n = { semua: siswa.length, belum: c.belum, izin: c.izin };
  Object.entries(n).forEach(([k, v]) => { const e = $(`[data-n="${k}"]`); if (e) e.textContent = v; });
  $('#temuan').textContent = temuan();
  const sisa = $('#sisa-hadir'); if (sisa) sisa.disabled = !c.belum || !!MODE_DAFTAR;
  segarkanSimpan();
  const s = siswa.find((x) => x.id === idBaris);
  if (s) { const li = $(`li[data-id="${s.id}"]`); if (li) { $$('.seg button', li).forEach((b) => b.setAttribute('aria-pressed', String(s.sekarang === b.dataset.set))); $('small', li).textContent = [`Kelas ${s.kelas}`, s.sekarang === 'belum' ? 'Belum ditandai' : '', s.sekarang !== s.tersimpan ? 'Belum disimpan' : ''].filter(Boolean).join(' · '); } }
  const mt = $('#minggu-teks'); if (mt) { const host = $('#minggu-teks').closest('.panel'); host.outerHTML = mingguHtml(); gambarMinggu(); }
}
function segarkanSimpan() {
  const p = $('#pil-simpan'); if (p) p.innerHTML = pilSimpan();
  const b = $('#simpan'); if (b) { b.disabled = !kotor().length || state.save === 'saving'; b.textContent = state.save === 'saving' ? 'Menyimpan' : 'Simpan absen'; }
}
function render_daftar() { $('#daftar-isi').innerHTML = isiDaftar(); $('#daftar-foot').innerHTML = footDaftar(); }
function letakkanInk() {
  const t = $('#tabs'); if (!t) return; const a = $('[aria-selected="true"]', t), ink = $('.ink', t); if (!a || !ink) return;
  ink.style.width = `${a.offsetWidth}px`; ink.style.transform = `translateX(${a.offsetLeft}px)`;
}
function tandai(id, k) {
  const s = siswa.find((x) => x.id === id); if (!s) return;
  s.sekarang = k; if (state.save === 'saved' || state.save === 'error') state.save = 'idle';
  segarkan(id);
}
async function simpan() {
  if (!kotor().length || state.save === 'saving') return;
  state.save = 'saving'; segarkanSimpan(); $$('.seg button').forEach((b) => { b.disabled = true; });
  await new Promise((r) => setTimeout(r, 700));
  if (gagalSimpan) { gagalSimpan = false; state.save = 'error'; $$('.seg button').forEach((b) => { b.disabled = false; }); segarkanSimpan();
    if (!$('#galat-simpan')) $('#daftar-isi').insertAdjacentHTML('afterbegin', `<div class="err" id="galat-simpan" role="alert">${ic('circle-x')}<span>Absen belum tersimpan. Tanda di layar ini masih ada.</span><button type="button" class="btn" id="coba-simpan">Coba lagi</button></div>`);
    return; }
  siswa.forEach((s) => { s.tersimpan = s.sekarang; }); state.save = 'saved'; $('#galat-simpan')?.remove();
  render_daftar(); segarkan(); $('#h1')?.focus({ preventScroll: true });
}

/* ---------- tampilan admin ---------- */
function barisTabel(s) {
  return `<tr data-id="${s.id}"><td>${esc(s.nama)}<span class="mono" style="display:block">${s.id}</span></td><td class="m" data-l="Kelompok">${esc(s.kelompok)}</td><td class="m" data-l="Mentor">${esc(s.mentor)}</td><td class="n">${esc(s.kelas)}</td></tr>`;
}
function tabelSiswa() {
  const q = state.qSiswa.trim().toLowerCase(), { key, dir } = state.sort;
  const rows = siswa.filter((s) => !q || s.nama.toLowerCase().includes(q)).sort((a, b) => a[key].localeCompare(b[key], 'id') * dir || a.nama.localeCompare(b.nama, 'id'));
  const sortTh = (k, l, cls = '') => `<th class="sortable ${cls}" aria-sort="${state.sort.key === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${k}">${l}${ic('chevron-down')}</button></th>`;
  return { n: rows.length, html: rows.length ? `<div class="table-wrap"><table class="stack-table"><thead><tr>${sortTh('nama', 'Nama')}<th>Kelompok</th><th>Mentor</th>${sortTh('kelas', 'Kelas', 'n')}</tr></thead><tbody>${rows.map(barisTabel).join('')}</tbody></table></div>` : `<p class="empty">Tidak ada siswa bernama “${esc(state.qSiswa)}”.</p>` };
}
function viewSiswa() {
  const t = tabelSiswa(), total = kelompok.reduce((a, g) => a + (g.jumlah ?? siswa.length), 0);
  return `<div class="title-row"><div><h1 id="h1" tabindex="-1">Siswa</h1><p class="sub" id="siswa-sub">${t.n} dari ${siswa.length} siswa Kelompok ${esc(REF.kelompok)}</p></div><div class="title-actions"><button type="button" class="btn primary" id="tambah">Tambah siswa</button></div></div>
  ${notice(`${siswa.length} siswa Kelompok ${REF.kelompok} dan angka kelompok lain hanya contoh.`)}
  <div class="split"><section class="panel" aria-labelledby="h-tabel"><header><h2 id="h-tabel">Daftar siswa</h2></header><div class="search" style="margin-bottom:8px">${ic('search')}<input class="input" type="search" id="cari-siswa" placeholder="Cari siswa" aria-label="Cari siswa" autocomplete="off" value="${esc(state.qSiswa)}"></div><div id="tabel-siswa">${t.html}</div></section>
  <section class="panel" aria-labelledby="h-kel"><header><h2 id="h-kel">Per kelompok</h2></header><ul class="rows-b">${kelompok.map((g) => `<li><span class="who"><b style="font-weight:500">${esc(g.nama)}</b><small>${esc(g.mentor)}</small></span><span class="num">${g.jumlah ?? siswa.length} siswa</span></li>`).join('')}<li><span class="who"><b style="font-weight:500">Seluruh sekolah</b><small>${esc(REF.sekolah)}</small></span><span class="num">${total} siswa</span></li></ul></section></div>`;
}
const lahirPer = (b) => siswa.filter((s) => s.lahir && s.lahir.bulan === b).sort((a, c) => a.lahir.hari - c.lahir.hari);
function listaUlang() {
  const daftar = lahirPer(state.bulan);
  return daftar.length ? `<ul class="rows-b">${daftar.map((s) => { const h = hariKe(s.lahir.bulan, s.lahir.hari); return `<li>${avatar(s)}<span class="who"><b style="font-weight:500">${esc(s.nama)}</b><small>${esc(tglUlang(s.lahir.bulan, s.lahir.hari))}</small></span><span class="when">Usia ${s.lahir.usia} tahun<br>dalam ${h} hari</span></li>`; }).join('')}</ul>` : `<p class="empty">Tidak ada ulang tahun di ${BULAN[state.bulan]}.</p>`;
}
const aksiBulan = () => (state.bulan === 11 ? '<button type="button" class="btn" id="bulan-depan">Bulan berikutnya</button>' : '');
function viewUlang() {
  const per = lahirPer;
  return `<div class="title-row"><div><h1 id="h1" tabindex="-1">Ulang tahun</h1><p class="sub">${per(11).length} siswa di November, ${per(12).length} di Desember</p></div></div>
  ${notice('Tanggal ulang tahun contoh. Tanggal lahir lengkap hanya untuk admin berwenang.')}
  <div class="split"><section class="panel" aria-labelledby="h-ulang-v"><header><h2 id="h-ulang-v">Ulang tahun ${BULAN[state.bulan]}</h2><span id="bulan-aksi">${aksiBulan()}</span></header>
  <div class="tabs" role="tablist" aria-label="Bulan" id="tabs">${[11, 12].map((b) => `<button type="button" role="tab" data-bulan="${b}" aria-selected="${state.bulan === b}">${BULAN[b]} <span class="num">${per(b).length}</span></button>`).join('')}<span class="ink" aria-hidden="true"></span></div>
  <div id="ulang-isi">${listaUlang()}</div></section>
  <section class="panel" aria-labelledby="h-ring"><header><h2 id="h-ring">Ringkasan</h2></header><ul class="rows-b"><li><span class="who"><b style="font-weight:500">November</b><small>Setelah ${esc(fmtTgl(REF.tanggal, { day: 'numeric', month: 'long' }))}</small></span><span class="num">${per(11).length} siswa</span></li><li><span class="who"><b style="font-weight:500">Desember</b><small>Seluruh bulan</small></span><span class="num">${per(12).length} siswa</span></li></ul></section></div>`;
}
function pilihBulan(b) {
  state.bulan = b; $$('[data-bulan]').forEach((x) => x.setAttribute('aria-selected', String(+x.dataset.bulan === b)));
  letakkanInk(); $('#h-ulang-v').textContent = `Ulang tahun ${BULAN[b]}`; $('#bulan-aksi').innerHTML = aksiBulan(); $('#ulang-isi').innerHTML = listaUlang();
}
function viewRundown() {
  const now = menit(REF.jamSekarang), aktif = rundown.find((r) => menit(r.mulai) <= now && now < menit(r.selesai));
  const sisa = aktif ? menit(aktif.selesai) - now : null;
  return `<div class="title-row"><div><h1 id="h1" tabindex="-1">Rundown</h1><p class="sub">${esc(TGL_PANJANG)}, ${rundown.length} acara</p></div><div class="title-actions"><button type="button" class="btn primary" id="ubah-rundown">Ubah rundown</button></div></div>
  ${notice(`Rundown ${TGL_PANJANG} dan jam sekarang ${REF.jamSekarang} hanya contoh.`)}
  <div class="split"><section class="panel" aria-labelledby="h-rd"><header><h2 id="h-rd">Urutan acara</h2></header><div class="table-wrap"><table class="stack-table"><thead><tr><th class="n">Jam</th><th>Acara</th><th>Petugas</th></tr></thead><tbody>${rundown.map((r) => `<tr class="${r === aktif ? 'now' : ''}"><td class="n"><span class="num">${r.mulai}</span><span class="num dash"> sampai ${r.selesai}</span></td><td>${esc(r.acara)}${r === aktif ? ' <span class="nowtag">Berlangsung</span>' : ''}</td><td class="m" data-l="Petugas">${esc(r.petugas)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="panel" aria-labelledby="h-now"><header><h2 id="h-now">Sekarang</h2><span class="meta num">${REF.jamSekarang}</span></header>${aktif ? `<p class="kpi-value big" style="font-size:var(--fs-section)">${esc(aktif.acara)}</p><p class="summary-line">${esc(aktif.petugas)} bertugas. Selesai ${aktif.selesai}, ${sisa} menit lagi.</p>` : '<p class="empty">Tidak ada acara yang berlangsung.</p>'}</section></div>`;
}
function viewKelompok() {
  const dg = kelompok.filter((g) => g.pengganti);
  return `<div class="title-row"><div><h1 id="h1" tabindex="-1">Kelompok</h1><p class="sub">${kelompok.length} kelompok di ${esc(REF.sekolah)}</p></div><div class="title-actions"><button type="button" class="btn primary" id="atur-pengganti">Atur pengganti</button></div></div>
  ${notice(`${kelompok.length} kelompok dan nama mentor hanya contoh.`)}
  <div class="split"><section class="panel" aria-labelledby="h-kl"><header><h2 id="h-kl">Mentor per kelompok</h2></header><div class="table-wrap"><table class="stack-table"><thead><tr><th>Kelompok</th><th>Mentor tetap</th><th>Pengganti Minggu ini</th><th class="n">Siswa</th></tr></thead><tbody>${kelompok.map((g) => `<tr><td>${esc(g.nama)}</td><td class="m" data-l="Mentor tetap">${esc(g.mentor)}</td><td class="m" data-l="Pengganti">${g.pengganti ? esc(g.pengganti) : '<span class="dash">-</span>'}</td><td class="n">${g.jumlah ?? siswa.length}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="panel" aria-labelledby="h-eff"><header><h2 id="h-eff">Pengganti berlaku</h2></header>${dg.length ? `<ul class="rows-b">${dg.map((g) => `<li><span class="who"><b style="font-weight:500">${esc(g.nama)}</b><small>${esc(g.pengganti)}</small></span><span class="when">${esc(fmtTgl(REF.tanggal, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></li>`).join('')}</ul>` : '<p class="empty">Tidak ada pengganti Minggu ini.</p>'}</section></div>`;
}

const VIEWS = {
  '#/': { nama: 'Absen', judul: 'Absen hari ini', html: viewAbsen, after: setelahAbsen },
  '#/siswa': { nama: 'Siswa', judul: 'Siswa', html: viewSiswa },
  '#/ulang-tahun': { nama: 'Ulang tahun', judul: 'Ulang tahun', html: viewUlang, after: letakkanInk },
  '#/rundown': { nama: 'Rundown', judul: 'Rundown', html: viewRundown },
  '#/kelompok': { nama: 'Kelompok', judul: 'Kelompok', html: viewKelompok },
};
let ruteSaatIni = null;
function render(pindahFokus = true) {
  const rute = VIEWS[location.hash] ? location.hash : '#/', v = VIEWS[rute];
  const baru = rute !== ruteSaatIni; ruteSaatIni = rute;
  tutupMenu(false); renderNav(rute);
  $('#main').innerHTML = v.html(); $('#topbar-name').textContent = v.nama; document.title = `${v.judul} · ABC MSA`;
  v.after?.();
  if (baru && pindahFokus) { window.scrollTo(0, 0); $('#h1')?.focus({ preventScroll: true }); }
}

/* ---------- laci: isi ---------- */
function laciTambah() {
  bukaLaci({ judul: 'Tambah siswa', pemicu: '#tambah', kirim: 'Tambah', isi: `<div class="field"><label for="f-nama">Nama siswa</label><input class="input" id="f-nama" name="nama" autocomplete="off" aria-describedby="f-err"><span class="err-text" id="f-err" role="alert"></span></div><div class="field"><span id="f-kelas-l" style="font-weight:500">Kelas</span><div class="chips" role="group" aria-labelledby="f-kelas-l">${['4A', '4B', '5A', '5B'].map((k, i) => `<button type="button" data-kelas="${k}" aria-pressed="${i === 0}">${k}</button>`).join('')}</div></div><p class="summary-line">Masuk ke Kelompok ${esc(REF.kelompok)} dengan keadaan belum ditandai.</p>`,
    onSubmit(f) {
      const nama = f.nama.value.trim(), kelas = $('.chips [aria-pressed="true"]')?.dataset.kelas || '4A', err = $('#f-err');
      if (!nama) { err.textContent = 'Tulis nama siswa.'; f.nama.focus(); return false; }
      if (siswa.some((s) => s.nama.toLowerCase() === nama.toLowerCase())) { err.textContent = 'Nama ini sudah ada di kelompok.'; f.nama.focus(); return false; }
      siswa.push({ id: `S-${String(nextId++).padStart(4, '0')}`, nama, kelas, kelompok: REF.kelompok, mentor: REF.mentor, hue: ((siswa.length) * 137) % 360, lahir: null, sekarang: 'belum', tersimpan: 'belum' });
      return true;
    } });
}
function laciRundown() {
  bukaLaci({ judul: 'Ubah rundown', pemicu: '#ubah-rundown', isi: rundown.map((r, i) => `<div class="field"><label for="p-${i}">${esc(r.acara)} <span class="num" style="color:var(--muted)">${r.mulai}</span></label><input class="input" id="p-${i}" data-i="${i}" value="${esc(r.petugas)}" autocomplete="off"></div>`).join(''),
    onSubmit() { let ok = true; $$('.drawer input').forEach((inp) => { if (!inp.value.trim()) { ok = false; inp.focus(); } else rundown[+inp.dataset.i].petugas = inp.value.trim(); }); return ok; } });
}
function laciPengganti() {
  bukaLaci({ judul: 'Atur pengganti', pemicu: '#atur-pengganti', isi: `<div class="field"><span id="g-l" style="font-weight:500">Kelompok</span><div class="chips" role="group" aria-labelledby="g-l">${kelompok.map((g, i) => `<button type="button" data-grup="${i}" aria-pressed="${i === 1}">${esc(g.nama)}</button>`).join('')}</div></div><div class="field"><label for="g-nama">Nama pengganti</label><input class="input" id="g-nama" autocomplete="off" value="${esc(kelompok[1].pengganti || '')}"><span class="hint">Kosongkan untuk menghapus pengganti. Berlaku ${esc(TGL_PANJANG)}.</span></div>`,
    onSubmit() { const g = kelompok[+$('.chips [aria-pressed="true"]').dataset.grup]; g.pengganti = $('#g-nama').value.trim() || null; return true; } });
}

/* ---------- peristiwa ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a, [data-menu]'); if (!t) { tutupMenu(false); return; }
  if (!t.closest('.menu-wrap')) tutupMenu(false);
  if (t.matches('#open-nav')) return bukaNav();
  if (t.matches('#close-nav')) return tutupNav();
  if (t.closest('#nav a')) { tutupNav(false); return; }
  if (t.dataset.menu) { const m = t.nextElementSibling, buka = m.hidden; tutupMenu(false); m.hidden = !buka; t.setAttribute('aria-expanded', String(buka)); if (buka) ($('[aria-checked="true"]', m) || m.firstElementChild).focus(); return; }
  if (t.closest('.menu')) { if (t.getAttribute('aria-disabled') === 'true') return; tutupMenu(true); return; }
  if (t.dataset.set) { const li = t.closest('li'); tandai(li.dataset.id, t.dataset.set); return; }
  if (t.dataset.tab) { state.filter = t.dataset.tab; state.expanded = false; $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === t))); letakkanInk(); render_daftar(); return; }
  if (t.dataset.bulan) { pilihBulan(+t.dataset.bulan); return; }
  if (t.matches('#bulan-depan')) { pilihBulan(12); $('[data-bulan="12"]').focus(); return; }
  if (t.matches('#lihat')) { state.expanded = !state.expanded; render_daftar(); $('#daftar-foot').innerHTML = footDaftar(); $('#lihat')?.focus(); return; }
  if (t.matches('#ke-belum')) { state.filter = 'belum'; state.expanded = false; $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === 'belum'))); letakkanInk(); render_daftar(); $('[data-tab="belum"]').focus(); return; }
  if (t.matches('#sisa-hadir')) { siswa.forEach((s) => { if (s.sekarang === 'belum') s.sekarang = 'hadir'; }); if (state.save !== 'saving') state.save = 'idle'; render_daftar(); segarkan(); return; }
  if (t.matches('#simpan, #coba-simpan')) { $('#galat-simpan')?.remove(); return simpan(); }
  if (t.matches('[data-ulang]')) { location.search = ''; return; }
  if (t.dataset.sort) { const k = t.dataset.sort; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 }; $('#tabel-siswa').innerHTML = tabelSiswa().html; $(`[data-sort="${k}"]`).focus(); return; }
  if (t.matches('#tambah')) return laciTambah();
  if (t.matches('#ubah-rundown')) return laciRundown();
  if (t.matches('#atur-pengganti')) return laciPengganti();
  if (t.matches('[data-tutup]')) return tutupLaci();
  if (t.dataset.kelas) { $$('[data-kelas]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); return; }
  if (t.dataset.grup) { $$('[data-grup]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); $('#g-nama').value = kelompok[+t.dataset.grup].pengganti || ''; }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'cari') { state.q = e.target.value; state.expanded = false; render_daftar(); }
  if (e.target.id === 'cari-siswa') { state.qSiswa = e.target.value; const t = tabelSiswa(); $('#tabel-siswa').innerHTML = t.html; $('#siswa-sub').textContent = `${t.n} dari ${siswa.length} siswa Kelompok ${REF.kelompok}`; }
});
document.addEventListener('submit', (e) => {
  if (!laci) return; e.preventDefault();
  const ok = laci.onSubmit(e.target); if (ok === false) return;
  const pemicu = laci.pemicu; tutupLaci(); render(false); $(pemicu)?.focus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (laci) { e.preventDefault(); return tutupLaci(); }
    if ($('.menu:not([hidden])')) { e.preventDefault(); return tutupMenu(true); }
    if (navTerbuka) { e.preventDefault(); return tutupNav(); }
  }
  if (laci && e.key === 'Tab') { // fokus tetap di dalam laci
    const f = $$('.drawer button, .drawer input').filter((x) => !x.disabled); const a = f[0], z = f.at(-1);
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  const menu = document.activeElement?.closest('.menu');
  if (menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const it = $$('button', menu), i = it.indexOf(document.activeElement); it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length].focus(); }
  const tab = document.activeElement?.closest('[role="tab"]');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const it = $$('[role="tab"]', tab.parentElement), i = it.indexOf(tab); const n = it[(i + (e.key === 'ArrowRight' ? 1 : -1) + it.length) % it.length]; n.focus(); n.click(); }
});
mq.addEventListener('change', () => { if (!mq.matches) tutupNav(false); syncSidebar(); letakkanInk(); gambarMinggu(); });
addEventListener('hashchange', () => render());
addEventListener('resize', () => letakkanInk());
document.fonts?.ready.then(() => letakkanInk());
render(false); syncSidebar();
