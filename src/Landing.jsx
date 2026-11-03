import { unduhTemplate } from './lib/templateGedung.js';

const CONTOH = [
  ['Gedung Balai Kota, 2003', '1.200.000.000,00', '24.000.000,00', '1.126.000.000,00'],
  ['Pasar Tanjung, 1997', '3.000.000.000,00', '60.000.000,00', '2.395.000.000,00'],
  ['Alun-Alun Wiraraja, 2023', '10.000.000,00', '200.000,00', '6.383.333,33'],
];
const LANGKAH = [
  ['Siapkan PDF', 'Unduh laporan dari SIPD e-BMD apa adanya. Jangan dicetak ulang atau dipindai.'],
  ['Siapkan template', 'Khusus gedung: unduh format di bawah, lalu isi AKM, nilai buku, sisa masa manfaat, dan UPT.'],
  ['Unggah dan periksa', 'Baca ringkasan dan daftar temuan sebelum mengunduh hasilnya.'],
  ['Unduh Excel', 'Rumus tetap hidup. Sheet Temuan mencatat semua yang perlu dicek.'],
];
const PERIKSA = [
  'Total tiap kelompok di PDF sama dengan jumlah rinciannya',
  'Kode barang yang tidak ada di master masa manfaat',
  'NIBAR ganda dan tanggal perolehan yang tidak terbaca',
  'Nilai perolehan tidak sama dengan AKM + nilai buku (gedung)',
  'Sisa masa manfaat yang tidak cocok dengan garis lurus',
  'Koreksi masa manfaat tahun lalu dihitung sebagai penyesuaian saldo awal (peralatan)',
  'Angka di PDF IV.H.1 saling cocok, dan aset yang dikeluarkan ditandai (JIJ & ATB)',
];

export default function Landing({ src }) {
  const tahun = new Date().getFullYear();
  return (<div className="landing">
    <section className="hero">
      <div>
        <h1>Dari PDF e-BMD ke Excel penyusutan, lengkap dengan catatan pemeriksaannya.</h1>
        <p className="lead">Unggah laporan Daftar BMD pada Pengguna Barang dari SIPD. Aplikasi membaca barangnya, menghitung penyusutan per bulan dengan rumus Excel yang bisa ditelusuri, lalu menandai data yang janggal.</p>
        <div className="cta"><a className="btn" href="#/gedung">Hitung gedung &amp; bangunan</a><a className="btn sec" href="#/mesin">Hitung peralatan &amp; mesin</a></div>
      </div>
      <figure className="specimen">
        <table><caption>Contoh isi sheet hasil</caption>
          <thead><tr><th>Aset</th><th className="n">Nilai perolehan</th><th className="n">Beban tahun ini</th><th className="n">Nilai buku akhir</th></tr></thead>
          <tbody>{CONTOH.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="n">{r[1]}</td><td className="n">{r[2]}</td><td className="n">{r[3]}</td></tr>)}</tbody>
          <tfoot><tr><td>JUMLAH</td><td className="n">4.210.000.000,00</td><td className="n">84.200.000,00</td><td className="n">3.527.383.333,33</td></tr></tfoot></table>
        <figcaption>Angka ilustrasi, bukan data nyata.</figcaption>
      </figure>
    </section>

    <h2 className="eyebrow">Pilih jenis laporan</h2>
    <div className="choice">
      <div><h3>Peralatan &amp; Mesin</h3><code>FORMAT II.O.2.2</code></div>
      <p>Cukup satu PDF. Masa manfaat diambil dari master kode barang. Bila masa manfaat tahun lalu keliru, selisih akumulasi awalnya dihitung sebagai koreksi.</p>
      <div className="cta"><a className="btn" href="#/mesin">Buka</a></div>
    </div>
    <div className="choice">
      <div><h3>Gedung &amp; Bangunan</h3><code>FORMAT II.O.2.3</code></div>
      <p>PDF ditambah template saldo akhir tahun lalu: AKM, nilai buku, sisa masa manfaat, kapitalisasi, dan UPT. Hasilnya mengikuti format Excel penyusutan gedung.</p>
      <div className="cta"><a className="btn" href="#/gedung">Buka</a><button className="sec" onClick={() => unduhTemplate({ tahun })}>Unduh template</button></div>
    </div>

    <div className="choice">
      <div><h3>JIJ &amp; Aset Tidak Berwujud</h3><code>FORMAT IV.H.1</code></div>
      <p>Cukup satu PDF. Kolom disusun ulang sesuai format Excel Anda dan dilengkapi pivot per kode aset 6 digit. Angka diambil apa adanya dari PDF, tidak dihitung ulang.</p>
      <div className="cta"><a className="btn" href="#/amort">Buka</a></div>
    </div>

    <h2 className="eyebrow">Alur kerja</h2>
    <ol className="steps">{LANGKAH.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>

    <h2 className="eyebrow">Yang diperiksa otomatis</h2>
    <ul className="checks">{PERIKSA.map((t) => <li key={t}>{t}</li>)}</ul>

    <h2 className="eyebrow">Data Anda</h2>
    <p className="lead">PDF dibaca di browser Anda dan tidak diunggah ke server. Data baru tersimpan di Supabase bila Anda masuk dan menekan Simpan. Hasilnya alat bantu hitung; verifikasi tetap terhadap dokumen sumber.</p>
    <p className="mut small">Master masa manfaat: {src}</p>
  </div>);
}
