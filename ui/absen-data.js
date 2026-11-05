// Sample data untuk layar absen ABC MSA. Semua nama fiktif; angka dihitung dari baris, bukan diketik.
// Verify before publishing: ganti seluruh isi berkas ini dengan data dari layanan sebelum dipakai nyata.

export const REF = { tanggal: '2026-11-08', sekolah: 'SD Kasih Bangsa', kelompok: 'Merpati', mentor: 'Dina Pratama', jamSekarang: '09:32' };

// kelas -> nama; hue = sudut warna tint avatar, berjarak 137 derajat antar tetangga (lebih dari 60)
const baris = [
  ['Anindya Wulandari', '4A', 'hadir', { bulan: 11, hari: 12, usia: 10 }],
  ['Bagas Setiawan', '4A', 'izin', { bulan: 11, hari: 19, usia: 9 }, 'hadir'],
  ['Cahya Tambunan', '4B', 'hadir', { bulan: 12, hari: 3, usia: 10 }],
  ['Daniel Mokodompit', '5A', 'tidak'],
  ['Evelyn Sumampouw', '4A', 'hadir'],
  ['Farrel Lengkong', '5B', 'hadir'],
  ['Grace Tampi', '4B', 'hadir'],
  ['Hizkia Rumengan', '5A', 'hadir'],
  ['Indah Permata', '4A', 'hadir'],
  ['Jonathan Kawulur', '5B', 'hadir'],
  ['Kezia Wowor', '4B', 'hadir'],
  ['Louis Sangari', '5A', 'hadir'],
  ['Maria Kalalo', '4A', 'izin'],
  ['Nathan Pandean', '5B', 'hadir'],
  ['Olivia Tulenan', '4B', 'hadir'],
  ['Putra Makalew', '5A', 'hadir'],
  ['Queenie Mamahit', '4A', 'hadir'],
  ['Rafael Pantow', '5B', 'hadir'],
  ['Selvi Karundeng', '4B', 'hadir'],
  ['Timotius Rumbayan', '5A', 'hadir'],
  ['Vina Oroh', '4A', 'hadir'],
  ['Yosua Lumentut', '5B', 'belum'],
];

export const siswa = baris.map(([nama, kelas, sekarang, lahir, tersimpan], i) => ({
  id: `S-${String(i + 1).padStart(4, '0')}`, nama, kelas, kelompok: REF.kelompok, mentor: REF.mentor,
  hue: (i * 137) % 360, lahir: lahir || null, sekarang, tersimpan: tersimpan || sekarang,
}));

export const KEADAAN = ['hadir', 'izin', 'tidak', 'belum'];
export const LABEL = { hadir: 'Hadir', izin: 'Izin', tidak: 'Tidak hadir', belum: 'Belum ditandai' };

// hadir pada Minggu sebelumnya; Minggu ini dihitung dari tanda di layar
export const riwayat = [{ tanggal: '2026-10-25', hadir: 19 }, { tanggal: '2026-11-01', hadir: 20 }];

export const kelompok = [
  { nama: 'Merpati', mentor: 'Dina Pratama', pengganti: null, jumlah: null },
  { nama: 'Elang', mentor: 'Rudi Hartono', pengganti: 'Yohanes Pangemanan', jumlah: 18 },
  { nama: 'Camar', mentor: 'Sari Manoppo', pengganti: null, jumlah: 15 },
];

export const rundown = [
  { mulai: '09:00', selesai: '09:20', acara: 'Pujian', petugas: 'Grace Lasut' },
  { mulai: '09:20', selesai: '09:50', acara: 'Firman', petugas: 'Dina Pratama' },
  { mulai: '09:50', selesai: '10:05', acara: 'Persembahan', petugas: 'Rudi Hartono' },
];

// pemeriksaan yang harus tetap benar
const hitung = (k) => siswa.filter((s) => s.sekarang === k).length;
console.assert(siswa.length === 22, 'Jumlah siswa Merpati harus 22');
console.assert(hitung('hadir') + hitung('izin') + hitung('tidak') + hitung('belum') === siswa.length, 'Hitungan keadaan harus menjumlah ke total siswa');
console.assert(hitung('hadir') === 18 && hitung('izin') === 2 && hitung('tidak') === 1 && hitung('belum') === 1, 'Ringkasan hadir 18, izin 2, tidak hadir 1, belum 1');
console.assert(new Set(siswa.map((s) => s.id)).size === siswa.length, 'ID siswa harus unik');
console.assert(riwayat[1].hadir - hitung('hadir') === 2, 'Selisih dengan 1 November harus 2');
console.assert(Math.round((riwayat[0].hadir + riwayat[1].hadir + hitung('hadir')) / 3) === 19, 'Rata-rata tiga Minggu harus 19');
console.assert(rundown.every((r, i) => i === 0 || r.mulai === rundown[i - 1].selesai), 'Rundown harus berurutan tanpa celah');
