// Uji template: baca Magersari (ada UPT), unduhan template kosong/terisi dapat dibaca ulang, dan ekspor dengan UPT.
import fs from 'fs'; import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractRecords } from '../src/lib/parsePdf.js'; import { bacaTemplate, buatTemplate } from '../src/lib/templateGedung.js'; import { hitungGedung } from '../src/lib/calcGedung.js'; import { auditGedung, gabung } from '../src/lib/auditGedung.js'; import { buildGedungWorkbook } from '../src/lib/exportGedung.js';
const U = process.env.DATA_DIR || '/mnt/user-data/uploads/'; let bad = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'GAGAL', m); if (!c) bad++; };
const mg = await bacaTemplate(fs.readFileSync(U + 'kec_magersari.xlsx'));
ok(mg.rows.length === 77 && mg.rows.every((r) => r.upt) && new Set(mg.rows.map((r) => r.upt)).size === 7 && mg.warnings.length === 0 && mg.rows.every((r) => r.tgl), `Magersari: ${mg.rows.length} baris, ${new Set(mg.rows.map((r) => r.upt)).size} UPT, ${mg.warnings.length} peringatan`);
const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(U + 'gedung_diskop.pdf')), verbosity: 0 }).promise;
const pages = []; for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); pages.push(tc.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))); }
const { rows } = extractRecords(pages, 'gedung'); const items = rows.filter((r) => r.type === 'item');
const kosong = await bacaTemplate(await (await buatTemplate({ tahun: 2026 })).xlsx.writeBuffer()); ok(kosong.rows.length === 0 && kosong.tahunLalu === 2025, 'template kosong terbaca (0 baris, saldo akhir 2025)');
const isi = await bacaTemplate(await (await buatTemplate({ tahun: 2026, items })).xlsx.writeBuffer());
ok(isi.rows.length === 68 && isi.warnings.length === 0 && isi.rows.every((r, i) => r.nibar.length === 45 && r.tgl), `template terisi dari PDF: ${isi.rows.length} baris, NIBAR 45 digit utuh`);
ok(items.every((it) => isi.rows.some((r) => r.nibar === it.nibar && r.tgl === it.tanggal)), 'NIBAR dan tanggal perolehan semua barang PDF ada di template terisi');
// ekspor dengan UPT sintetis (UPT PASAR vs Dinas) memakai template Diskop asli
const tpl = await bacaTemplate(fs.readFileSync(U + 'Format_penyusutan_gedung.xlsx')); const stat = new Map(items.map((i) => [i.nibar, i.status]));
tpl.rows.forEach((t) => { t.upt = /UPT/.test(stat.get(t.nibar) || '') ? 'UPT Pasar' : (t.baris % 2 ? 'Kantor Dinas' : ''); });
const masa = JSON.parse(fs.readFileSync('public/masa_manfaat.json')); const { pairs, orphan, dupTemplate } = gabung(items, tpl.rows);
const hasil = pairs.map(({ it, tp }) => hitungGedung(it, masa[it.kode], tp || {}, 2026)); const temuan = auditGedung({ rows, pairs, hasil, orphan, dupTemplate, tahun: 2026 });
ok(temuan.some((t) => t.kode === 'UPT_KOSONG'), 'peringatan UPT_KOSONG muncul saat sebagian UPT kosong');
await (await buildGedungWorkbook({ pairs, hasil, temuan, masa, tahun: 2026 })).xlsx.writeFile('/tmp/gedung_upt.xlsx');
const byU = {}; pairs.forEach((p, i) => { const u = p.tp.upt || '(tanpa UPT)'; byU[u] = (byU[u] || 0) + hasil[i].AL; }); console.log('beban per UPT (hitungan kode):', JSON.stringify(byU));
process.exit(bad ? 1 : 0);
