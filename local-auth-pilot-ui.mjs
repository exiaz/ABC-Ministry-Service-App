import http from 'node:http';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=`.pilot-nav{box-sizing:border-box;font:16px/1.5 system-ui,sans-serif;background:#fff5ce;color:#173252;padding:12px 16px;border-bottom:2px solid #e6c34a;overflow-wrap:anywhere}.pilot-nav nav{display:flex;flex-wrap:wrap;gap:8px}.pilot-nav a{display:inline-flex;align-items:center;min-height:44px;padding:4px 10px;color:#124fa8;text-decoration:underline}.pilot-guide{box-sizing:border-box;max-width:900px;margin:auto;padding:20px;font:16px/1.6 system-ui,sans-serif;color:#173252;overflow-wrap:anywhere}.pilot-guide li{margin:16px 0}.pilot-guide code{white-space:normal}.pilot-guide img{width:72px;height:auto}.pilot-guide h1{font-size:clamp(24px,5vw,36px)}.pilot-guide table{border-collapse:collapse;width:100%}.pilot-guide td,.pilot-guide th{padding:8px;border:1px solid #b8cce4;text-align:left}`;

export function pilotMarkup({mentorOrigin,adminOrigin}){
  const links=[['Masuk Mentor',mentorOrigin+'/mentor-account.html'],['Daftar relawan',adminOrigin+'/register.html'],['Tinjau identitas',adminOrigin+'/identity-review.html'],['Admin / aktivasi',adminOrigin+'/username.html'],['Panduan pilot',mentorOrigin+'/pilot.html']];
  return `<style>${css}</style><aside class="pilot-nav" aria-label="Pilot data fiktif"><strong>PILOT LOKAL · DATA FIKTIF SEMENTARA</strong><nav>${links.map(([label,url])=>`<a href="${escape(url)}"${label==='Admin / aktivasi'?' target="_blank" rel="noopener noreferrer"':''}>${label}</a>`).join('')}</nav></aside>`;
}

export function pilotGuide(options){
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ABC | Panduan pilot akun</title></head><body>${pilotMarkup(options)}<main class="pilot-guide"><img src="/assets/abc-movement-logo.png" alt="ABC Movement"><p>MINISTRY SERVICE APP</p><h1>Coba alur akun Mentor</h1><p>Semua akun, sekolah dan siswa di sini fiktif. Data dimulai dari awal setiap kali pilot dinyalakan. Kata sandi peninjau dibuat di jendela peluncur.</p><ol>
<li><strong>Daftar relawan.</strong> Buat nama, nomor HP fiktif, username dan kata sandi sendiri. Simpan username dan kata sandi untuk langkah Mentor.</li>
<li><strong>Tinjau identitas.</strong> Pilih “Username akun uji”, masuk sebagai <code>peninjau.pilot</code> dengan kata sandi yang Anda buat di peluncur. Klik “Tinjau akun”. Isi cakupan pada tabel di bawah. Pilih “Setujui identitas”, isi alasan dan referensi pemeriksaan fiktif, centang konfirmasi bukti, lalu tinjau dan simpan.</li>
<li><strong>Tautkan Mentor.</strong> Pada akun yang sama, pilih “Tautkan identitas Mentor”. Isi <code>fictional-mentor</code>, cakupan yang sama, alasan dan bukti fiktif; tinjau dan simpan. Nama atau nomor yang sama saja bukan bukti identitas.</li>
<li><strong>Masuk Mentor.</strong> Gunakan username dan kata sandi relawan tadi. Login belum memberikan izin perangkat.</li>
<li><strong>Aktifkan perangkat.</strong> Buka “Admin / aktivasi” di tab lain, masuk sebagai <code>peninjau.pilot</code>. Buka pengelolaan perangkat, pilih pelayanan hari ini dan kelompok Hosea (g1), lalu terbitkan kode untuk Mentor tersebut. Masukkan kode pada halaman Mentor dan konfirmasi “Gunakan perangkat ini”. Kode sekali pakai; akses perangkat maksimal satu jam dan tidak melampaui tanggal pelayanan WIB.</li>
<li><strong>Coba absensi.</strong> Tandai siswa fiktif, lalu selesaikan dengan konfirmasi. Untuk backup Stage 6, Admin memberi perangkat aktif yang sama kelompok Obaja (g2) pada pelayanan yang sama; muat ulang kelompok di halaman Mentor. Riwayat tiap kelompok tetap terpisah.</li>
</ol><table><tr><th>Isian tinjauan</th><th>Nilai fiktif</th></tr><tr><td>ID sekolah</td><td><code>s1</code></td></tr><tr><td>ID kelompok utama</td><td><code>g1</code></td></tr><tr><td>ID pelayanan</td><td><code>fictional-a23-current</code></td></tr><tr><td>ID Mentor</td><td><code>fictional-mentor</code></td></tr><tr><td>Kelompok backup</td><td><code>g2</code></td></tr></table><p>Untuk menguji penolakan, buat relawan lain dan biarkan menunggu, tolak tinjauannya, atau setujui tanpa menautkan Mentor. Penangguhan akun tersedia di <a href="${escape(options.adminOrigin)}/a1.html">pengelolaan akun uji</a> setelah login peninjau di halaman itu. Satu identitas Mentor hanya dapat ditautkan ke satu akun.</p><p>Setelah memuat ulang halaman, masuk kembali. Jangan membuka pilot dari perangkat lain: layanan ini hanya tersedia di komputer lokal. Jika berganti hari WIB, hentikan lalu nyalakan pilot lagi.</p><p><strong>Berhenti:</strong> tekan Enter di jendela peluncur atau klik <code>Stop MSA Auth Pilot.cmd</code>. Data pilot tidak disimpan untuk pemulihan; catatan diagnostik lokal tidak berisi kata sandi atau token.</p></main></body></html>`;
}

// Private launcher wrapper only. Existing handlers still enforce every gate.
export function wrapPilotServer(inner,{mentor=false,...options}){
  return http.createServer((req,res)=>{
    if(req.url==='/pilot.html'&&['GET','HEAD'].includes(req.method)){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:pilotGuide(options));return;
    }
    if(mentor&&req.url==='/')req.url='/mentor-account.html';
    const end=res.end,writeHead=res.writeHead;let html=false;
    res.writeHead=function(status,...args){
      const headers=args.find(value=>value&&typeof value==='object');
      html=String(headers?.['Content-Type']??res.getHeader('Content-Type')).startsWith('text/html');
      return writeHead.call(this,status,...args);
    };
    res.end=function(body,...args){
      if(body&&html)body=body.toString().replace(/<body\b[^>]*>/i,match=>match+pilotMarkup(options));
      return end.call(this,body,...args);
    };
    inner.emit('request',req,res);
  });
}
