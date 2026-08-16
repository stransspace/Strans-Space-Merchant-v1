import React, { useEffect, useState } from 'react';
import {
  Wallet, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Building2, 
  Info,
  TrendingUp, 
  Receipt, 
  Coins, 
  Hash, 
  Landmark, 
  Plus, 
  Trash2, 
  X, 
  ArrowDownToLine, 
  Send,
  CreditCard
} from 'lucide-react';
import { getWallet, getBankAccounts, addBankAccount, deleteBankAccount, requestPayout, getPayouts } from '../lib/api';
import { formatRupiah, formatDateTime, formatDate, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';

const TYPE_LABEL = {
  sale: 'Penjualan', platform_fee: 'Biaya Platform', gateway_fee: 'Biaya Gateway',
  payout: 'Penarikan Dana', payout_reversal: 'Pengembalian Penarikan', refund: 'Refund', adjustment: 'Penyesuaian',
};

const PERIODS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'all', label: 'Semua Waktu' },
];

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
  const [bankForm, setBankForm] = useState({ bankName: 'BCA', accountNumber: '', accountHolder: '', isDefault: true });
  const [addingBank, setAddingBank] = useState(false);

  const load = async (opts = {}) => {
    setLoading(true);
    try {
      const res = await getWallet({ period: opts.period ?? period, branch: opts.branch ?? branch });
      setData(res?.data || null);
    } catch (err) {
      setActionError?.(err.message || 'Gagal memuat saldo dompet.');
    } finally {
      setLoading(false);
    }
  };

  const loadExtras = async () => {
    try {
      const [b, p] = await Promise.all([getBankAccounts(), getPayouts()]);
      setBanks(b?.data || []);
      setPayouts(p?.data || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { load(); }, [period, branch]);
  useEffect(() => { loadExtras(); }, []);

  const company = data?.company || { available: 0, pending: 0, total: 0 };
  const branches = data?.branches || [];
  const entries = data?.entries || [];

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
      setSuccessMessage?.(res?.message || 'Penarikan berhasil diajukan.');
      await Promise.all([load(), loadExtras()]);
    } catch (err) {
      setActionError?.(err.message || 'Gagal mengajukan penarikan.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAddBank = async (e) => {
    e.preventDefault();
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountHolder) {
      setActionError?.('Semua kolom data rekening bank wajib diisi.');
      return;
    }
    setAddingBank(true);
    try {
      await addBankAccount({ ...bankForm, isDefault: !!bankForm.isDefault });
      setShowAddBank(false);
      setBankForm({ bankName: 'BCA', accountNumber: '', accountHolder: '', isDefault: true });
      setSuccessMessage?.('Rekening penarikan berhasil ditambahkan.');
      await loadExtras();
    } catch (err) {
      setActionError?.(err.message || 'Gagal menambahkan rekening.');
    } finally {
      setAddingBank(false);
    }
  };

  const handleDeleteBank = async (id, name) => {
    if (!(await confirmAction(`Hapus rekening "${name}"?`, { title: 'Hapus Rekening', confirmText: 'Ya, hapus' }))) return;
    try {
      await deleteBankAccount(id);
      setSuccessMessage?.('Rekening berhasil dihapus.');
      await loadExtras();
    } catch (err) {
      setActionError?.(err.message || 'Gagal menghapus rekening.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Dompet & Settlement Saldo
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kelola saldo QRIS / transfer digital, penarikan dana ke rekening bank, dan histori mutasi settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={openWithdraw} className="shadow-md">
            <ArrowDownToLine className="h-4 w-4" />
            <span>Tarik Saldo</span>
          </Button>

          <Button variant="outline" onClick={() => { load(); loadExtras(); }} className="h-10 w-10 p-0">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Saldo Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5 bg-gradient-to-br from-white to-[var(--color-brand-50)]/60 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-slate-muted)]">Saldo Siap Ditarik</span>
            <Wallet className="h-5 w-5 text-[var(--color-brand-600)]" />
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--color-brand-800)]">
            {formatRupiah(company.available || 0)}
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-white to-amber-50/30 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-slate-muted)]">Settlement Pending</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {formatRupiah(company.pending || 0)}
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--color-slate-muted)]">Total Akumulasi Saldo</span>
            <Coins className="h-5 w-5 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--color-ink)]">
            {formatRupiah(company.total || 0)}
          </div>
        </Card>
      </div>

      {/* Rekening Bank Card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rekening Bank Penarikan</CardTitle>
              <CardDescription>Rekening tujuan pencairan hasil penjualan non-tunai kasir.</CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowAddBank(true)} className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Rekening</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {banks.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-slate-muted)]">
              Belum ada rekening bank yang didaftarkan.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {banks.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)] p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-[var(--color-brand-600)]" />
                      <span className="font-bold text-xs text-[var(--color-ink)]">{b.bank_name || b.bankName}</span>
                    </div>
                    {Number(b.is_default || b.isDefault) === 1 && (
                      <Badge variant="brand" className="text-[9px]">Utama</Badge>
                    )}
                  </div>

                  <div>
                    <div className="font-mono font-bold text-sm text-[var(--color-ink)]">
                      {b.account_number || b.accountNumber}
                    </div>
                    <div className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      a/n {b.account_holder || b.accountHolder}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-[var(--color-hairline)]">
                    <button
                      type="button"
                      onClick={() => handleDeleteBank(b.id, b.account_holder || b.accountHolder)}
                      className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mutasi Ledger Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle>Histori Mutasi Dompet</CardTitle>
            <div className="flex rounded-xl bg-[var(--color-brand-50)] p-1 border border-[var(--color-hairline)]">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                    period === p.key
                      ? 'bg-white text-[var(--color-brand-800)] shadow-xs'
                      : 'text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Belum ada mutasi saldo pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Waktu</th>
                    <th className="px-4 py-3.5">Tipe Transaksi</th>
                    <th className="px-4 py-3.5">Keterangan</th>
                    <th className="px-6 py-3.5 text-right">Nominal</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {entries.map((item, idx) => {
                    const isCredit = Number(item.amount || 0) > 0;

                    return (
                      <tr key={idx} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--color-slate-muted)]">
                          {formatDateTime(item.created_at || item.createdAt)}
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge variant={isCredit ? 'success' : 'danger'}>
                            {TYPE_LABEL[item.type] || item.type}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5 text-[var(--color-slate-body)] font-medium">
                          {item.description || item.note || '-'}
                        </td>

                        <td className={cn('px-6 py-3.5 text-right font-black text-sm', isCredit ? 'text-emerald-700' : 'text-rose-600')}>
                          {isCredit ? `+ ${formatRupiah(item.amount)}` : `- ${formatRupiah(Math.abs(item.amount))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Tambah Rekening */}
      <Dialog open={showAddBank} onClose={() => setShowAddBank(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowAddBank(false)}>
          <DialogTitle>Tambah Rekening Bank</DialogTitle>
          <DialogDescription>Masukkan detail rekening bank penarikan saldo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submitAddBank}>
          <DialogContent className="space-y-3.5 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Bank</label>
              <Select
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
              >
                <option value="BCA">Bank Central Asia (BCA)</option>
                <option value="Mandiri">Bank Mandiri</option>
                <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                <option value="BNI">Bank Negara Indonesia (BNI)</option>
                <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                <option value="CIMB">CIMB Niaga</option>
                <option value="Jago">Bank Jago</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nomor Rekening</label>
              <Input
                required
                placeholder="Contoh: 1234567890"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Pemilik Rekening</label>
              <Input
                required
                placeholder="Sesuai buku tabungan"
                value={bankForm.accountHolder}
                onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowAddBank(false)} disabled={addingBank}>
              Batal
            </Button>
            <Button type="submit" disabled={addingBank}>
              {addingBank ? 'Menyimpan...' : 'Simpan Rekening'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: Tarik Saldo (Payout) */}
      <Dialog open={showWithdraw} onClose={() => setShowWithdraw(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowWithdraw(false)}>
          <DialogTitle>Tarik Saldo ke Rekening Bank</DialogTitle>
          <DialogDescription>Dana akan ditransfer otomatis ke rekening pilihan Anda.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submitWithdraw}>
          <DialogContent className="space-y-3.5 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Rekening Tujuan</label>
              <Select
                value={wForm.bankAccountId}
                onChange={(e) => setWForm({ ...wForm, bankAccountId: e.target.value })}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name || b.bankName} - {b.account_number || b.accountNumber} ({b.account_holder || b.accountHolder})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nominal Penarikan (Rp)</label>
              <Input
                type="number"
                min="10000"
                required
                placeholder="Minimal Rp 10.000"
                value={wForm.amount}
                onChange={(e) => setWForm({ ...wForm, amount: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Catatan (Opsional)</label>
              <Input
                placeholder="Penarikan mingguan"
                value={wForm.note}
                onChange={(e) => setWForm({ ...wForm, note: e.target.value })}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowWithdraw(false)} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Ajukan Penarikan'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
