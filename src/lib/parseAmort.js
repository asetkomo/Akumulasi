// Parser laporan e-BMD FORMAT IV.H.1: Penyusutan BMD Aset Jalan, Irigasi, Jaringan (JIJ) dan Amortisasi Aset Tidak Berwujud (ATB).
// Hanya menyusun ulang kolom: angka diambil apa adanya dari PDF (tidak dihitung ulang).
const SEG_K = [74, 85, 96, 107, 122, 136, 150]; // kodefikasi akumulasi
const SEG_B = [442, 454, 465, 476, 490, 504, 518]; // kode barang
const near = (arr, x, tol) => { let bi = -1, bd = 1e9; arr.forEach((a, i) => { const d = Math.abs(x - a); if (d < bd) { bd = d; bi = i; } }); return bd <= tol ? bi : -1; };
const isDate = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
const isNum = (s) => /^\(?[\d.,]+\)?$/.test(s) || s === '-';
export const numA = (s) => { s = String(s).trim(); if (s === '-' || s === '') return 0; const neg = /^\(.*\)$/.test(s); const v = parseFloat(s.replace(/[()]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? (neg ? -v : v) : null; };
const isoTgl = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
// Baris yang terpotong di tanda hubung ("Lain-" / "lain") disambung tanpa spasi.
const join = (toks) => toks.slice().sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x)).reduce((acc, t, i, a) => (i === 0 ? t.s : acc + (Math.abs(a[i - 1].y - t.y) > 4 && /\w-$/.test(a[i - 1].s) ? '' : ' ') + t.s), '').replace(/\s+/g, ' ').trim();

export function detectAmortJenis(pages) {
  const t = (pages[0] || []).map((i) => i.str).join(' ').toUpperCase();
  if (/TIDAK BERWUJUD/.test(t)) return 'atb';
  if (/JALAN|IRIGASI|JARINGAN/.test(t)) return 'jij';
  return 'atb';
}

