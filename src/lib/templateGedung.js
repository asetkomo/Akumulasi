// Membaca template input Gedung (Format_penyusutan_gedung.xlsx): kunci NIBAR + saldo akhir tahun lalu + kapitalisasi tahun berjalan.
import ExcelJS from 'exceljs';
import { parseTgl } from './parsePdf.js';

const val = (c) => { const v = c?.value; return v && typeof v === 'object' && !(v instanceof Date) ? (v.result ?? v.text ?? null) : v; };
const toNum = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const toISO = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = String(v).trim(); return parseTgl(s) || (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
};
const KEYS = [['nibar', (h) => h.includes('nibar')], ['tgl', (h) => /(tgl|tanggal) perolehan/.test(h)], ['akm', (h) => h.startsWith('akm')],
  ['nb', (h) => h.includes('nilai buku')], ['sisa', (h) => h.includes('sisa masa manfaat')], ['kap', (h) => h.includes('kapitalisasi tahun berjalan')],
  ['tglKap', (h) => /(tgl|tanggal) kapitalisasi/.test(h)], ['tambahan', (h) => h.includes('tambahan masa manfaat')], ['upt', (h) => h === 'upt' || h.startsWith('upt ')]];

export async function bacaTemplate(buffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); const ws = wb.worksheets[0];
  let hr = 0; const map = {}; let tahunLalu = null;
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !hr; r++) ws.getRow(r).eachCell((c, n) => { if (/nibar/i.test(String(val(c) ?? ''))) hr = r; });
  if (!hr) throw new Error('Header "NIBAR" tidak ditemukan pada template.');
  ws.getRow(hr).eachCell((c, n) => { const h = String(val(c) ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); for (const [k, f] of KEYS) if (!map[k] && f(h)) { map[k] = n; if (k === 'akm') { const y = /(\d{4})/.exec(h); if (y) tahunLalu = +y[1]; } } });
  const miss = ['nibar', 'akm', 'nb', 'sisa'].filter((k) => !map[k]); if (miss.length) throw new Error('Kolom template tidak ditemukan: ' + miss.join(', '));
  const rows = []; const warnings = [];
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r); const raw = val(row.getCell(map.nibar)); if (raw == null || String(raw).trim() === '') continue;
    const nibar = typeof raw === 'number' ? String(BigInt(Math.round(raw))) : String(raw).replace(/\D/g, '');
    if (nibar.length !== 45) warnings.push(`Template baris ${r}: NIBAR berpanjang ${nibar.length} digit (seharusnya 45); pastikan kolom berformat teks.`);
    const g = (k) => (map[k] ? val(row.getCell(map[k])) : null);
    rows.push({ baris: r, nibar, tgl: toISO(g('tgl')), akm: toNum(g('akm')), nb: toNum(g('nb')), sisa: toNum(g('sisa')), kap: toNum(g('kap')), tglKap: toISO(g('tglKap')), tambahan: toNum(g('tambahan')), upt: String(g('upt') ?? '').trim() });
  }
  return { rows, tahunLalu, warnings };
}

