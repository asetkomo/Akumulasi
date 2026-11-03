// Pemeriksaan konsistensi angka di PDF IV.H.1. Tidak menghitung ulang penyusutan: hanya menandai bila angka di PDF tidak saling cocok.
const rp = (v) => Math.round(v * 100) / 100;
const NAMA = { 10: 'Nilai perolehan sebelumnya', 11: 'Penyusutan per akhir tahun lalu', 13: 'Akumulasi sebelumnya', 14: 'Nilai buku sebelumnya', 16: 'Nilai perolehan', 17: 'Nilai kapitalisasi', 18: 'Nilai buku setelah kapitalisasi', 21: 'Penyusutan per akhir tahun ini', 23: 'Beban tahun berjalan', 24: 'Total nilai perolehan terakhir', 25: 'Akumulasi', 26: 'Nilai buku' };
const g = (it, c) => it.nums[c - 10] ?? 0;
export const kodeAkum = (it) => it.seg.filter(Boolean).join('.');

export function auditAmort(rows, { tahun }) {
  const f = []; const items = rows.filter((r) => r.type === 'item'); const add = (level, kode, it, msg) => f.push({ level, kode, nibar: it?.nibar || '', nama: it?.nama || it?.uraian || '', msg });
  const seen = new Map();
  items.forEach((it, i) => {
    const X = g(it, 10), AA = g(it, 13), AB = g(it, 14), AK = g(it, 23), AL = g(it, 24), AM = g(it, 25), AN = g(it, 26), AH = g(it, 20), AJ = g(it, 22), AO = g(it, 27);
    if (!it.tanggal) add('ERROR', 'TANGGAL_TIDAK_VALID', it, `Tanggal perolehan "${it.tanggalText}" tidak terbaca.`);
    else if (it.tanggal > `${tahun}-12-31`) add('ERROR', 'TANGGAL_SETELAH_PERIODE', it, `Diperoleh ${it.tanggalText}, setelah akhir tahun ${tahun}.`);
    // Aset keluar: nilai perolehan negatif meniadakan nilai perolehan sebelumnya (penghapusan/reklasifikasi), total akhir 0.
    const keluar = g(it, 16) < 0 && Math.abs(g(it, 16) + X) <= 1 && Math.abs(AL) <= 1;
    if (keluar) add('WARN', 'ASET_KELUAR', it, `Nilai perolehan ${rp(g(it, 16))} meniadakan nilai perolehan sebelumnya ${rp(X)} (total akhir 0): penghapusan/reklasifikasi. Akumulasi sebelumnya ${rp(AA)} ikut hilang tanpa beban; pastikan ada dokumen dasarnya.`);
    if (!keluar && Math.abs(AM - (AA + AK)) > 1) add('WARN', 'AKUM_TIDAK_BALANS', it, `Akumulasi ${rp(AM)} <> akumulasi sebelumnya ${rp(AA)} + beban ${rp(AK)} (selisih ${rp(AM - AA - AK)}).`);
    if (!keluar && Math.abs(AN - (AL - AM)) > 1) add('WARN', 'NILAI_BUKU_TIDAK_BALANS', it, `Nilai buku ${rp(AN)} <> total nilai perolehan ${rp(AL)} - akumulasi ${rp(AM)} (selisih ${rp(AN - AL + AM)}).`);
    if (Math.abs(AB - (X - AA)) > 1) add('WARN', 'BUKU_AWAL_TIDAK_BALANS', it, `Nilai buku sebelumnya ${rp(AB)} <> nilai perolehan sebelumnya ${rp(X)} - akumulasi sebelumnya ${rp(AA)}.`);
    if (AH > 0 && Math.abs(AO - (AH - AJ)) > 0.5) add('WARN', 'SISA_MASA_TIDAK_BALANS', it, `Sisa masa manfaat ${AO} <> total ${AH} - dilalui ${AJ}.`);
    if (AJ > AH + 0.5) add('WARN', 'MASA_DILALUI_LEBIH', it, `Masa manfaat dilalui ${AJ} melebihi total masa manfaat ${AH}.`);
    if (AN < -1 || AO < -0.5 || AM < -1) add('ERROR', 'NILAI_NEGATIF', it, `Nilai negatif: nilai buku ${rp(AN)}, akumulasi ${rp(AM)}, sisa masa manfaat ${AO}.`);
    if (it.kosong) add('INFO', 'SEL_KOSONG', it, `${it.kosong} sel angka dikosongkan di PDF (bukan "-"); ditulis kosong apa adanya.`);
    if (it.nibar) { if (seen.has(it.nibar)) add('ERROR', 'NIBAR_GANDA', it, `NIBAR sama dengan baris ke-${seen.get(it.nibar)}; kemungkinan pencatatan ganda.`); else seen.set(it.nibar, i + 1); }
  });
  // Rekonsiliasi: total tiap baris induk di PDF vs jumlah baris rincian di bawahnya (kolom nominal saja).
  rows.filter((r) => r.type === 'group').forEach((gr) => {
    const kids = items.filter((it) => { const k = kodeAkum(it); return k === gr.kode || k.startsWith(gr.kode + '.'); }); const tol = 0.5 + 0.005 * kids.length;
    Object.keys(NAMA).forEach((c) => { if (gr.vals[c] === undefined) return; const s = kids.reduce((a, it) => a + g(it, +c), 0);
      if (Math.abs(s - gr.vals[c]) > tol) add('ERROR', 'REKON_' + c, gr, `${gr.kode} - ${NAMA[c]}: total di PDF ${rp(gr.vals[c])}, jumlah rincian ${rp(s)} (selisih ${rp(gr.vals[c] - s)}).`); });
  });
  return f;
}