export function extractAmort(pages) {
  const recs = []; const warnings = []; let cur = null; let stop = false;
  pages.forEach((items, pi) => {
    if (stop) return;
    const hdr = items.find((i) => i.str.trim() === '27' && i.x > 2190); const top = hdr ? hdr.y - 8 : Infinity;
    const foot = items.find((i) => /^Mojokerto,/.test(i.str.trim()) && i.x > 1200); const bot = foot ? foot.y + 6 : 60;
    const body = items.filter((i) => i.str.trim() && i.y < top && i.y > bot).map((i) => ({ s: i.str.trim(), x: i.x, y: i.y, w: i.w || 0 }));
    const starts = [];
    body.forEach((i) => { if (isDate(i.s) && i.x >= 800 && i.x < 860) starts.push({ y: i.y, type: 'item' }); });
    body.forEach((i) => { if (i.x >= 70 && i.x <= 78 && i.s === '1' && !starts.some((s) => s.type === 'item' && Math.abs(s.y - i.y) <= 3)) starts.push({ y: i.y, type: 'group' }); });
    starts.sort((a, b) => b.y - a.y);
    const rs = starts.map((s) => { const r = { page: pi + 1, y: s.y, type: s.type, tokens: [] }; recs.push(r); return r; });
    body.forEach((it) => { let k = -1; starts.forEach((s, idx) => { if (s.y >= it.y - 4) k = idx; }); const r = k >= 0 ? rs[k] : cur; if (r) r.tokens.push(it); });
    if (rs.length) cur = rs[rs.length - 1];
    if (foot) stop = true;
  });

  const inX = (r, a, b) => r.tokens.filter((t) => t.x >= a && t.x < b);
  const nums = (r) => r.tokens.filter((t) => t.x >= 900 && isNum(t.s) && Math.abs(t.y - r.y) <= 4).sort((a, b) => a.x - b.x);
  // Kalibrasi tepi kanan kolom angka dari baris barang (angka rata kanan) untuk memetakan baris induk.
  const edges = Array.from({ length: 18 }, () => []);
  recs.filter((r) => r.type === 'item').forEach((r) => { const n = nums(r); if (n.length === 18) n.forEach((t, c) => edges[c].push(t.x + t.w)); });
  const edge = edges.map((e) => (e.length ? median(e) : null));

  // Petakan token angka ke kolom 10..27 lewat tepi kanan; sel kosong di PDF (tanpa token) tetap kosong.
  const mapCols = (r, n, warn) => {
    if (n.length === 18) return n.map((t) => numA(t.s));
    const out = Array(18).fill(null); if (edge.some((e) => e == null)) return out;
    n.forEach((t) => { const re = t.x + t.w; let bi = 0, bd = 1e9; edge.forEach((e, c) => { const d = Math.abs(re - e); if (d < bd) { bd = d; bi = c; } }); if (out[bi] !== null && warn) warn(`Hal ${r.page}: dua angka jatuh di kolom ${10 + bi}.`); out[bi] = numA(t.s); });
    return out;
  };
  const rows = [];
  for (const r of recs) {
    const seg = Array(7).fill(''); inX(r, 70, 160).forEach((t) => { const k = near(SEG_K, t.x, 5); if (k >= 0) seg[k] = t.s; });
    if (r.type === 'group') {
      const vals = {}; mapCols(r, nums(r).length === 18 ? [] : nums(r), null).forEach((v, c) => { if (v !== null) vals[10 + c] = v; });
      if (nums(r).length === 18) nums(r).forEach((t, c) => (vals[10 + c] = numA(t.s)));
      rows.push({ type: 'group', page: r.page, seg, kode: seg.filter(Boolean).join('.'), uraian: join(inX(r, 160, 900)), vals }); continue;
    }
    const segB = Array(7).fill(''); inX(r, 440, 530).forEach((t) => { const k = near(SEG_B, t.x, 5); if (k >= 0) segB[k] = t.s; });
    const n = nums(r); const cols = mapCols(r, n, (m) => warnings.push(m));
    const noTok = inX(r, 50, 70)[0]; const tgl = inX(r, 800, 860).find((t) => isDate(t.s));
    rows.push({
      type: 'item', page: r.page, no: noTok ? +noTok.s : null, seg, aku: join(inX(r, 160, 330)), nibar: inX(r, 330, 440).slice().sort((a, b) => b.y - a.y).map((t) => t.s).join('').replace(/\D/g, ''),
      segB, kode: segB.join('.'), kode6: segB.slice(0, 6).join('.'), nama: join(inX(r, 530, 700)), spek: join(inX(r, 700, 800)),
      tanggalText: tgl?.s || '', tanggal: isoTgl(tgl?.s), masa: numA(inX(r, 860, 900)[0]?.s ?? ''), nums: cols, kosong: cols.filter((c) => c === null).length,
    });
  }
  // Nomor urut dibuat berurutan: PDF mencetak No >= 1000 dengan pemisah ribuan yang ambigu ("1.01" untuk 1010).
  let k = 0; rows.forEach((r) => { if (r.type === 'item') r.no = ++k; });
  return { rows, warnings };
}

export function extractMetaAmort(pages) {
  const it = (pages[0] || []).map((i) => ({ s: i.str.trim(), y: i.y }));
  const th = it.map((i) => /^TAHUN\s+(\d{4})/.exec(i.s)).find(Boolean); const pm = it.find((i) => /^PEMERINTAH/.test(i.s));
  const unit = it.find((i) => /^\d{2}\.\d{2}\.\d{2} - /.test(i.s)); const fmt = it.find((i) => /^FORMAT/.test(i.s));
  const judul = it.find((i) => /^(AMORTISASI|PENYUSUTAN) BMD/.test(i.s));
  return { tahun: th ? +th[1] : null, pemda: pm ? pm.s : '', kodeLokasi: unit ? unit.s.split(' - ')[0] : '', pengguna: unit ? unit.s.split(' - ').slice(1).join(' - ') : '', format: fmt ? fmt.s : '', judul: judul ? judul.s : '' };
}
