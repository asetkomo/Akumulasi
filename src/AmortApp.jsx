import { useMemo, useState } from 'react';
import { loadPages } from './lib/loadPdf.js';
import { detectFormat } from './lib/parsePdf.js';
import { extractAmort, extractMetaAmort, detectAmortJenis } from './lib/parseAmort.js';
import { auditAmort } from './lib/auditAmort.js';
import { amortBlob } from './lib/exportAmort.js';

const rp = (v) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v || 0);
const tgl = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const val = (it, c) => it.nums[c - 10] ?? 0;
const NAMA_JENIS = { jij: 'Jalan, Irigasi & Jaringan (JIJ)', atb: 'Aset Tidak Berwujud (ATB)' };

export default function AmortApp() {
  const [rows, setRows] = useState([]); const [meta, setMeta] = useState({}); const [jenis, setJenis] = useState('jij'); const [namaPdf, setNamaPdf] = useState('');
  const [warn, setWarn] = useState([]); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const items = useMemo(() => rows.filter((r) => r.type === 'item'), [rows]); const tahun = meta.tahun || new Date().getFullYear();
  const temuan = useMemo(() => (rows.length ? auditAmort(rows, { tahun }) : []), [rows, tahun]);
  const pivot = useMemo(() => { const m = new Map(); items.forEach((it) => { const a = m.get(it.kode6) || [0, 0, 0, 0, 0]; [24, 13, 23, 25, 26].forEach((c, i) => (a[i] += val(it, c))); m.set(it.kode6, a); }); return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)); }, [items]);
  const tot = pivot.reduce((a, [, v]) => a.map((x, i) => x + v[i]), [0, 0, 0, 0, 0]); const cnt = (l) => temuan.filter((t) => t.level === l).length;

  async function onPdf(e) {
    const f = e.target.files[0]; if (!f) return; setBusy('Membaca PDF…'); setMsg('');
    try { const pages = await loadPages(f, (p, n) => setBusy(`Membaca halaman ${p}/${n}…`));
      if (detectFormat(pages) !== 'amort') throw new Error('PDF ini bukan FORMAT IV.H.1. Peralatan & Mesin dan Gedung & Bangunan punya tab sendiri.');
      const out = extractAmort(pages); if (!out.rows.some((r) => r.type === 'item')) throw new Error('Tidak ada baris barang terbaca dari PDF.');
      setRows(out.rows); setWarn(out.warnings); setMeta(extractMetaAmort(pages)); setJenis(detectAmortJenis(pages)); setNamaPdf(f.name);
    } catch (err) { setMsg('Gagal: ' + err.message); } setBusy('');
  }
  async function unduh() {
    setBusy('Menyusun Excel…'); const blob = await amortBlob({ rows, jenis, tahun, temuan });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${jenis}_${(meta.kodeLokasi || '').replace(/\W/g, '')}_${tahun}.xlsx`; a.click(); setBusy('');
  }

  return (<div>
    <p className="intro">Format IV.H.1 (Penyusutan JIJ dan Amortisasi ATB): kolom disusun ulang sesuai format Excel Anda dan dilengkapi pivot per kode aset 6 digit. Angka diambil apa adanya dari PDF, <b>tidak dihitung ulang</b>.</p>
    <div className="card"><h2>1. Unggah PDF dari SIPD e-BMD</h2>
      <input type="file" accept="application/pdf" onChange={onPdf} disabled={!!busy} />
      {busy && <p>{busy}</p>}{msg && <p className="WARN">{msg}</p>}
      {items.length > 0 && <p className="mut">{namaPdf} · {meta.judul} · {meta.kodeLokasi} {meta.pengguna} · {items.length} barang</p>}
      {warn.slice(0, 8).map((w, i) => <div key={i} className="WARN">{w}</div>)}</div>

    {items.length > 0 && <>
      <div className="card"><h2>2. Jenis aset</h2><div className="row"><div><label>Terdeteksi dari judul laporan (mengatur penomoran baris 2 di Excel)</label>
        <select value={jenis} onChange={(e) => setJenis(e.target.value)}><option value="jij">{NAMA_JENIS.jij}</option><option value="atb">{NAMA_JENIS.atb}</option></select></div></div></div>

      <div className="card"><h2>3. Ringkasan {tahun}</h2><div className="grid">
        <div className="stat"><span className="mut">Total nilai perolehan terakhir</span><b>{rp(tot[0])}</b></div>
        <div className="stat"><span className="mut">Akumulasi {tahun - 1}</span><b>{rp(tot[1])}</b></div>
        <div className="stat"><span className="mut">Beban {tahun}</span><b>{rp(tot[2])}</b></div>
        <div className="stat"><span className="mut">Akumulasi {tahun}</span><b>{rp(tot[3])}</b></div>
        <div className="stat"><span className="mut">Nilai buku</span><b>{rp(tot[4])}</b></div>
        <div className="stat"><span className="mut">Temuan</span><b><span className="ERROR">{cnt('ERROR')} error</span> · <span className="WARN">{cnt('WARN')} peringatan</span></b></div></div>
        <div className="row" style={{ marginTop: 14 }}><button onClick={unduh} disabled={!!busy}>Unduh Excel</button></div></div>

      <div className="card"><h2>Pivot per kode aset 6 digit</h2><div className="tw"><table><thead><tr><th>Kode aset</th><th className="n">Nilai perolehan</th><th className="n">Akumulasi {tahun - 1}</th><th className="n">Beban {tahun}</th><th className="n">Akumulasi {tahun}</th><th className="n">Nilai buku</th></tr></thead><tbody>
        {pivot.map(([k, v]) => <tr key={k}><td>{k}</td>{v.map((x, i) => <td key={i} className="n">{rp(x)}</td>)}</tr>)}</tbody>
        <tfoot><tr><td><b>Grand Total</b></td>{tot.map((x, i) => <td key={i} className="n"><b>{rp(x)}</b></td>)}</tr></tfoot></table></div>
        <p className="mut small">“Nilai perolehan” memakai kolom Total Nilai Perolehan Terakhir, sehingga Nilai perolehan − Akumulasi = Nilai buku.</p></div>

      <div className="card"><h2>Temuan pemeriksaan</h2>
        {!temuan.filter((t) => t.level !== 'INFO').length && <p className="ok">Tidak ada error/peringatan. Angka di PDF saling cocok dan total tiap kelompok sama dengan jumlah rinciannya.</p>}
        <div className="tw"><table><thead><tr><th>Tingkat</th><th>Kode</th><th>Uraian</th><th>Keterangan</th></tr></thead><tbody>
          {[...temuan].sort((a, b) => 'EWI'.indexOf(a.level[0]) - 'EWI'.indexOf(b.level[0])).slice(0, 300).map((t, i) => <tr key={i}><td className={t.level}>{t.level}</td><td>{t.kode}</td><td>{t.nama}</td><td>{t.msg}</td></tr>)}</tbody></table></div></div>

      <div className="card"><h2>Pratinjau baris</h2><div className="tw"><table><thead><tr><th>No</th><th>Kode barang</th><th>Nama</th><th>Tgl</th><th className="n">Masa</th><th className="n">Total perolehan</th><th className="n">Akumulasi</th><th className="n">Nilai buku</th><th className="n">Sisa</th></tr></thead><tbody>
        {items.slice(0, 200).map((it) => <tr key={it.no}><td>{it.no}</td><td>{it.kode}</td><td>{it.nama}</td><td>{tgl(it.tanggal)}</td><td className="n">{it.masa}</td><td className="n">{rp(val(it, 24))}</td><td className="n">{rp(val(it, 25))}</td><td className="n">{rp(val(it, 26))}</td><td className="n">{val(it, 27)}</td></tr>)}</tbody></table></div>
        {items.length > 200 && <p className="mut small">Pratinjau 200 dari {items.length} baris; Excel memuat semuanya.</p>}</div></>}
  </div>);
}
