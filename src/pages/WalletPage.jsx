import React, { useEffect, useState } from 'react';
import {
  Wallet, RefreshCw, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight, Building2, Info,
  TrendingUp, Receipt, Coins, Hash, Landmark, Plus, Trash2, X, ArrowDownToLine, Send,
} from 'lucide-react';
import { getWallet, getBankAccounts, addBankAccount, deleteBankAccount, requestPayout, getPayouts } from '../lib/api';

const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const TYPE_LABEL = {
  sale: 'Penjualan', platform_fee: 'Biaya platform', gateway_fee: 'Biaya gateway',
  payout: 'Penarikan', payout_reversal: 'Pengembalian penarikan', refund: 'Refund', adjustment: 'Penyesuaian',
};
const PERIODS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'all', label: 'Semua' },
];
const PAYOUT_STATUS = {
  pending: { label: 'Menunggu diproses', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-700' },
};

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(v); }
};
const maskAcc = (n) => { const s = String(n || ''); return s.length > 4 ? '••••' + s.slice(-4) : s; };

export default function WalletPage({ setActionError, setSuccessMessage, confirmAction }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [branch, setBranch] = useState('all');

  const [banks, setBanks] = useState([]);
  const [payouts, setPayouts] = useState([]);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wForm, setWForm] = useState({ tenantId: '', amount: '', bankAccountId: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountHolder: '', isDefault: true });
  const [addingBank, setAddingBank] = useState(false);

  const load = async (opts = {}) => {
    setLoading(true);
    try {
      const res = await getWallet({ period: opts.period ?? period, branch: opts.branch ?? branch });
      setData(res?.data || null);
    } catch (err) {
      setActionError?.(err.message || 'Gagal memuat dompet.');
    } finally {
      setLoading(false);
    }
  };
  const loadExtras = async () => {
    try {
      const [b, p] = await Promise.all([getBankAccounts(), getPayouts()]);
      setBanks(b?.data || []);
      setPayouts(p?.data || []);
    } catch { /* diam; ditangani di aksi */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period, branch]);
  useEffect(() => { loadExtras(); /* eslint-disable-next-line */ }, []);

  const company = data?.company || { available: 0, pending: 0, total: 0 };
  const branches = data?.branches || [];
  const summary = data?.summary || { grossSales: 0, platformFees: 0, net: 0, trxCount: 0 };
  const entries = data?.entries || [];
  const periodLabel = PERIODS.find((p) => p.key === period)?.label || '';
  const selBranch = branches.find((b) => String(b.tenantId) === String(wForm.tenantId));

  const openWithdraw = () => {
    if (banks.length === 0) { setShowAddBank(true); return; }
    const firstBranch = branches[0];
    const def = banks.find((b) => Number(b.isDefault) === 1) || banks[0];
    setWForm({ tenantId: firstBranch ? String(firstBranch.tenantId) : '', amount: '', bankAccountId: def ? String(def.id) : '', note: '' });
    setShowWithdraw(true);
  };

  const submitWithdraw = async (e) => {
    e.preventDefault();
    const amount = Math.round(Number(wForm.amount));
    if (!wForm.tenantId || !wForm.bankAccountId || !amount) { setActionError?.('Lengkapi cabang, nominal, dan rekening.'); return; }
    setSubmitting(true);
    try {
      const res = await requestPayout({ tenantId: Number(wForm.tenantId), amount, bankAccountId: Number(wForm.bankAccountId), note: wForm.note });
      setShowWithdraw(false);
      setSuccessMessage?.(res?.message || 'Penarikan diajukan.');
      await Promise.all([load(), loadExtras()]);
    } catch (err) {
      setActionError?.(err.message || 'Gagal mengajukan penarikan.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAddBank = async (e) => {
    e.preventDefault();
    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.accountHolder.trim()) {
      setActionError?.('Nama bank, nomor rekening, dan nama pemilik wajib diisi.'); return;
    }
    setAddingBank(true);
    try {
      await addBankAccount(bankForm);
      setShowAddBank(false);
      setBankForm({ bankName: '', accountNumber: '', accountHolder: '', isDefault: true });
      setSuccessMessage?.('Rekening bank ditambahkan.');
      await loadExtras();
    } catch (err) {
      setActionError?.(err.message || 'Gagal menambah rekening.');
    } finally {
      setAddingBank(false);
    }
  };

  const removeBank = async (b) => {
    const ok = await confirmAction?.(`Hapus rekening ${b.bankName} ${maskAcc(b.accountNumber)}?`, { title: 'Hapus Rekening', confirmText: 'Ya, hapus', danger: true });
    if (!ok) return;
    try {
      await deleteBankAccount(b.id);
      setSuccessMessage?.('Rekening dihapus.');
      await loadExtras();
    } catch (err) {
      setActionError?.(err.message || 'Gagal menghapus rekening.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet size={22} className="text-sky-600" /> Dompet Digital
          </h2>
          <p className="text-sm text-slate-500">Saldo hasil pembayaran via payment gateway (QRIS/VA), seluruh cabang perusahaan.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openWithdraw}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700">
            <ArrowDownToLine size={15} /> Tarik Saldo
          </button>
          <button onClick={() => { load(); loadExtras(); }} disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Perbarui
          </button>
        </div>
      </div>

      {/* Saldo kumulatif perusahaan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-blue-600 p-5 text-white shadow-lg shadow-sky-500/20">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">Total Saldo Perusahaan</p>
          <p className="mt-2 text-3xl font-black">{rupiah(company.total)}</p>
          <p className="mt-1 text-xs text-white/80">Tersedia + tertahan, semua cabang</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={14} /> Tersedia</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{rupiah(company.available)}</p>
          <p className="mt-1 text-xs text-emerald-600/80">Sudah settle, bisa ditarik</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5"><Clock size={14} /> Tertahan (T+1)</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{rupiah(company.pending)}</p>
          <p className="mt-1 text-xs text-amber-600/80">Menunggu settlement gateway</p>
        </div>
      </div>

      {/* Filter periode + cabang */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500">
          <option value="all">Semua cabang</option>
          {branches.map((b) => (<option key={b.tenantId} value={b.tenantId}>{b.branchName}</option>))}
        </select>
        <span className="text-xs text-slate-400">Ringkasan &amp; riwayat mengikuti filter ini</span>
      </div>

      {/* Ringkasan arus */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Receipt size={14} className="text-sky-500" /> Pemasukan Kotor</p>
          <p className="mt-2 text-xl font-black text-slate-900">{rupiah(summary.grossSales)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{periodLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Coins size={14} className="text-rose-500" /> Biaya Platform</p>
          <p className="mt-2 text-xl font-black text-rose-600">−{rupiah(summary.platformFees)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{periodLabel}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5"><TrendingUp size={14} /> Pemasukan Bersih</p>
          <p className="mt-2 text-xl font-black text-emerald-700">{rupiah(summary.net)}</p>
          <p className="mt-1 text-[11px] text-emerald-600/70">{periodLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Hash size={14} className="text-slate-400" /> Jumlah Transaksi</p>
          <p className="mt-2 text-xl font-black text-slate-900">{summary.trxCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">{periodLabel}</p>
        </div>
      </div>

      {/* Rekening bank */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Landmark size={15} className="text-slate-400" /> Rekening Bank Tujuan</h3>
          <button onClick={() => setShowAddBank(true)} className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"><Plus size={14} /> Tambah</button>
        </div>
        {banks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Belum ada rekening. Tambahkan rekening untuk bisa menarik saldo.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((b) => (
              <div key={b.id} className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{b.bankName} {Number(b.isDefault) === 1 && <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">Utama</span>}</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-700">{maskAcc(b.accountNumber)}</p>
                  <p className="text-xs text-slate-500">a.n. {b.accountHolder}</p>
                </div>
                <button onClick={() => removeBank(b)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Hapus"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat penarikan */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Riwayat Penarikan</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-bold">Waktu</th>
                <th className="px-4 py-3 font-bold">Cabang</th>
                <th className="px-4 py-3 font-bold">Tujuan</th>
                <th className="px-4 py-3 font-bold text-right">Nominal</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Belum ada penarikan.</td></tr>
              ) : (
                payouts.map((p) => {
                  const st = PAYOUT_STATUS[p.status] || { label: p.status, cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(p.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{p.branchName || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{p.bankName} <span className="font-mono text-xs text-slate-400">{maskAcc(p.accountNumber)}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">{rupiah(p.amount)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          Dana masuk otomatis saat pembayaran gateway lunas, dikurangi biaya platform per transaksi. Saldo <b>tertahan</b> jadi <b>tersedia</b> setelah settlement <b>T+1</b>.
          Penarikan mengurangi saldo tersedia langsung (direservasi), lalu diproses & ditransfer manual oleh admin. Bila ditolak, dana dikembalikan otomatis.
        </p>
      </div>

      {/* Saldo per cabang */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Saldo per Cabang</h3>
        {loading && !data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat…</div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Belum ada cabang.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <div key={b.tenantId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 size={15} className="text-slate-400" />
                  <p className="truncate text-sm font-bold">{b.branchName}</p>
                </div>
                <p className="mt-2 text-xl font-black text-slate-900">{rupiah(b.available + b.pending)}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600">Tersedia {rupiah(b.available)}</span>
                  <span className="font-semibold text-amber-600">Tertahan {rupiah(b.pending)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat entri ledger */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Riwayat Transaksi Dompet <span className="font-normal text-slate-400">· {periodLabel}</span></h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-bold">Waktu</th>
                <th className="px-4 py-3 font-bold">Cabang</th>
                <th className="px-4 py-3 font-bold">Jenis</th>
                <th className="px-4 py-3 font-bold text-right">Nominal</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Belum ada transaksi dompet untuk filter ini.</td></tr>
              ) : (
                entries.map((e) => {
                  const credit = e.direction === 'credit';
                  const pending = Number(e.isPending) === 1;
                  return (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(e.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{e.branchName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-800">{TYPE_LABEL[e.type] || e.type}</span>
                        {e.orderId ? <span className="ml-1 text-xs text-slate-400">#{e.orderId}</span> : null}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${credit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        <span className="inline-flex items-center gap-1">
                          {credit ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {credit ? '+' : '−'}{rupiah(e.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {pending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Clock size={11} /> Tertahan</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Tersedia</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tarik Saldo */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => !submitting && setShowWithdraw(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><ArrowDownToLine size={18} className="text-sky-600" /> Tarik Saldo</h3>
              <button onClick={() => !submitting && setShowWithdraw(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={submitWithdraw} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Cabang (sumber saldo)</label>
                <select value={wForm.tenantId} onChange={(e) => setWForm((f) => ({ ...f, tenantId: e.target.value }))} required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500">
                  <option value="">Pilih cabang</option>
                  {branches.map((b) => (<option key={b.tenantId} value={b.tenantId}>{b.branchName} — tersedia {rupiah(b.available)}</option>))}
                </select>
                {selBranch && <p className="mt-1 text-[11px] text-slate-400">Saldo tersedia cabang ini: <b className="text-emerald-600">{rupiah(selBranch.available)}</b></p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Nominal (Rp)</label>
                <input type="number" min={10000} step={1000} required placeholder="Minimal 10.000" value={wForm.amount}
                  onChange={(e) => setWForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Rekening tujuan</label>
                <select value={wForm.bankAccountId} onChange={(e) => setWForm((f) => ({ ...f, bankAccountId: e.target.value }))} required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500">
                  <option value="">Pilih rekening</option>
                  {banks.map((b) => (<option key={b.id} value={b.id}>{b.bankName} {maskAcc(b.accountNumber)} — {b.accountHolder}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Catatan (opsional)</label>
                <input type="text" value={wForm.note} onChange={(e) => setWForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowWithdraw(false)} disabled={submitting}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Send size={15} /> Ajukan</>}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Dana direservasi saat diajukan. Transfer diproses manual oleh admin. Ditolak → dana kembali otomatis.</p>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Rekening */}
      {showAddBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => !addingBank && setShowAddBank(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Landmark size={18} className="text-sky-600" /> Tambah Rekening Bank</h3>
              <button onClick={() => !addingBank && setShowAddBank(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={submitAddBank} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Nama Bank</label>
                <input type="text" required placeholder="Contoh: BCA" value={bankForm.bankName}
                  onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Nomor Rekening</label>
                <input type="text" inputMode="numeric" required placeholder="6–20 digit" value={bankForm.accountNumber}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Nama Pemilik Rekening</label>
                <input type="text" required placeholder="Sesuai buku tabungan" value={bankForm.accountHolder}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountHolder: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={bankForm.isDefault} onChange={(e) => setBankForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                Jadikan rekening utama
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddBank(false)} disabled={addingBank}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={addingBank}
                  className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {addingBank ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
