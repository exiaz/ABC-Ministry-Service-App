export const product = 'ABC Ministry Service App';
export const finding = 'Mockup terbaru belum terverifikasi; keputusan adopsi belum dapat ditetapkan.';
export const navigation = [
  ['tinjauan', 'Tinjauan UI/UX'], ['autentikasi', 'Autentikasi'], ['absensi', 'Absensi'],
  ['siswa', 'Siswa'], ['rundown', 'Rundown'], ['sumber', 'Sumber'],
];
export const categories = ['Estetika visual', 'Usability', 'Navigasi', 'Aksesibilitas', 'Konsistensi', 'Identitas merek', 'Pengalaman mobile', 'Kelayakan implementasi']
  .map((name, index) => ({id: `category-${index}`, name, rating: null, justification: null, evidenceIds: [], assessmentState: 'unassessed'}));
export const areas = {
  autentikasi: {title: 'Autentikasi', question: 'Apakah alur masuk jelas dan memberi feedback yang tepat?', finding: 'Bukti layar terbaru belum tersedia.', topics: ['Label dan isian', 'Kesalahan masuk', 'Loading dan keberhasilan', 'Keyboard dan fokus'], scope: 'Mentor · Admin · Superadmin'},
  absensi: {title: 'Absensi', question: 'Apakah Mentor memahami sesi, pilihan kehadiran, dan hasil penyimpanan?', finding: 'Alur absensi terbaru belum diverifikasi.', topics: ['Pelayanan dan kelompok', 'Pilihan kehadiran', 'Konfirmasi penyimpanan', 'Koreksi dan riwayat'], scope: 'Mentor', referenceDirectionId: 'user-reference-4'},
  siswa: {title: 'Siswa', question: 'Apakah informasi siswa dapat ditemukan dan dikelola sesuai kewenangan?', finding: 'Bukti pengelolaan siswa belum tersedia.', topics: ['Pencarian dan kelompok', 'Formulir dan validasi', 'Akses informasi privat', 'Keadaan kosong dan gagal'], scope: 'Admin · Superadmin'},
  rundown: {title: 'Rundown', question: 'Apakah bukti rundown cukup untuk menilai urutan kegiatan dan tindakan pengguna?', finding: 'Ketersediaan layar rundown belum terverifikasi.', topics: ['Urutan dan waktu kegiatan', 'Penanggung jawab', 'Perubahan jadwal', 'Feedback dan pemulihan kesalahan'], scope: 'Peran pengelola belum diverifikasi'},
};
const allAreas = Object.keys(areas);
export const sources = [
  {id: 'logo', title: 'Logo ABC Movement', kind: 'Identitas', localPath: 'assets/abc-movement-logo.png', availability: 'available', inspectionLevel: 'Diperiksa visual', areas: allAreas, provenance: 'Aset merek existing proyek; bentuk, warna, dan proporsi dipertahankan.', selectedDirection: false, media: 'image'},
  {id: 'c10-preview', title: 'Pratinjau C10', kind: 'Baseline', localPath: 'docs/ui-overhaul/C10-preview.png', availability: 'available', inspectionLevel: 'Diperiksa visual', areas: allAreas, provenance: 'Baseline lokal yang dirujuk brief UI overhaul. Bukan pengganti mockup terbaru atau PDF Dashboard Mentor.', selectedDirection: false, media: 'image'},
  {id: 'tokens', title: 'Token aktif', kind: 'Implementasi', localPath: 'ui/msa-tokens.css', availability: 'available', inspectionLevel: 'Dibaca', areas: allAreas, provenance: 'Token implementasi proyek; bukan bukti bahwa semua alur sudah diuji.', selectedDirection: false, media: 'text'},
  {id: 'brief', title: 'Brief UI overhaul', kind: 'Dokumen', localPath: 'docs/ui-overhaul/BRIEF.md', availability: 'available', inspectionLevel: 'Dibaca', areas: allAreas, provenance: 'Acuan visual dan batas perubahan proyek.', selectedDirection: false, media: 'text'},
  {id: 'user-reference-1', catalogReferenceId: 'user-reference-1', title: 'Panduan gaya Pil', filename: 'D0 · Panduan gaya Pil (guideline).pdf', kind: 'Referensi', localPath: null, availability: 'unavailable', inspectionLevel: 'Belum dapat diperiksa', areas: allAreas, provenance: 'Nama dari katalog pengguna; berkas belum tersedia pada lokasi yang diperiksa.', selectedDirection: false},
  {id: 'user-reference-2', catalogReferenceId: 'user-reference-2', title: 'Mockup desktop sign-in dan homepage admin', filename: 'ABC Ministry Service App · Mockup UI-Dekstop sign-in, homepage admin.pdf', kind: 'Referensi', localPath: null, availability: 'unavailable', inspectionLevel: 'Belum dapat diperiksa', areas: ['autentikasi'], provenance: 'Nama dari katalog pengguna; komposisi dan interaksi belum diverifikasi.', selectedDirection: false},
  {id: 'user-reference-3', catalogReferenceId: 'user-reference-3', title: 'Mockup welcome, sign-in, dan absensi', filename: 'ABC Ministry Service App · Mockup UI-Welcome, Sign-in, absensi.pdf', kind: 'Referensi', localPath: null, availability: 'unavailable', inspectionLevel: 'Belum dapat diperiksa', areas: ['autentikasi', 'absensi'], provenance: 'Nama dari katalog pengguna; komposisi dan interaksi belum diverifikasi.', selectedDirection: false},
  {id: 'user-reference-4', catalogReferenceId: 'user-reference-4', title: 'Mockup Dashboard Mentor', filename: 'ABC Ministry Service App · Mockup UI-Dashboard Mentor.pdf', kind: 'Referensi', localPath: null, availability: 'unavailable', inspectionLevel: 'Belum dapat diperiksa', areas: ['absensi'], provenance: 'Arah referensi terpilih untuk pemeriksaan pengalaman Mentor. Pemilihan bukan pemeriksaan isi PDF.', selectedDirection: true},
];
export const findings = [];
export const recommendations = [];
export const verdict = null;
export const baseline = ['Logo asli dan identitas ABC', 'Label input terlihat', 'Status dengan ikon dan teks'];
export const baselineSummary = 'C10: identitas ABC, label input, status ikon dan teks. Perbandingan terbaru belum tersedia.';
export function filterSources({query = '', area = '', status = ''} = {}) {
  return sources.filter(source => source.title.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id'))
    && (!area || source.areas.includes(area)) && (!status || source.availability === status));
}
export function filterFindings({area = '', priority = ''} = {}) {
  return findings.filter(item => (!area || item.area === area) && (!priority || item.priority === priority));
}
export function parseRoute(hash = '') {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?');
  return {view: path || 'tinjauan', params: new URLSearchParams(search)};
}
console.assert(sources.length === 8, 'Source catalog must contain eight entries');
console.assert(sources.filter(s => s.availability === 'available').length === 4, 'Four local sources');
console.assert(sources.filter(s => s.availability === 'unavailable').length === 4, 'Four unavailable references');
console.assert(new Set(sources.map(s => s.id)).size === sources.length, 'Unique source IDs');
console.assert(categories.length === 8 && categories.every(c => c.rating === null), 'Scores remain unassessed');
console.assert(recommendations.every(r => findings.some(f => f.id === r.findingId)), 'Recommendations require evidence');
