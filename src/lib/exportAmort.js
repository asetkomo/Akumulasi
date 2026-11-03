// Excel hasil JIJ / ATB: susunan kolom A-AO dan sheet Pivot sama dengan jij_pu.xlsx / aset_tidak_berwujud_pu.xlsx. Angka dari PDF apa adanya.
import ExcelJS from 'exceljs';
const UANG = '#,##0.00'; const MONEY = [24, 25, 27, 28, 30, 31, 32, 35, 37, 38, 39, 40]; // X,Y,AA,AB,AD,AE,AF,AI,AK,AL,AM,AN
const COL = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export async function buildAmortWorkbook({ rows, jenis, tahun, temuan }) {
  const items = rows.filter((r) => r.type === 'item'); const ty = tahun - 1; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Sheet', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.addRow(['No', 'Kodefikasi', 1, 2, 3, 4, 5, 6, 7, 'Akumulasi Amortisasi', 'NIBAR', 'Kode Barang', 8, 9, 10, 11, 12, 13, 'Kode Aset 6 Digit', 'Nama Barang', 'Spesifikasi Nama Barang', 'Tanggal Perolehan', 'Masa Manfaat', 'Nilai Perolehan\nKode Uraian Sebelumnya',
    `Penyusutan /\nAmortisasi Per Akhir\nTahun ${ty}`, 'Masa\nManfaat\nyang telah\ndilalui', 'Nilai Akumulasi\nPenyusutan/Amortisasi\nSebelumnya (Rp)', 'Nilai Buku Sebelumnya', 'Sisa Masa\nManfaat', 'Nilai Perolehan (Rp)', 'Nilai Kapitalisasi (Rp)', 'Nilai Buku Setelah Kapitalisasi', 'Penambah\nan Masa\nmanfaat', 'Total Masa\nManfaat',
    `Penyusutan /\nAmortisasi Per Akhir\nTahun ${tahun}`, 'Masa\nManfaat\nYang Telah\nDilalui', 'Beban Penyusutan /\nAmortisasi', 'Total Nilai Perolehan Terakhir (Rp)', 'Akumulasi Penyusutan / Amortisasi \n(Rp)', 'Nilai Buku (Rp)', 'Sisa Masa Manfaat']);
  const r2 = Array(41).fill(null); if (jenis === 'jij') { [[1, 1], [2, 2], [10, 3], [11, 4], [12, 5], [20, 6], [21, 7], [22, 8], [23, 9]].forEach(([c, n]) => (r2[c - 1] = n)); for (let k = 0; k < 18; k++) r2[23 + k] = 10 + k; } else for (let k = 0; k < 41; k++) r2[k] = k + 1;
  ws.addRow(r2);
  items.forEach((it, i) => {
    const n = 3 + i; const row = ws.getRow(n); const set = (c, v) => { if (v !== null && v !== undefined && v !== '') row.getCell(c).value = v; };
    set(1, it.no); [2, 3, 4, 6, 7, 8, 9].forEach((c, k) => set(c, it.seg[k])); set(10, it.aku); set(11, it.nibar); it.segB.forEach((s, k) => set(12 + k, s));
    row.getCell(19).value = { formula: `L${n}&"."&M${n}&"."&N${n}&"."&O${n}&"."&P${n}&"."&Q${n}`, result: it.kode6 };
    set(20, it.nama); set(21, it.spek);
    if (it.tanggal) { row.getCell(22).value = new Date(it.tanggal + 'T00:00:00Z'); row.getCell(22).numFmt = 'dd/mm/yyyy'; } else set(22, it.tanggalText);
    set(23, it.masa); it.nums.forEach((v, k) => { if (v !== null) row.getCell(24 + k).value = v; }); MONEY.forEach((c) => (row.getCell(c).numFmt = UANG));
  });
  const last = 2 + items.length; [1, 2].forEach((r) => { ws.getRow(r).font = { bold: true }; ws.getRow(r).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
  ws.getRow(1).height = 62; ws.columns.forEach((c, i) => { c.width = i === 0 ? 6 : i < 9 && i !== 1 ? 5 : i === 9 ? 30 : i === 10 ? 48 : i >= 11 && i <= 17 ? 5 : i === 19 || i === 20 ? 32 : i >= 23 ? 20 : 14; });

  // Sheet Pivot: rekap per kode aset 6 digit (SUMIFS; angka sama dengan PivotTable pada Excel acuan).
  const pv = wb.addWorksheet('Pivot'); pv.getRow(3).values = ['Row Labels', 'Nilai Perolehan', `Nilai Akumulasi ${ty}`, `Beban Penyusutan ${tahun}`, `Akumulasi Penyusutan ${tahun}`, 'Nilai Buku']; pv.getRow(3).font = { bold: true };
  const R = (L) => `Sheet!$${L}$3:$${L}$${last}`; const src = [['AL', 24], ['AA', 13], ['AK', 23], ['AM', 25], ['AN', 26]]; const k6 = [...new Set(items.map((i) => i.kode6))].sort();
  const val = (it, c) => it.nums[c - 10] ?? 0;
  k6.forEach((k, j) => { const n = 4 + j; const row = pv.getRow(n); row.getCell(1).value = k;
    src.forEach(([L, c], x) => { row.getCell(2 + x).value = { formula: `SUMIFS(${R(L)},${R('S')},$A${n})`, result: items.reduce((a, it) => a + (it.kode6 === k ? val(it, c) : 0), 0) }; row.getCell(2 + x).numFmt = UANG; }); });
  const gt = pv.getRow(4 + k6.length); gt.getCell(1).value = 'Grand Total'; gt.font = { bold: true };
  src.forEach(([L, c], x) => { const C = COL(2 + x); gt.getCell(2 + x).value = { formula: `SUM(${C}4:${C}${3 + k6.length})`, result: items.reduce((a, it) => a + val(it, c), 0) }; gt.getCell(2 + x).numFmt = UANG; });
  pv.columns = [{ width: 22 }, ...Array(5).fill({ width: 28 })];

  const t = wb.addWorksheet('Temuan'); t.addRow(['Tingkat', 'Kode', 'NIBAR / Kode Induk', 'Uraian', 'Keterangan']); t.getRow(1).font = { bold: true };
  temuan.forEach((x) => t.addRow([x.level, x.kode, x.nibar, x.nama, x.msg])); t.columns = [{ width: 9 }, { width: 28 }, { width: 50 }, { width: 40 }, { width: 120 }];
  return wb;
}
export async function amortBlob(args) { const buf = await (await buildAmortWorkbook(args)).xlsx.writeBuffer(); return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); }
