// Uji: parser IV.H.1 harus identik dengan Excel acuan (aset_tidak_berwujud_pu.xlsx, jij_pu.xlsx), selisih angka maks. pembulatan PDF.
import fs from 'fs'; import ExcelJS from 'exceljs'; import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAmort, extractMetaAmort, detectAmortJenis } from '../src/lib/parseAmort.js';
const U = process.env.DATA_DIR || '/mnt/user-data/uploads/'; let bad = 0;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim(); const v = (c) => (c && typeof c === 'object' && !(c instanceof Date) ? ('result' in c ? c.result : '') : c);
for (const [pdfN, xlN] of [['aset_tidak_berwujud_pu.pdf', 'aset_tidak_berwujud_pu.xlsx'], ['jij_pu.pdf', 'jij_pu.xlsx']]) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(U + pdfN)), verbosity: 0 }).promise;
  const pages = []; for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); pages.push(tc.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }))); }
  const { rows, warnings } = extractAmort(pages); const items = rows.filter((r) => r.type === 'item'); const meta = extractMetaAmort(pages);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(U + xlN); const ws = wb.getWorksheet('Sheet'); let n = 0, maxd = 0;
  warnings.forEach((w) => console.log('   WARN', w));
  console.log(`\n== ${pdfN}: jenis ${detectAmortJenis(pages)} | ${JSON.stringify(meta)}\n   item ${items.length} | group ${rows.length - items.length} | warn ${warnings.length}`);
  const miss = (m) => { if (bad++ < 40) console.log('  BEDA', m); };
  items.forEach((it, i) => { const r = ws.getRow(3 + i); const g = (c) => v(r.getCell(c).value);
    const T = [[1, it.no], [10, it.aku], [11, it.nibar], [20, it.nama], [21, it.spek]]; for (const [c, x] of T) { n++; if (norm(x) !== norm(g(c))) miss(`r${3 + i} kol${c}: "${norm(x)}" vs "${norm(g(c))}"`); }
    const segK = [2, 3, 4, 6, 7, 8, 9]; it.seg.forEach((s, k) => { n++; if (norm(s) !== norm(g(segK[k]))) miss(`r${3 + i} kodefikasi${k}: "${s}" vs "${g(segK[k])}"`); });
    it.segB.forEach((s, k) => { n++; if (norm(s) !== norm(g(12 + k))) miss(`r${3 + i} kodebrg${k}: "${s}" vs "${g(12 + k)}"`); });
    n++; if (it.tanggal !== g(22)?.toISOString?.().slice(0, 10)) miss(`r${3 + i} tgl ${it.tanggal} vs ${g(22)}`); n++; if (Math.abs(it.masa - g(23)) > 1e-9) miss(`r${3 + i} masa ${it.masa} vs ${g(23)}`);
    it.nums.forEach((x, k) => { n++; const e = Number(g(24 + k) ?? 0); x = x ?? 0; const d = Math.abs(x - e); maxd = Math.max(maxd, d); if (d > 0.01) miss(`r${3 + i} angka kol${24 + k}: ${x} vs ${e}`); }); });
  let extra = 0; for (let r = 3 + items.length; r <= ws.rowCount; r++) if (v(ws.getRow(r).getCell(11).value)) extra++;
  console.log(`   item dengan sel kosong di PDF: ${items.filter((i) => i.kosong).length}`);
  console.log(`   sel dibandingkan ${n} | selisih angka maks ${maxd.toFixed(5)} | baris Excel lebih banyak dari PDF: ${extra}`);
}
console.log('\ntotal selisih', bad); process.exit(bad ? 1 : 0);