// ---------- Template yang dapat diunduh ----------
const HEADER = (ty) => ['NIBAR', 'TGL PEROLEHAN', `AKM akhir ${ty} (Rp)`, `Nilai buku akhir ${ty} (Rp)`, `Sisa masa manfaat akhir ${ty} (bln)`, 'Kapitalisasi tahun berjalan (Rp)', 'Tanggal kapitalisasi', 'Tambahan masa manfaat (bln)', 'UPT'];
const PETUNJUK = [
  ['NIBAR', 'Wajib', '45 digit, format Teks. Dicocokkan dengan NIBAR di PDF e-BMD.', '120135761200000000000020231330101120010000001'],
  ['TGL PEROLEHAN', 'Wajib', 'Tanggal perolehan, format dd/mm/yyyy.', '21/12/2023'],
  ['AKM akhir (tahun lalu)', 'Wajib', 'Akumulasi penyusutan per 31 Desember tahun lalu, Rp.', '4370318.87'],
  ['Nilai buku akhir (tahun lalu)', 'Wajib', 'Nilai buku per 31 Desember tahun lalu, Rp.', '100517181.13'],
  ['Sisa masa manfaat akhir (tahun lalu)', 'Wajib', 'Dalam bulan. Isi 0 bila sudah habis disusutkan.', '575'],
  ['Kapitalisasi tahun berjalan', 'Hanya bila ada', 'Nilai kapitalisasi (renovasi/penambahan) di tahun berjalan, Rp.', '147347500'],
  ['Tanggal kapitalisasi', 'Wajib bila ada kapitalisasi', 'Harus berada di tahun penyusutan.', '09/05/2026'],
  ['Tambahan masa manfaat', 'Wajib bila ada kapitalisasi', 'Penambahan masa manfaat akibat kapitalisasi, dalam bulan.', '60'],
  ['UPT', 'Opsional', 'Unit pengelola (kelurahan, UPT pasar, dst.). Dipakai untuk rekap per UPT di sheet Pivot.', 'Kelurahan Wates'],
];

// items (opsional): barang hasil baca PDF; bila diberikan, NIBAR dan tanggal perolehan terisi, tinggal melengkapi saldo.
export async function buatTemplate({ tahun, items = [] }) {
  const ty = tahun - 1; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Sheet1', { views: [{ state: 'frozen', ySplit: 1 }] });
  const ref = items.length > 0; ws.addRow([...HEADER(ty), ...(ref ? ['Nama barang (acuan)', 'Nilai perolehan di PDF (acuan)'] : [])]);
  const fmt = [['@', 48], ['dd/mm/yyyy', 16], ['#,##0.00', 20], ['#,##0.00', 20], ['0', 18], ['#,##0.00', 20], ['dd/mm/yyyy', 16], ['0', 16], ['@', 28], ['@', 40], ['#,##0.00', 24]];
  fmt.slice(0, ref ? 11 : 9).forEach(([f, w], i) => { const c = ws.getColumn(i + 1); c.numFmt = f; c.width = w; });
  const hr = ws.getRow(1); hr.font = { bold: true }; hr.alignment = { wrapText: true, vertical: 'middle' }; hr.height = 32;
  hr.eachCell((c, n) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n > 9 ? 'FFE5E5E5' : 'FFEFE9D8' } }; });
  [...items].sort((a, b) => (a.nibar < b.nibar ? -1 : 1)).forEach((it) => {
    const r = ws.addRow([it.nibar, it.tanggal ? new Date(it.tanggal + 'T00:00:00Z') : it.tanggalText]);
    r.getCell(1).numFmt = '@'; r.getCell(2).numFmt = 'dd/mm/yyyy';
    r.getCell(10).value = it.spesNama || it.nama; r.getCell(11).value = it.nilai; r.getCell(11).numFmt = '#,##0.00';
    [10, 11].forEach((c) => (r.getCell(c).font = { color: { argb: 'FF666666' } }));
  });
  const pt = wb.addWorksheet('Petunjuk'); pt.addRow(['Kolom', 'Wajib?', 'Isi', 'Contoh']); pt.getRow(1).font = { bold: true };
  PETUNJUK.forEach((r) => pt.addRow(r)); pt.addRow([]);
  [`Periode: saldo akhir ${ty}, penyusutan ${tahun}.`, 'Cek sebelum unggah: AKM + Nilai buku + Kapitalisasi harus sama dengan Nilai perolehan di PDF (aplikasi akan menandai bila tidak).',
    'Jangan ubah nama kolom pada baris pertama dan jangan memindahkan sheet "Sheet1" dari urutan pertama.'].forEach((t) => pt.addRow([t]));
  pt.columns = [{ width: 34 }, { width: 26 }, { width: 80 }, { width: 48 }];
  return wb;
}
export async function unduhTemplate(opts) {
  const buf = await (await buatTemplate(opts)).xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = opts.items?.length ? `template_gedung_${opts.tahun}_terisi.xlsx` : `Format_penyusutan_gedung_${opts.tahun}.xlsx`; a.click();
}
