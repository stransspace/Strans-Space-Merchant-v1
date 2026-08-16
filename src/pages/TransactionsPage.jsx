import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Search, 
  Radio, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  Receipt,
  FileText
} from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';

export default function TransactionsPage({ activeBranchId, branches = [] }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'success' | 'pending' | 'void'
  const [search, setSearch] = useState('');
  const [selectedVoidTx, setSelectedVoidTx] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const selectedBranchName = activeBranchId === 'all'
    ? 'Semua Outlet'
    : (branches.find(b => String(b.id) === String(activeBranchId))?.name || 'Outlet Utama');

  // Transactions data matching Image 2
  const rawTransactions = useMemo(() => [
    {
      id: 'tx-10',
      receiptNumber: 'A-010',
      customerName: 'Tanpa nama',
      totalAmount: 132000,
      timestamp: '16 Agu 2026, 16.13',
      branchName: 'Kopi Cisauk',
      cashierName: 'Kasir Bewok',
      paymentMethod: 'QRIS',
      status: 'Berhasil'
    },
    {
      id: 'tx-09',
      receiptNumber: 'A-009',
      customerName: 'Tanpa nama',
      totalAmount: 110000,
      timestamp: '16 Agu 2026, 11.35',
      branchName: 'Kopi Cisauk',
      cashierName: 'Kasir Ujang',
      paymentMethod: 'QRIS',
      status: 'Berhasil'
    },
    {
      id: 'tx-08',
      receiptNumber: 'A-008',
      customerName: 'Tanpa nama',
      totalAmount: 72600,
      timestamp: '16 Agu 2026, 08.27',
      branchName: 'Kopi Cisauk',
      cashierName: 'Kasir Rian Nugroho',
      paymentMethod: 'QRIS',
      status: 'Berhasil'
    },
    {
      id: 'tx-07',
      receiptNumber: 'A-007',
      customerName: 'Tanpa nama',
      totalAmount: 28600,
      timestamp: '16 Agu 2026, 08.19',
      branchName: 'Kopi Cisauk',
      cashierName: 'Kasir Rian Nugroho',
      paymentMethod: 'QRIS',
      status: 'Berhasil'
    },
    {
      id: 'tx-06',
      receiptNumber: 'A-006',
      customerName: 'Tanpa nama',
      totalAmount: 52800,
      timestamp: '16 Agu 2026, 07.45',
      branchName: 'Kopi Cisauk',
      cashierName: 'Kasir Rian Nugroho',
      paymentMethod: 'QRIS',
      status: 'Berhasil'
    }
  ], []);

  const counts = {
    all: rawTransactions.length,
    success: rawTransactions.filter(t => t.status === 'Berhasil').length,
    pending: rawTransactions.filter(t => t.status === 'Pending').length,
    void: rawTransactions.filter(t => t.status === 'Void').length,
  };

  const filteredTransactions = rawTransactions.filter(tx => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'success' && tx.status === 'Berhasil') ||
      (filter === 'pending' && tx.status === 'Pending') ||
      (filter === 'void' && tx.status === 'Void');

    const q = search.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      tx.receiptNumber.toLowerCase().includes(q) ||
      tx.customerName.toLowerCase().includes(q) ||
      tx.cashierName.toLowerCase().includes(q) ||
      tx.branchName.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const totalSuccessAmount = filteredTransactions
    .filter(t => t.status === 'Berhasil')
    .reduce((sum, t) => sum + t.totalAmount, 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Image 2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Transaksi
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Riwayat struk dari aplikasi kasir di {selectedBranchName}.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setExportOpen(true)}
          className="h-9 text-xs gap-1.5 bg-white border-[var(--color-hairline)] hover:bg-[var(--color-snow)] shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh CSV</span>
        </Button>
      </div>

      {/* 2. Main Transactions Card Container */}
      <Card className="rounded-2xl border border-[var(--color-hairline)] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        {/* Search & Filter Tabs Row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search bar */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-slate-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor struk, pembeli, atau kasir"
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status Filter Tabs Pill matching Image 2 */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--color-snow)] p-1 border border-[var(--color-hairline)] overflow-x-auto scroll-slim">
            {[
              { key: 'all', label: `Semua (${counts.all})` },
              { key: 'success', label: `Berhasil (${counts.success})` },
              { key: 'pending', label: `Menunggu (${counts.pending})` },
              { key: 'void', label: `Dibatalkan (${counts.void})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                  filter === tab.key
                    ? 'bg-white text-[var(--color-brand-800)] shadow-xs'
                    : 'text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Info Strip matching Image 2 */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl bg-[var(--color-snow)] px-3.5 py-2 text-xs border border-[var(--color-hairline)]">
          <span className="text-[var(--color-slate-muted)]">
            Menampilkan <strong className="text-[var(--color-ink)] font-black">{filteredTransactions.length}</strong> dari {counts.all} transaksi
          </span>
          <span className="text-[var(--color-slate-muted)]">
            Total berhasil <strong className="text-[var(--color-ink)] font-black">{formatRupiah(totalSuccessAmount)}</strong>
          </span>
        </div>

        {/* Live Radio Status Banner matching Image 2 */}
        <p className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-50)] border border-[var(--color-brand-200)] px-3.5 py-2 text-xs font-medium text-[var(--color-brand-900)]">
          <Radio className="h-3.5 w-3.5 text-[var(--color-brand-600)] animate-pulse shrink-0" />
          <span>
            <strong className="font-bold">{counts.all}</strong> transaksi dari aplikasi kasir, diperbarui otomatis tiap beberapa detik.
          </span>
        </p>

        {/* Transactions Table matching Image 2 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--color-slate-muted)] uppercase text-[10px] font-bold tracking-wider border-b border-[var(--color-hairline)]">
              <tr>
                <th className="py-3 px-3">NO. STRUK</th>
                <th className="py-3 px-3">WAKTU &amp; PEMBELI</th>
                <th className="py-3 px-3">METODE BAYAR</th>
                <th className="py-3 px-3">OUTLET / KASIR</th>
                <th className="py-3 px-3 text-right">TOTAL</th>
                <th className="py-3 px-3 text-right">STATUS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-hairline)]">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--color-snow)]/60 transition-colors">
                  {/* NO. STRUK */}
                  <td className="py-3.5 px-3 font-mono font-bold text-[var(--color-brand-800)]">
                    {tx.receiptNumber}
                  </td>

                  {/* WAKTU & PEMBELI */}
                  <td className="py-3.5 px-3">
                    <p className="font-bold text-[var(--color-ink)]">{tx.customerName}</p>
                    <p className="text-[11px] text-[var(--color-slate-muted)] font-mono mt-0.5">{tx.timestamp}</p>
                  </td>

                  {/* METODE BAYAR */}
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                      {tx.paymentMethod}
                    </span>
                  </td>

                  {/* OUTLET / KASIR */}
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-[var(--color-slate-body)]">{tx.branchName}</p>
                    <p className="text-[11px] text-[var(--color-slate-muted)]">{tx.cashierName}</p>
                  </td>

                  {/* TOTAL */}
                  <td className="py-3.5 px-3 text-right font-black text-[var(--color-ink)] text-sm">
                    {formatRupiah(tx.totalAmount)}
                  </td>

                  {/* STATUS */}
                  <td className="py-3.5 px-3 text-right">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="max-w-sm">
        <DialogHeader onClose={() => setExportOpen(false)}>
          <DialogTitle>Unduh CSV Transaksi</DialogTitle>
          <DialogDescription>Ekspor seluruh daftar struk kasir.</DialogDescription>
        </DialogHeader>
        <DialogContent className="pt-3 text-xs text-[var(--color-slate-body)]">
          File CSV mencakup rincian nomor struk, waktu transaksi, outlet, nama kasir, metode pembayaran, dan nominal total.
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setExportOpen(false)}>Batal</Button>
          <Button onClick={() => {
            setExportOpen(false);
            window.print();
          }}>Unduh Sekarang</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
