import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  DollarSign
} from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';
import { downloadCsv, safeFilename } from '../lib/export';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ExportReportModal } from '../components/modals/ExportReportModal';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ShiftsPage({ activeBranchId, branches = [], setSuccessMessage }) {
  const [exportOpen, setExportOpen] = useState(false);

  const selectedBranchName = activeBranchId === 'all'
    ? 'Semua Outlet'
    : (branches.find(b => String(b.id) === String(activeBranchId))?.name || 'Outlet Utama');

  const shifts = useMemo(() => [
    {
      id: 'shift-3',
      cashierName: 'Kasir Bewok',
      branchName: 'Kopi Cisauk',
      openedAt: '16 Agu 2026, 07.00',
      closedAt: null,
      openingCash: 200000,
      expectedCash: 420000,
      countedCash: null,
      nonCashTotal: 396000,
      transactionCount: 5,
      status: 'berjalan'
    },
    {
      id: 'shift-2',
      cashierName: 'Kasir Ujang',
      branchName: 'Kopi Cisauk',
      openedAt: '15 Agu 2026, 15.00',
      closedAt: '15 Agu 2026, 22.00',
      openingCash: 200000,
      expectedCash: 580000,
      countedCash: 580000,
      nonCashTotal: 510000,
      transactionCount: 8,
      status: 'cocok'
    },
    {
      id: 'shift-1',
      cashierName: 'Kasir Rian Nugroho',
      branchName: 'Kopi Cisauk',
      openedAt: '15 Agu 2026, 07.00',
      closedAt: '15 Agu 2026, 15.00',
      openingCash: 200000,
      expectedCash: 340000,
      countedCash: 340000,
      nonCashTotal: 280000,
      transactionCount: 4,
      status: 'cocok'
    }
  ], []);

  const running = shifts.filter((shift) => shift.status === 'berjalan');
  const withGap = shifts.filter((shift) => shift.status === 'selisih');
  const totalGap = withGap.reduce(
    (sum, shift) => sum + ((shift.countedCash ?? 0) - shift.expectedCash),
    0
  );

  const handleDownloadCsv = () => {
    const scope = safeFilename(selectedBranchName);
    const stamp = today();
    const filename = safeFilename('tutup-kasir', scope, stamp);
    const headers = ["Outlet", "Kasir", "Dibuka", "Ditutup", "Modal Awal", "Kas Seharusnya", "Kas Dihitung", "Selisih Kas", "Non-Tunai", "Jumlah Transaksi", "Status"];
    const rows = shifts.map(s => [
      s.branchName,
      s.cashierName,
      s.openedAt,
      s.closedAt ?? 'Masih berjalan',
      s.openingCash,
      s.expectedCash,
      s.countedCash ?? '-',
      s.countedCash === null ? '-' : (s.countedCash - s.expectedCash),
      s.nonCashTotal,
      s.transactionCount,
      s.status
    ]);

    downloadCsv(filename, headers, rows);
    setSuccessMessage?.(`Laporan ${filename}.csv berhasil diunduh (${rows.length} baris data).`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Tutup kasir
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Setoran laci dan selisih kas di {selectedBranchName}.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleDownloadCsv}
          className="h-9 text-xs gap-1.5 bg-white border-[var(--color-hairline)] hover:bg-[var(--color-snow)] shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh CSV</span>
        </Button>
      </div>

      {/* 2. 3 Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 sm:p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <p className="text-xs font-semibold text-[var(--color-slate-muted)]">Shift berjalan</p>
          <p className="mt-1 font-heading text-2xl font-black text-[var(--color-ink)]">
            {running.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-slate-muted)]">Kasir yang belum tutup</p>
        </Card>

        <Card className="p-4 sm:p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <p className="text-xs font-semibold text-[var(--color-slate-muted)]">Shift selisih</p>
          <p className={cn(
            'mt-1 font-heading text-2xl font-black',
            withGap.length > 0 ? 'text-amber-600' : 'text-[var(--color-ink)]'
          )}>
            {withGap.length}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-slate-muted)]">Perlu ditelusuri</p>
        </Card>

        <Card className="p-4 sm:p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <p className="text-xs font-semibold text-[var(--color-slate-muted)]">Total selisih</p>
          <p className={cn(
            'mt-1 font-heading text-2xl font-black',
            totalGap < 0 ? 'text-rose-600' : totalGap > 0 ? 'text-emerald-600' : 'text-[var(--color-ink)]'
          )}>
            {formatRupiah(totalGap)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-slate-muted)]">Kekurangan atau kelebihan kas</p>
        </Card>
      </div>

      {/* 3. Riwayat Shift List */}
      <Card className="bg-white border-[var(--color-hairline)] shadow-2xs">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
            Riwayat shift
          </CardTitle>
          <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kas seharusnya = modal awal + penjualan tunai − pengeluaran laci
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <ul className="space-y-3">
            {shifts.map((shift) => {
              const gap = shift.countedCash === null ? null : shift.countedCash - shift.expectedCash;

              return (
                <li
                  key={shift.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    shift.status === 'selisih'
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-[var(--color-hairline)] bg-[var(--color-snow)]/50'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-ink)]">
                        {shift.cashierName}
                      </p>
                      <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                        {shift.branchName} • {shift.openedAt} → {shift.closedAt ?? "masih berjalan"}
                      </p>
                    </div>

                    <Badge
                      variant={
                        shift.status === 'berjalan' ? 'brand' : shift.status === 'selisih' ? 'warning' : 'success'
                      }
                      className="text-xs px-2.5 py-0.5 font-bold"
                    >
                      {shift.status === 'berjalan'
                        ? 'Sedang berjalan'
                        : shift.status === 'selisih'
                          ? 'Ada selisih'
                          : 'Cocok'}
                    </Badge>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t border-[var(--color-hairline)]">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                        Modal awal
                      </span>
                      <span className="block text-xs font-black text-[var(--color-ink)] mt-0.5">
                        {formatRupiah(shift.openingCash)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                        Kas seharusnya
                      </span>
                      <span className="block text-xs font-black text-[var(--color-ink)] mt-0.5">
                        {formatRupiah(shift.expectedCash)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                        Kas dihitung
                      </span>
                      <span className="block text-xs font-black text-[var(--color-ink)] mt-0.5">
                        {shift.countedCash === null ? '—' : formatRupiah(shift.countedCash)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                        Selisih
                      </span>
                      <span className={cn(
                        'block text-xs font-black mt-0.5',
                        gap === null ? 'text-[var(--color-slate-muted)]' : gap === 0 ? 'text-[var(--color-status-live)]' : 'text-rose-600'
                      )}>
                        {gap === null ? '—' : `${gap > 0 ? '+' : gap < 0 ? '−' : ''}${formatRupiah(Math.abs(gap))}`}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-[var(--color-slate-muted)] pt-2 border-t border-[var(--color-hairline)]">
                    {shift.transactionCount} transaksi • non-tunai {formatRupiah(shift.nonCashTotal)}
                  </p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
