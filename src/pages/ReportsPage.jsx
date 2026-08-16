import React, { useState, useMemo } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Lock, 
  Mail, 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Layers,
  ShoppingBasket,
  ClipboardCheck,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';
import { downloadCsv, safeFilename } from '../lib/export';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import { ExportReportModal } from '../components/modals/ExportReportModal';

const RANGES = [
  { key: 'today', label: 'Hari ini', caption: '12 Agustus 2026' },
  { key: '7d', label: '7 hari', caption: '5 – 12 Agustus 2026' },
  { key: '30d', label: '30 hari', caption: '14 Juli – 12 Agustus 2026' },
  { key: '90d', label: '90 hari', caption: '14 Mei – 12 Agustus 2026' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage({ activeBranchId, branches = [], onOpenUpgrade, setSuccessMessage }) {
  const [rangeKey, setRangeKey] = useState('30d');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [defaultReportKind, setDefaultReportKind] = useState('transactions');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const selectedBranchName = activeBranchId === 'all'
    ? 'Semua Outlet'
    : (branches.find(b => String(b.id) === String(activeBranchId))?.name || 'Outlet Utama');

  const activeRange = RANGES.find(r => r.key === rangeKey) || RANGES[2];

  // Dynamic metrics per period
  const dynamicData = useMemo(() => {
    if (rangeKey === 'today') {
      return {
        chart: [
          { date: '08:00', revenue: 45000, profit: 31000 },
          { date: '10:00', revenue: 78000, profit: 53000 },
          { date: '12:00', revenue: 110000, profit: 75000 },
          { date: '14:00', revenue: 95000, profit: 64000 },
          { date: '16:00', revenue: 68000, profit: 45000 },
        ],
        pl: {
          grossRevenue: 396000,
          discounts: 0,
          netRevenue: 396000,
          hpp: 128000,
          grossProfit: 268000,
          operationalExpenses: 45000,
          taxes: 0,
          netProfit: 223000,
          marginPercentage: 56
        }
      };
    } else if (rangeKey === '7d') {
      return {
        chart: [
          { date: '5 Ags', revenue: 85000, profit: 58000 },
          { date: '6 Ags', revenue: 95000, profit: 65000 },
          { date: '7 Ags', revenue: 110000, profit: 75000 },
          { date: '8 Ags', revenue: 130000, profit: 89000 },
          { date: '9 Ags', revenue: 145000, profit: 99000 },
          { date: '10 Ags', revenue: 120000, profit: 82000 },
          { date: '11 Ags', revenue: 160000, profit: 110000 },
          { date: '12 Ags', revenue: 190000, profit: 130000 },
        ],
        pl: {
          grossRevenue: 1035000,
          discounts: 25000,
          netRevenue: 1010000,
          hpp: 335000,
          grossProfit: 675000,
          operationalExpenses: 120000,
          taxes: 0,
          netProfit: 555000,
          marginPercentage: 55
        }
      };
    } else if (rangeKey === '90d') {
      return {
        chart: [
          { date: 'Mei', revenue: 2100000, profit: 1420000 },
          { date: 'Jun', revenue: 2650000, profit: 1810000 },
          { date: 'Jul', revenue: 2870000, profit: 1950000 },
        ],
        pl: {
          grossRevenue: 7620000,
          discounts: 180000,
          netRevenue: 7440000,
          hpp: 2450000,
          grossProfit: 4990000,
          operationalExpenses: 900000,
          taxes: 0,
          netProfit: 4090000,
          marginPercentage: 55
        }
      };
    }

    // Default 30d
    return {
      chart: [
        { date: '14 Jul', revenue: 65000, profit: 44000 },
        { date: '18 Jul', revenue: 85000, profit: 58000 },
        { date: '22 Jul', revenue: 110000, profit: 75000 },
        { date: '26 Jul', revenue: 95000, profit: 65000 },
        { date: '30 Jul', revenue: 130000, profit: 89000 },
        { date: '4 Ags', revenue: 145000, profit: 99000 },
        { date: '8 Ags', revenue: 120000, profit: 82000 },
        { date: '12 Ags', revenue: 160000, profit: 110000 },
      ],
      pl: {
        grossRevenue: 2840000,
        discounts: 65000,
        netRevenue: 2775000,
        hpp: 920000,
        grossProfit: 1855000,
        operationalExpenses: 320000,
        taxes: 0,
        netProfit: 1535000,
        marginPercentage: 55
      }
    };
  }, [rangeKey]);

  const maxChartValue = Math.max(...dynamicData.chart.map(d => d.revenue), 160000);

  const plRows = [
    { label: "Omset kotor", value: dynamicData.pl.grossRevenue, kind: "add" },
    { label: "Diskon & promo", value: -dynamicData.pl.discounts, kind: "subtract" },
    { label: "Omset bersih", value: dynamicData.pl.netRevenue, kind: "subtotal" },
    { label: "HPP (biaya bahan)", value: -dynamicData.pl.hpp, kind: "subtract" },
    { label: "Laba kotor", value: dynamicData.pl.grossProfit, kind: "subtotal" },
    { label: "Biaya operasional", value: -dynamicData.pl.operationalExpenses, kind: "subtract" },
    { label: "Pajak (PB1)", value: -dynamicData.pl.taxes, kind: "subtract" },
  ];

  // Direct CSV Downloads
  const downloadReportDirectly = (kind) => {
    const scope = safeFilename(selectedBranchName);
    const stamp = today();

    let filename = '';
    let headers = [];
    let rows = [];

    if (kind === 'transactions') {
      filename = safeFilename('transaksi', scope, stamp);
      headers = ["No. Struk", "Waktu", "Pembeli", "Total Tagihan", "Metode Bayar", "Outlet", "Kasir", "Status"];
      rows = [
        ["A-010", "16 Agu 2026, 16.13", "Tanpa nama", 132000, "QRIS", "Kopi Cisauk", "Kasir Bewok", "Berhasil"],
        ["A-009", "16 Agu 2026, 11.35", "Tanpa nama", 110000, "QRIS", "Kopi Cisauk", "Kasir Ujang", "Berhasil"],
        ["A-008", "16 Agu 2026, 08.27", "Tanpa nama", 72600, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
        ["A-007", "16 Agu 2026, 08.19", "Tanpa nama", 28600, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
        ["A-006", "16 Agu 2026, 07.45", "Tanpa nama", 52800, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
      ];
    } else if (kind === 'inventory') {
      filename = safeFilename('stok-bahan', scope, stamp);
      headers = ["Nama Bahan", "Kategori", "Satuan", "Sisa Stok", "Stok Minimum", "HPP Satuan", "Outlet", "Status"];
      rows = [
        ["Biji Kopi Arabica Gayo", "Kopi", "Gram", 4200, 1000, 180, "Kopi Cisauk", "Aman"],
        ["Susu UHT Fresh Milk", "Dairy", "Mililiter", 6500, 2000, 22, "Kopi Cisauk", "Aman"],
        ["Sirup Caramel Premium", "Flavour", "Mililiter", 1200, 500, 85, "Kopi Cisauk", "Aman"],
        ["Gula Aren Cair Organik", "Pemanis", "Mililiter", 850, 1000, 35, "Kopi Cisauk", "Menipis"],
        ["Cup Plastik 16oz + Tutup", "Packaging", "Pcs", 340, 100, 650, "Kopi Cisauk", "Aman"],
      ];
    } else if (kind === 'products') {
      filename = safeFilename('produk-terlaris', scope, stamp);
      headers = ["Nama Menu", "Kategori", "Jumlah Terjual", "Total Omset", "Total HPP", "Laba Kotor"];
      rows = [
        ["Kopi Susu Aren Signature", "Kopi", 12, 336000, 96000, 240000],
        ["Caramel Macchiato", "Kopi", 8, 272000, 80000, 192000],
        ["Americano Double Shot", "Kopi", 6, 168000, 36000, 132000],
        ["Ice Matcha Latte", "Non-Coffee", 4, 128000, 48000, 80000],
        ["Croissant Butter", "Pastry", 5, 140000, 60000, 80000],
      ];
    } else {
      filename = safeFilename('tutup-kasir', scope, stamp);
      headers = ["Outlet", "Kasir", "Shift", "Modal Awal", "Kas Seharusnya", "Kas Dihitung", "Selisih Kas", "Total Non-Tunai", "Status"];
      rows = [
        ["Kopi Cisauk", "Kasir Bewok", "Shift Pagi (07:00 - 15:00)", 200000, 420000, 420000, 0, 396000, "Sesuai"],
        ["Kopi Cisauk", "Kasir Ujang", "Shift Sore (15:00 - 22:00)", 200000, 580000, 580000, 0, 510000, "Sesuai"],
      ];
    }

    downloadCsv(filename, headers, rows);
    setSuccessMessage?.(`Laporan ${filename}.csv berhasil diunduh (${rows.length} baris data).`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Laporan
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Rekap {selectedBranchName} untuk pembukuan dan pelaporan pajak.
          </p>
        </div>

        <Button
          onClick={() => {
            setDefaultReportKind('transactions');
            setExportModalOpen(true);
          }}
          className="h-9 text-xs gap-1.5 shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh laporan</span>
        </Button>
      </div>

      {/* 2. Date Range Filter Bar (Functional) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--color-hairline)] bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-slate-body)]">
          <Calendar className="h-4 w-4 text-[var(--color-brand-600)]" />
          <span>Periode</span>
          <span className="font-semibold text-[var(--color-slate-muted)]">{activeRange.caption}</span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-snow)] p-1 border border-[var(--color-hairline)]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer',
                rangeKey === r.key
                  ? 'bg-white text-[var(--color-ink)] shadow-xs'
                  : 'text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Sales Trend & Profit Loss Card Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Tren Omset & Laba */}
        <Card className="lg:col-span-2 p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Tren omset & laba
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)]">
                {activeRange.caption}
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-600)]" />
                <span className="font-semibold text-[var(--color-slate-body)]">Omset</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-[var(--color-slate-body)]">Laba bersih</span>
              </div>
            </div>
          </div>

          {/* Interactive Dynamic Chart */}
          <div className="h-56 w-full flex items-end justify-between gap-2 pt-6 pb-2 border-b border-[var(--color-hairline)]">
            {dynamicData.chart.map((d, idx) => {
              const hPct = Math.round((d.revenue / maxChartValue) * 100);
              const pPct = Math.round((d.profit / maxChartValue) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-ink)] text-white text-[10px] rounded-lg p-1.5 shadow-lg whitespace-nowrap z-20 pointer-events-none">
                    <div className="font-bold">{d.date}</div>
                    <div>Omset: {formatRupiah(d.revenue)}</div>
                    <div>Laba: {formatRupiah(d.profit)}</div>
                  </div>

                  <div className="w-full max-w-[28px] h-44 flex items-end justify-center gap-1 rounded-t-lg bg-[var(--color-snow)] p-0.5">
                    <div
                      className="w-1/2 rounded-t-md bg-gradient-to-t from-[var(--color-brand-600)] to-[var(--color-brand-400)] transition-all duration-300"
                      style={{ height: `${hPct}%` }}
                    />
                    <div
                      className="w-1/2 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-300"
                      style={{ height: `${pPct}%` }}
                    />
                  </div>

                  <span className="text-[10px] font-bold text-[var(--color-slate-muted)] mt-1">
                    {d.date}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Profit & Loss Breakdown Card */}
        <Card className="p-5 bg-white border-[var(--color-hairline)] shadow-2xs flex flex-col justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
              Ringkasan laba rugi
            </CardTitle>
            <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
              Estimasi — biaya operasional dirata-ratakan, belum per transaksi
            </CardDescription>

            <dl className="space-y-1 mt-4">
              {plRows.map((row) => (
                <div
                  key={row.label}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-xs',
                    row.kind === 'subtotal' && 'bg-[var(--color-snow)] font-bold'
                  )}
                >
                  <dt className={cn(
                    row.kind === 'subtotal' ? 'text-[var(--color-ink)]' : 'text-[var(--color-slate-muted)]'
                  )}>
                    {row.label}
                  </dt>
                  <dd className={cn(
                    'font-mono font-bold',
                    row.kind === 'subtract' ? 'text-rose-600' : 'text-[var(--color-ink)]'
                  )}>
                    {row.value < 0 ? '−' : ''}
                    {formatRupiah(Math.abs(row.value))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[var(--color-brand-600)] to-[var(--color-brand-800)] p-3.5 text-white shadow-xs">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                Laba bersih
              </p>
              <p className="font-heading text-lg font-black">{formatRupiah(dynamicData.pl.netProfit)}</p>
            </div>

            <Badge variant="outline" className="border-white/30 bg-white/20 text-white text-xs font-bold px-2.5 py-1">
              Margin {dynamicData.pl.marginPercentage}%
            </Badge>
          </div>
        </Card>
      </div>

      {/* 4. Card: Berkas yang bisa diunduh (Functional CSV Direct Download) */}
      <Card className="p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
            Berkas yang bisa diunduh
          </CardTitle>
          <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Format CSV, terbaca langsung di Excel dan Google Sheets
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 grid gap-3 sm:grid-cols-2">
          {/* Card 1: Transaksi */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)]/60 p-4 hover:border-[var(--color-brand-300)] transition-all">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] shrink-0">
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-bold text-xs text-[var(--color-ink)]">Transaksi</p>
                <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">Seluruh struk beserta metode bayar dan statusnya.</p>
                <p className="text-[10px] font-bold text-[var(--color-brand-800)] font-mono mt-1.5">5 baris data</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => downloadReportDirectly('transactions')}
              className="h-8 w-8 rounded-xl bg-white shrink-0 shadow-2xs cursor-pointer hover:bg-[var(--color-brand-50)]"
              title="Unduh CSV Transaksi"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Card 2: Stok Bahan Baku */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)]/60 p-4 hover:border-[var(--color-brand-300)] transition-all">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] shrink-0">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-bold text-xs text-[var(--color-ink)]">Stok bahan baku</p>
                <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">Sisa stok, minimum, HPP, dan harga beli per outlet.</p>
                <p className="text-[10px] font-bold text-[var(--color-brand-800)] font-mono mt-1.5">8 baris data</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => downloadReportDirectly('inventory')}
              className="h-8 w-8 rounded-xl bg-white shrink-0 shadow-2xs cursor-pointer hover:bg-[var(--color-brand-50)]"
              title="Unduh CSV Stok Bahan"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Card 3: Produk Terlaris */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)]/60 p-4 hover:border-[var(--color-brand-300)] transition-all">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] shrink-0">
                <ShoppingBasket className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-bold text-xs text-[var(--color-ink)]">Produk terlaris</p>
                <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">Jumlah terjual, omset, dan HPP tiap produk.</p>
                <p className="text-[10px] font-bold text-[var(--color-brand-800)] font-mono mt-1.5">5 baris data</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => downloadReportDirectly('products')}
              className="h-8 w-8 rounded-xl bg-white shrink-0 shadow-2xs cursor-pointer hover:bg-[var(--color-brand-50)]"
              title="Unduh CSV Produk Terlaris"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Card 4: Tutup Kasir */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)]/60 p-4 hover:border-[var(--color-brand-300)] transition-all">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] shrink-0">
                <ClipboardCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-bold text-xs text-[var(--color-ink)]">Tutup kasir</p>
                <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">Setoran laci, total non-tunai, dan selisih kas.</p>
                <p className="text-[10px] font-bold text-[var(--color-brand-800)] font-mono mt-1.5">3 baris data</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => downloadReportDirectly('shifts')}
              className="h-8 w-8 rounded-xl bg-white shrink-0 shadow-2xs cursor-pointer hover:bg-[var(--color-brand-50)]"
              title="Unduh CSV Tutup Kasir"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 5. Scheduled Reports Card */}
      <Card className="border-dashed border-[var(--color-hairline)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[var(--color-slate-muted)] shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[var(--color-ink)]">Laporan terjadwal</span>
                <Badge variant="warning" className="text-[10px] gap-1 px-1.5 py-0">
                  <Lock className="h-2.5 w-2.5" />
                  <span>Paket lebih tinggi</span>
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                Rekap harian dikirim otomatis ke surel setiap malam, tanpa perlu membuka dashboard.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setUpgradeOpen(true)}
            className="text-xs shrink-0 bg-white"
          >
            Lihat paket
          </Button>
        </div>
      </Card>

      {/* Export Dialog Modal */}
      <ExportReportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultReport={defaultReportKind}
        selectedBranchName={selectedBranchName}
        onSuccess={(msg) => setSuccessMessage?.(msg)}
      />

      {/* Upgrade Dialog Modal */}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setUpgradeOpen(false)}>
          <DialogTitle>Tingkatkan ke Juragan Space Pro</DialogTitle>
          <DialogDescription>Aktifkan laporan terjadwal otomatis langsung ke WhatsApp &amp; Email.</DialogDescription>
        </DialogHeader>
        <DialogContent className="pt-3 text-xs text-[var(--color-slate-body)] space-y-3">
          <p>
            Dengan paket Pro, Anda mendapatkan pengiriman rekap omset harian otomatis ke surel owner setiap jam 23:59 WIB.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Tutup</Button>
          <Button onClick={() => setUpgradeOpen(false)}>Hubungi Sales</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
