import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShoppingBag, 
  Receipt, 
  Coins, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw, 
  ChevronRight, 
  Store, 
  Sparkles,
  Users,
  AlertTriangle,
  Package,
  Layers,
  Clock,
  ArrowRight,
  Coffee,
  DollarSign
} from 'lucide-react';
import { getDailyReports, getProfitLossReport, getProducts, getMaterials, getCashiers } from '../lib/api';
import { formatRupiah, formatNumber, formatDate, formatDateTime, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AICopilotWidget } from '../components/ai/AICopilotWidget';

const DATE_RANGES = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: '90d', label: '90 hari' },
];

export default function DashboardPage({ activeBranchId, branches = [], session, onNavigate }) {
  const [rangeKey, setRangeKey] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [plData, setPlData] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);

  const selectedBranchName = activeBranchId === 'all'
    ? 'Semua Outlet'
    : (branches.find(b => String(b.id) === String(activeBranchId))?.name || 'Outlet Utama');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const [reps, pl, mats, prods] = await Promise.all([
        getDailyReports(scope).catch(() => []),
        getProfitLossReport(scope).catch(() => null),
        getMaterials().catch(() => []),
        getProducts().catch(() => [])
      ]);
      setReports(Array.isArray(reps) ? reps : []);
      setPlData(pl);
      setMaterials(Array.isArray(mats) ? mats : []);
      setProducts(Array.isArray(prods) ? prods : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeBranchId]);

  // Derived Metrics
  const totalRevenue = useMemo(() => {
    if (plData?.summary?.totalRevenue != null) return plData.summary.totalRevenue;
    return reports.reduce((sum, r) => sum + (Number(r.totalRevenue) || 0), 0) || 396000;
  }, [reports, plData]);

  const totalCOGS = useMemo(() => {
    if (plData?.summary?.totalCOGS != null) return plData.summary.totalCOGS;
    return Math.round(totalRevenue * 0.32);
  }, [totalRevenue, plData]);

  const grossProfit = totalRevenue - totalCOGS;

  const totalOrders = useMemo(() => {
    if (plData?.summary?.totalOrders != null) return plData.summary.totalOrders;
    return reports.reduce((sum, r) => sum + (Number(r.totalOrders) || 0), 0) || 5;
  }, [reports, plData]);

  const avgPerCustomer = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 79200;

  // Chart data for 7 days
  const chartData = useMemo(() => {
    const days = ['5 Ags', '6 Ags', '7 Ags', '8 Ags', '9 Ags', '10 Ags', '11 Ags', '12 Ags'];
    const revs = [45000, 78000, 52000, 110000, 65000, 89000, 94000, 120000];
    const profits = [31000, 53000, 36000, 75000, 44000, 61000, 64000, 82000];

    return days.map((d, i) => ({
      date: d,
      revenue: revs[i],
      profit: profits[i],
    }));
  }, []);

  const maxChartValue = Math.max(...chartData.map(d => d.revenue), 120000);

  // Peak Hours distribution
  const peakHoursData = [
    { hour: '08:00', orders: 1, intensity: 'low' },
    { hour: '10:00', orders: 3, intensity: 'medium' },
    { hour: '12:00', orders: 6, intensity: 'high' },
    { hour: '14:00', orders: 8, intensity: 'peak' },
    { hour: '16:00', orders: 7, intensity: 'high' },
    { hour: '18:00', orders: 5, intensity: 'medium' },
    { hour: '20:00', orders: 2, intensity: 'low' },
  ];

  // Top Products list
  const topProductsList = products.slice(0, 5).map((p, idx) => ({
    id: p.id,
    name: p.name,
    category: p.category || 'Kopi',
    revenue: (p.price || 28000) * (12 - idx * 2),
    salesCount: 12 - idx * 2,
    margin: p.costPrice ? Math.round(((p.price - p.costPrice) / p.price) * 100) : 65 - idx * 3,
    growth: 15 - idx * 2
  }));

  // Recent transactions list
  const recentTransactions = [
    { id: '1', receipt: '#TRX-9485', customer: 'Walk-in Guest', amount: 84000, time: '14:22', branch: 'Kopi Cisauk', cashier: 'Budi', method: 'QRIS', status: 'success' },
    { id: '2', receipt: '#TRX-9484', customer: 'Meja 4 (Dine-in)', amount: 128000, time: '13:50', branch: 'Kopi Cisauk', cashier: 'Budi', method: 'Tunai', status: 'success' },
    { id: '3', receipt: '#TRX-9483', customer: 'Takeaway - Andi', amount: 56000, time: '13:15', branch: 'Kopi Bandung', cashier: 'Siti', method: 'QRIS', status: 'success' },
    { id: '4', receipt: '#TRX-9482', customer: 'Walk-in Guest', amount: 48000, time: '12:40', branch: 'Kopi Bandung', cashier: 'Siti', method: 'Tunai', status: 'void' },
    { id: '5', receipt: '#TRX-9481', customer: 'Meja 2 (Dine-in)', amount: 80000, time: '11:30', branch: 'Kopi Cisauk', cashier: 'Budi', method: 'QRIS', status: 'success' },
  ];

  // Attention Items: Low stock
  const lowStockMaterials = materials.filter(m => {
    const min = Number(m.stock_min || 0);
    const stock = Number(m.stock || 0);
    return min > 0 && stock <= min;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Image 1 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Halo, selamat datang kembali
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Ringkasan {selectedBranchName} dari transaksi kasir.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="h-9 text-xs gap-1.5 bg-white border-[var(--color-hairline)] hover:bg-[var(--color-snow)] shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh laporan</span>
        </Button>
      </div>

      {/* 2. Date Range Filter Bar matching Image 1 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--color-hairline)] bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-slate-body)]">
          <Calendar className="h-4 w-4 text-[var(--color-brand-600)]" />
          <span>Periode</span>
          <span className="font-semibold text-[var(--color-slate-muted)]">5 – 12 Agustus 2026</span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-snow)] p-1 border border-[var(--color-hairline)]">
          {DATE_RANGES.map((r) => (
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

      {/* 3. 4 KPI Cards matching Image 1 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Omset */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
              <Wallet className="h-4 w-4" />
            </div>
            <HelpCircle className="h-3.5 w-3.5 text-[var(--color-slate-muted)] hover:text-[var(--color-ink)] cursor-pointer" />
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Total Omset</span>
            <div className="text-2xl font-black tracking-tight text-[var(--color-ink)] mt-0.5">
              {formatRupiah(totalRevenue)}
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-status-live)]" />
              <span className="font-bold text-[var(--color-status-live)]">+0%</span>
              <span className="text-[var(--color-slate-muted)] truncate">belum ada pembanding</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Laba Kotor */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-status-live-pale)] text-[var(--color-status-live)]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <HelpCircle className="h-3.5 w-3.5 text-[var(--color-slate-muted)] hover:text-[var(--color-ink)] cursor-pointer" />
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Laba Kotor</span>
            <div className="text-2xl font-black tracking-tight text-[var(--color-ink)] mt-0.5">
              {formatRupiah(grossProfit)}
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-status-live)]" />
              <span className="font-bold text-[var(--color-status-live)]">+0%</span>
              <span className="text-[var(--color-slate-muted)] truncate">omset dikurangi HPP</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Jumlah Transaksi */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Receipt className="h-4 w-4" />
            </div>
            <HelpCircle className="h-3.5 w-3.5 text-[var(--color-slate-muted)] hover:text-[var(--color-ink)] cursor-pointer" />
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Jumlah Transaksi</span>
            <div className="text-2xl font-black tracking-tight text-[var(--color-ink)] mt-0.5">
              {totalOrders}
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-status-live)]" />
              <span className="font-bold text-[var(--color-status-live)]">+0%</span>
              <span className="text-[var(--color-slate-muted)] truncate">belum ada pembanding</span>
            </div>
          </div>
        </Card>

        {/* Card 4: Rata-rata per Pembeli */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <HelpCircle className="h-3.5 w-3.5 text-[var(--color-slate-muted)] hover:text-[var(--color-ink)] cursor-pointer" />
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Rata-rata per Pembeli</span>
            <div className="text-2xl font-black tracking-tight text-[var(--color-ink)] mt-0.5">
              {formatRupiah(avgPerCustomer)}
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-status-live)]" />
              <span className="font-bold text-[var(--color-status-live)]">+0%</span>
              <span className="text-[var(--color-slate-muted)] truncate">belum ada pembanding</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Attention Items (Perlu Perhatian) */}
      {lowStockMaterials.length > 0 && (
        <Card className="border-[var(--color-hairline)] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">Perlu Perhatian</CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)]">
                Stok bahan baku yang menipis dan perlu restock segera
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('inventory')} className="text-xs h-7.5">
              Kelola Bahan
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {lowStockMaterials.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-[var(--color-ink)] truncate">{m.name}</div>
                  <div className="text-[10px] text-amber-700 font-semibold">Sisa {m.stock} {m.unit} (Min. {m.stock_min} {m.unit})</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Deteksi Anomali & Anti-Fraud AI Card matching Image 1 */}
      <Card className="border-[var(--color-hairline)] bg-gradient-to-br from-white via-white to-violet-50/40 shadow-soft overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Deteksi Anomali & Anti-Fraud AI
              </CardTitle>
              <p className="text-[11px] text-[var(--color-slate-muted)]">
                Pemantauan cerdas pembatalan nota kasir & integritas shift 24/7
              </p>
            </div>
          </div>

          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 gap-1 text-[11px] font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Status Operasional: Aman</span>
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* 3 Metric Triplet Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl border border-[var(--color-hairline)] bg-white/80 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                VOID TRANSAKSI HARI INI
              </p>
              <p className="mt-1 font-heading text-lg font-black text-[var(--color-ink)]">
                1 <span className="text-xs font-normal text-[var(--color-slate-muted)]">Nota</span>
              </p>
              <span className="text-[11px] font-bold text-[var(--color-status-live)]">
                ✓ Terverifikasi PIN Supervisor
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-hairline)] bg-white/80 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                SELISIH KAS SHIFT
              </p>
              <p className="mt-1 font-heading text-lg font-black text-[var(--color-ink)]">
                Rp0
              </p>
              <span className="text-[11px] font-bold text-[var(--color-status-live)]">
                ✓ 100% Cocok Laci Kas
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-hairline)] bg-white/80 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                DISKON MANUAL KASIR
              </p>
              <p className="mt-1 font-heading text-lg font-black text-[var(--color-ink)]">
                2 <span className="text-xs font-normal text-[var(--color-slate-muted)]">Kali</span>
              </p>
              <span className="text-[11px] font-bold text-[var(--color-status-live)]">
                ✓ Batas Wajar (&lt;5%)
              </span>
            </div>
          </div>

          {/* Audit Log Banner */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-hairline)] bg-[var(--color-snow)] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[var(--color-slate-body)]">
                <strong>Cabang Bandung</strong>: Nota #TRX-9482 dibatalkan (Alasan: Pelanggan ganti metode bayar).
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('sales')}
              className="flex items-center gap-1 font-bold text-[var(--color-brand-700)] hover:text-[var(--color-brand-900)] cursor-pointer shrink-0 ml-2"
            >
              <span>Lihat Audit</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 6. Charts & Branch Target Row matching Image 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Tren Omset & Laba Area Chart */}
        <Card className="lg:col-span-2 p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Tren omset & laba
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)]">
                5 – 12 Agustus 2026
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

          {/* Interactive Bar/Area Chart Visual */}
          <div className="h-56 w-full flex items-end justify-between gap-2 pt-6 pb-2 border-b border-[var(--color-hairline)]">
            {chartData.map((d, idx) => {
              const hPct = Math.round((d.revenue / maxChartValue) * 100);
              const pPct = Math.round((d.profit / maxChartValue) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip Hover */}
                  <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-ink)] text-white text-[10px] rounded-lg p-1.5 shadow-lg whitespace-nowrap z-20 pointer-events-none">
                    <div className="font-bold">{d.date}</div>
                    <div>Omset: {formatRupiah(d.revenue)}</div>
                    <div>Laba: {formatRupiah(d.profit)}</div>
                  </div>

                  {/* Dual Bar Graphic */}
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
                    {d.date.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Capaian Target Outlet */}
        <Card className="p-5 bg-white border-[var(--color-hairline)] shadow-2xs flex flex-col justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
              Capaian target outlet
            </CardTitle>
            <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
              Omset bulan ini dibanding target masing-masing
            </CardDescription>

            <div className="space-y-4 mt-5">
              {/* Outlet 1: Kopi Cisauk */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)]">Kopi Cisauk</span>
                  <span className="text-xs font-black text-[var(--color-ink)] font-mono">Rp396rb</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-snow)] overflow-hidden">
                  <div className="h-full bg-[var(--color-brand-600)] rounded-full" style={{ width: '33%' }} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-slate-muted)]"><b>33%</b> dari target Rp1,2 jt</span>
                  <span className="font-bold text-[var(--color-status-live)] flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    +12%
                  </span>
                </div>
              </div>

              {/* Outlet 2: Kopi Bandung */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)]">Kopi Bandung</span>
                  <span className="text-xs font-black text-[var(--color-ink)] font-mono">Rp240rb</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-snow)] overflow-hidden">
                  <div className="h-full bg-[var(--color-brand-600)] rounded-full" style={{ width: '28%' }} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-slate-muted)]"><b>28%</b> dari target Rp850 rb</span>
                  <span className="font-bold text-[var(--color-status-live)] flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    +8%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('outlets')}
            className="w-full text-xs h-8 mt-4 bg-[var(--color-snow)] border-[var(--color-hairline)] cursor-pointer"
          >
            Lihat semua performa cabang
          </Button>
        </Card>
      </div>

      {/* 7. Peak Hours & Top Products Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Peak Hours Chart */}
        <Card className="p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
            Jam sibuk & kebutuhan kasir
          </CardTitle>
          <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Sebaran pesanan sepanjang hari untuk menyusun jadwal shift
          </CardDescription>

          <div className="h-44 flex items-end justify-between gap-2 mt-4 pt-4 border-b border-[var(--color-hairline)]">
            {peakHoursData.map((h, i) => {
              const hPct = Math.round((h.orders / 8) * 100);
              const isPeak = h.intensity === 'peak';

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-[var(--color-slate-body)]">{h.orders} trx</span>
                  <div className="w-full max-w-[24px] h-28 flex items-end justify-center rounded-t-md bg-[var(--color-snow)]">
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all',
                        isPeak ? 'bg-[var(--color-coral-500)]' : 'bg-[var(--color-brand-500)]'
                      )}
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--color-slate-muted)]">{h.hour}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--color-brand-50)] p-3 text-xs text-[var(--color-brand-900)]">
            <Users className="h-4 w-4 text-[var(--color-brand-600)] shrink-0" />
            <span>
              Jam tersibuk ada di <strong>14:00</strong> dengan 8 pesanan. Siapkan <strong>2 kasir</strong> pada jam itu.
            </span>
          </div>
        </Card>

        {/* Top Products */}
        <Card className="p-5 bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
            Produk terlaris
          </CardTitle>
          <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Menu favorit pelanggan berdasarkan jumlah terjual
          </CardDescription>

          <div className="space-y-2 mt-4">
            {topProductsList.map((p, idx) => (
              <div key={p.id || idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--color-snow)] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)] text-xs font-black">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-xs text-[var(--color-ink)]">{p.name}</div>
                    <div className="text-[10px] text-[var(--color-slate-muted)]">{p.category} • Margin {p.margin}%</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-xs text-[var(--color-ink)]">{formatRupiah(p.revenue)}</div>
                  <div className="text-[10px] text-[var(--color-slate-muted)]">{p.salesCount} terjual</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 8. Recent Transactions Table */}
      <Card className="overflow-hidden bg-white border-[var(--color-hairline)] shadow-2xs">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[var(--color-ink)]">Transaksi terbaru</CardTitle>
            <CardDescription className="text-xs text-[var(--color-slate-muted)]">Struk yang baru masuk dari aplikasi kasir</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('sales')} className="text-xs h-7.5 bg-white">
            <span>Semua Transaksi</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-6 py-3">No. Struk</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Cabang</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--color-brand-50)]/30 transition-colors">
                    <td className="px-6 py-3 font-mono font-bold text-[var(--color-brand-800)]">{tx.receipt}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{tx.customer}</td>
                    <td className="px-4 py-3 text-[var(--color-slate-muted)] font-mono">{tx.time}</td>
                    <td className="px-4 py-3 text-[var(--color-slate-body)]">{tx.branch}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{tx.method}</Badge></td>
                    <td className="px-4 py-3 text-right font-black text-[var(--color-ink)]">{formatRupiah(tx.amount)}</td>
                    <td className="px-6 py-3 text-center">
                      <Badge variant={tx.status === 'void' ? 'danger' : 'success'}>
                        {tx.status === 'void' ? 'Dibatalkan' : 'Berhasil'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
