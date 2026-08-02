import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowUpRight, CreditCard, Coffee, Sparkles, Coins, CheckCircle2, Radio, Clock, Store } from 'lucide-react';
import { getReportsSummary, getDailyReports, getExpenses, getProducts, getBranchesComparison, getOnlineShifts, getSubscription } from '../lib/api';

// Sisa masa aktif sebagai "X bln Y hr" dari tanggal berakhir efektif.
function subRemainingText(expiresAtIso) {
  if (!expiresAtIso) return '';
  const exp = new Date(expiresAtIso);
  const now = new Date();
  if (isNaN(exp.getTime())) return '';
  let months = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
  let anchor = new Date(now); anchor.setMonth(anchor.getMonth() + months);
  if (anchor > exp) { months -= 1; anchor = new Date(now); anchor.setMonth(anchor.getMonth() + months); }
  const days = Math.max(0, Math.round((exp - anchor) / 86400000));
  const parts = [];
  if (months > 0) parts.push(`${months} bln`);
  if (days > 0) parts.push(`${days} hr`);
  return parts.length ? parts.join(' ') : '< 1 hari';
}

// Format durasi sejak shift dibuka menjadi "2j 14m" / "43m".
function formatDuration(fromIso) {
  if (!fromIso) return '-';
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return '-';
  let mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const h = Math.floor(mins / 60);
  mins = mins % 60;
  return h > 0 ? `${h}j ${mins}m` : `${mins}m`;
}

function formatClock(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage({ activeBranchId, branches, session, handleBranchChange, setActionError }) {
  const [reportsSummary, setReportsSummary] = useState(null);
  const [dailyReports, setDailyReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchesComparison, setBranchesComparison] = useState([]);
  const [dailyTrends, setDailyTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onlineShifts, setOnlineShifts] = useState([]);
  const [shiftsError, setShiftsError] = useState(false);
  const [, setTick] = useState(0); // paksa re-render agar durasi live ikut berjalan
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSubscription()
      .then((r) => { if (!cancelled) setSubscription(r?.data || null); })
      .catch(() => { /* biarkan null */ });
    return () => { cancelled = true; };
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const promises = [
        getReportsSummary(scope).catch(e => { console.error(e); return null; }),
        getDailyReports(scope).catch(e => { console.error(e); return []; }),
        getExpenses(scope).catch(e => { console.error(e); return []; }),
        getProducts().catch(e => { console.error(e); return []; })
      ];

      if (activeBranchId === 'all') {
        promises.push(getBranchesComparison().catch(e => { console.error(e); return null; }));
      }

      const results = await Promise.all(promises);
      setReportsSummary(results[0]);
      setDailyReports(Array.isArray(results[1]) ? results[1] : []);
      setExpenses(Array.isArray(results[2]) ? results[2] : []);
      setProducts(Array.isArray(results[3]) ? results[3] : []);

      if (activeBranchId === 'all' && results[4]) {
        setBranchesComparison(results[4].comparison || []);
        setDailyTrends(results[4].dailyTrends || []);
      } else {
        setBranchesComparison([]);
        setDailyTrends([]);
      }
    } catch (err) {
      setActionError('Gagal memuat data dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeBranchId]);

  // Pantau kasir online (shift terbuka). Polling ~20 dtk + tik durasi tiap 30 dtk.
  useEffect(() => {
    let cancelled = false;
    const scope = activeBranchId === 'all' ? 'company' : null;
    const loadShifts = async () => {
      try {
        const data = await getOnlineShifts(scope);
        if (!cancelled) { setOnlineShifts(Array.isArray(data) ? data : []); setShiftsError(false); }
      } catch (err) {
        if (!cancelled) setShiftsError(true);
      }
    };
    loadShifts();
    const pollId = setInterval(loadShifts, 20000);
    const tickId = setInterval(() => { if (!cancelled) setTick((t) => t + 1); }, 30000);
    return () => { cancelled = true; clearInterval(pollId); clearInterval(tickId); };
  }, [activeBranchId]);

  // Calculations
  const todayStr = new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  const todayReport = dailyReports.find(d => {
    let reportDate = d.date;
    if (reportDate.includes('T')) reportDate = reportDate.split('T')[0];
    return reportDate === todayStr;
  });

  const liveRevenueToday = todayReport ? Number(todayReport.totalRevenue) : 0;
  const liveOrdersToday = todayReport ? Number(todayReport.totalOrders) : 0;
  const totalRevenueOverall = reportsSummary?.overall?.totalRevenue ? Number(reportsSummary.overall.totalRevenue) : 0;
  const avgOrderValueOverall = reportsSummary?.overall?.avgOrderValue ? Number(reportsSummary.overall.avgOrderValue) : 0;
  const totalProductsSold = reportsSummary?.overall?.totalProductsSold ? Number(reportsSummary.overall.totalProductsSold) : 0;
  const totalCOGSOverall = reportsSummary?.overall?.totalCOGS ? Number(reportsSummary.overall.totalCOGS) : 0;
  const totalExpensesOverall = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfitOverall = totalRevenueOverall - totalCOGSOverall - totalExpensesOverall;

  // Chart setup for single branch
  const chartDays = dailyReports.slice(0, 7).reverse();
  const maxDayRevenue = Math.max(...chartDays.map(d => Number(d.totalRevenue) || 0), 1);

  // Chart setup for multi-branch
  const maxBranchRevenue = Math.max(
    ...dailyTrends.flatMap(d => Object.values(d.branches).map(Number)), 
    1
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Masa Aktif Langganan */}
      {subscription && (() => {
        const planLabel = String(subscription.plan || 'free').toUpperCase();
        const isExpired = subscription.expired;
        const dl = subscription.daysLeft;
        const soon = !subscription.unlimited && !isExpired && dl != null && dl <= 7;
        const tone = isExpired
          ? { box: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' }
          : soon
          ? { box: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' }
          : subscription.isTrial
          ? { box: 'bg-sky-50 border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' }
          : { box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' };
        const tgl = subscription.expiresAt
          ? new Date(subscription.expiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
          : null;
        return (
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border px-5 py-4 ${tone.box}`}>
            <div className="flex items-center gap-3">
              <span className={`relative flex h-2.5 w-2.5 shrink-0`}>
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${tone.dot} ${soon || isExpired ? 'animate-ping' : ''}`}></span>
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`}></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Paket</span>
                  <span className="text-xs font-extrabold text-slate-800">{planLabel}</span>
                  {subscription.isTrial && <span className="text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-600 border border-sky-500/20 px-2 py-0.5 rounded">Masa Trial</span>}
                </div>
                <div className={`text-sm font-bold ${tone.text}`}>
                  {subscription.unlimited
                    ? 'Masa aktif: Tanpa batas'
                    : isExpired
                    ? `Masa aktif telah berakhir${tgl ? ` (${tgl})` : ''} — segera perpanjang`
                    : `Masa aktif: sisa ${subRemainingText(subscription.expiresAt)}${tgl ? ` · s/d ${tgl}` : ''}`}
                </div>
              </div>
            </div>
            {(subscription.isTrial || soon || isExpired) && (
              <span className="text-[11px] font-semibold text-slate-500">
                {isExpired ? 'Hubungi admin untuk mengaktifkan kembali.' : subscription.isTrial ? 'Upgrade untuk lanjut setelah trial.' : 'Segera perpanjang agar tidak terputus.'}
              </span>
            )}
          </div>
        );
      })()}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
            <TrendingUp size={20} />
          </div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Omset Hari Ini</h4>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">Rp {liveRevenueToday.toLocaleString('id-ID')}</p>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-2">
            <ArrowUpRight size={12} />
            <span>Live transaksi kasir</span>
          </span>
        </div>
        
        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
            <CreditCard size={20} />
          </div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Transaksi Hari Ini</h4>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{liveOrdersToday} Pesanan</p>
          <span className="text-[10px] text-sky-400 font-bold flex items-center gap-1 mt-2">
            <span>{liveOrdersToday > 0 ? `${liveOrdersToday} transaksi` : 'Belum ada transaksi'}</span>
          </span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
            <Coffee size={20} />
          </div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Menu Produk</h4>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{products.length} Menu</p>
          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 mt-2">
            <span>{products.filter(p => p.isAvailableInBranch !== 0).length} produk aktif</span>
          </span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
            <Sparkles size={20} />
          </div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Omset Kumulatif</h4>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">Rp {totalRevenueOverall.toLocaleString('id-ID')}</p>
          <span className="text-[10px] text-purple-400 font-bold flex items-center gap-1 mt-2">
            <span>Hingga saat ini</span>
          </span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
            netProfitOverall >= 0 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}>
            <Coins size={20} />
          </div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Laba Bersih Real-Time</h4>
          <p className={`text-2xl font-extrabold mt-1 ${netProfitOverall >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Rp {netProfitOverall.toLocaleString('id-ID')}
          </p>
          <span className={`text-[10px] font-bold flex items-center gap-1 mt-2 ${netProfitOverall >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>Margin: {totalRevenueOverall > 0 ? `${Math.round((netProfitOverall / totalRevenueOverall) * 100)}%` : '0%'}</span>
          </span>
        </div>
      </div>

      {/* Kasir Online (Shift Terbuka) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Radio size={16} className="text-emerald-500" />
              Kasir Online
            </h3>
            <p className="text-xs text-slate-600">
              Kasir dengan shift terbuka {activeBranchId === 'all' ? 'di semua cabang' : 'di cabang ini'}. Diperbarui otomatis tiap 20 detik.
            </p>
          </div>
          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-xl border ${
            onlineShifts.length > 0
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {onlineShifts.length} Online
          </span>
        </div>

        {shiftsError ? (
          <div className="py-8 text-center text-xs text-slate-400">Gagal memuat status kasir. Mencoba lagi otomatis…</div>
        ) : onlineShifts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Tidak ada kasir yang sedang membuka shift saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onlineShifts.map((s) => (
              <div key={s.id} className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm truncate">{s.cashierName}</h4>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">{s.cashierRole || 'kasir'}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
                    {formatDuration(s.startTime)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold">
                  <Store size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{s.branchName || 'Cabang Utama'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Clock size={12} className="text-slate-400 shrink-0" />
                  <span>Buka sejak <b className="text-slate-800">{formatClock(s.startTime)}</b></span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white border border-slate-100 rounded-xl px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Transaksi</p>
                    <p className="text-sm font-extrabold text-slate-900">{Number(s.orderCount) || 0}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Omzet</p>
                    <p className="text-sm font-extrabold text-slate-900">Rp {(Number(s.salesTotal) || 0).toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100/70">
                  <span>Kas awal: Rp {(Number(s.openingCash) || 0).toLocaleString('id-ID')}</span>
                  <span>{s.lastOrderAt ? `Transaksi terakhir ${formatDuration(s.lastOrderAt)} lalu` : 'Belum ada transaksi'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lower Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Grafik Penjualan Mingguan (Berdasarkan Live Data)</h3>
              <span className="text-xs text-slate-600 font-medium">
                Batas max: Rp {(activeBranchId === 'all' ? maxBranchRevenue : maxDayRevenue).toLocaleString('id-ID')}
              </span>
            </div>
            
            {activeBranchId === 'all' ? (
              // Multi-branch comparative charts (batang berdampingan)
              dailyTrends.length === 0 ? (
                <div className="h-60 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-center justify-center text-slate-500 text-xs">
                  Tidak ada transaksi penjualan dalam 7 hari terakhir.
                </div>
              ) : (
                <div className="h-60 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-end justify-between p-6 gap-3">
                  {dailyTrends.slice(0, 7).map((d, i) => {
                    let cleanDate = d.date;
                    if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 relative">
                        <div className="flex items-end justify-center gap-1.5 w-full h-[150px]">
                          {branches.map((b, bIdx) => {
                            const rev = Number(d.branches[b.name] || 0);
                            const heightPct = Math.max(8, ((rev / maxBranchRevenue) * 100));
                            const bgColors = [
                              'from-sky-600 to-sky-400 hover:from-sky-500 hover:to-sky-300',
                              'from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300',
                              'from-teal-600 to-teal-400 hover:from-teal-500 hover:to-teal-300',
                              'from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300'
                            ];
                            const colorClass = bgColors[bIdx % bgColors.length];
                            
                            return (
                              <div key={b.id} className="flex-grow max-w-[20px] flex flex-col items-center group relative">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[100%] mb-1 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-[9px] text-slate-900 font-bold shadow-xl z-20 pointer-events-none whitespace-nowrap">
                                  {b.name}: Rp {rev.toLocaleString('id-ID')}
                                </div>
                                <div 
                                  className={`w-full bg-gradient-to-t ${colorClass} rounded-t-sm transition-all cursor-pointer shadow-lg group-hover:scale-y-105 origin-bottom`}
                                  style={{ height: `${heightPct * 1.3}px` }}
                                ></div>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold truncate max-w-full font-mono">
                          {cleanDate.split('-').slice(1).join('/')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Single-branch standard chart
              chartDays.length === 0 ? (
                <div className="h-60 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-center justify-center text-slate-500 text-xs">
                  Tidak ada transaksi penjualan dalam 7 hari terakhir.
                </div>
              ) : (
                <div className="h-60 bg-slate-50/50 rounded-xl border border-slate-100/80 flex items-end justify-between p-6 gap-3">
                  {chartDays.map((d, i) => {
                    const amt = Number(d.totalRevenue) || 0;
                    const heightPct = Math.max(8, ((amt / maxDayRevenue) * 100));
                    let cleanDate = d.date;
                    if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[40px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] text-slate-900 font-bold shadow-xl z-20 pointer-events-none whitespace-nowrap">
                          Rp {amt.toLocaleString('id-ID')}
                        </div>
                        <div 
                          className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-md hover:from-sky-500 hover:to-sky-300 transition-all cursor-pointer shadow-lg shadow-sky-500/5 group-hover:scale-y-105 origin-bottom" 
                          style={{ height: `${heightPct * 1.5}px` }}
                        ></div>
                        <span className="text-[9px] text-slate-500 font-bold truncate max-w-full font-mono">
                          {cleanDate.split('-').slice(1).join('/')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Weekly Chart Multi-branch Legend */}
          {activeBranchId === 'all' && branches.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3 border-t border-slate-100/40 text-[10px] text-slate-600 font-bold">
              {branches.map((b, bIdx) => {
                const bgColors = ['bg-sky-500', 'bg-purple-500', 'bg-teal-500', 'bg-amber-500'];
                return (
                  <div key={b.id} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${bgColors[bIdx % bgColors.length]}`}></span>
                    <span>{b.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Subscription Info & Mini Stats */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-4">Ringkasan Sistem Live</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50/40 border border-slate-100/80 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-sky-400" size={16} />
                  <span className="text-xs font-semibold text-slate-800">Omset Kumulatif</span>
                </div>
                <span className="text-xs text-slate-700 font-bold">
                  Rp {totalRevenueOverall.toLocaleString('id-ID')}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50/40 border border-slate-100/80 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-sky-400" size={16} />
                  <span className="text-xs font-semibold text-slate-800">Rata-rata Transaksi</span>
                </div>
                <span className="text-xs text-slate-700 font-bold">
                  Rp {Math.round(avgOrderValueOverall).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50/40 border border-slate-100/80 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-sky-400" size={16} />
                  <span className="text-xs font-semibold text-slate-800">Produk Terjual (Pcs)</span>
                </div>
                <span className="text-xs text-slate-700 font-bold">
                  {totalProductsSold} unit
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-5 p-4 bg-slate-50/40 border border-slate-100 rounded-xl space-y-2 select-none">
            <p className="text-xs font-bold text-slate-900 mb-2">Ikhtisar Laba Rugi (P&L)</p>
            
            <div className="flex justify-between text-[11px] py-1 border-b border-slate-100/40">
              <span className="text-slate-600">Total Omset Penjualan</span>
              <span className="text-emerald-400 font-bold">
                + Rp {Math.round(totalRevenueOverall).toLocaleString('id-ID')}
              </span>
            </div>
            
            <div className="flex justify-between text-[11px] py-1 border-b border-slate-100/40">
              <span className="text-slate-600">Total HPP (Menu Cost)</span>
              <span className="text-rose-400 font-bold">
                {totalCOGSOverall > 0 ? '-' : ''} Rp {Math.round(totalCOGSOverall).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex justify-between text-[11px] py-1 border-b border-slate-100/40">
              <span className="text-slate-600">Biaya Operasional</span>
              <span className="text-rose-400 font-bold">
                {totalExpensesOverall > 0 ? '-' : ''} Rp {Math.round(totalExpensesOverall).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="pt-2 flex justify-between text-xs font-bold">
              <span className="text-slate-900">Estimasi Laba Bersih</span>
              <span className={netProfitOverall >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                Rp {Math.round(netProfitOverall).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Branch Comparative Summary Matrix */}
      {activeBranchId === 'all' && branchesComparison.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-base">Matriks Profitabilitas & Performa Cabang</h3>
            <p className="text-xs text-slate-600">Analisis komparatif laba bersih, pendapatan kotor, pengeluaran, dan HPP untuk masing-masing cabang.</p>
          </div>
          <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-4">Nama Cabang / Outlet</th>
                  <th className="p-4 text-center">Total Pesanan</th>
                  <th className="p-4 text-right">Pendapatan Kotor</th>
                  <th className="p-4 text-right">HPP (COGS)</th>
                  <th className="p-4 text-right">Biaya Pengeluaran</th>
                  <th className="p-4 text-right">Laba Bersih</th>
                  <th className="p-4 text-center">Margin Laba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-slate-50/20">
                {branchesComparison.map((bc, idx) => {
                  const margin = bc.totalRevenue > 0 ? Math.round((bc.netProfit / bc.totalRevenue) * 100) : 0;
                  
                  return (
                    <tr key={bc.branchId} className="hover:bg-slate-100/30 text-slate-800">
                      <td className="p-4 font-bold flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          idx % 4 === 0 ? 'bg-sky-500' :
                          idx % 4 === 1 ? 'bg-purple-500' :
                          idx % 4 === 2 ? 'bg-teal-500' :
                          'bg-amber-500'
                        }`}></span>
                        <span>{bc.branchName}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-semibold">{bc.totalOrders} order</td>
                      <td className="p-4 text-right font-semibold text-slate-900">Rp {bc.totalRevenue.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right text-rose-400">Rp {bc.totalCOGS.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right text-rose-400">Rp {bc.totalExpenses.toLocaleString('id-ID')}</td>
                      <td className={`p-4 text-right font-extrabold ${bc.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Rp {bc.netProfit.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bc.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {margin}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status & Kinerja Cabang Grid Card */}
      {activeBranchId === 'all' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Status & Kinerja Cabang</h3>
              <p className="text-xs text-slate-600">Daftar outlet aktif di bawah holding perusahaan.</p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-xl">
              {branches.length} Outlet Terdaftar
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(b => (
              <div key={b.id} className="bg-slate-50/40 border border-slate-100 hover:border-slate-200/60 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-slate-900 text-xs truncate">{b.name}</h4>
                    <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      b.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {b.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 block w-fit mt-1">
                    {b.subscription_plan || 'standard'} Plan
                  </span>
                </div>
                <button
                  onClick={() => handleBranchChange(String(b.id))}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-sky-500 hover:text-white transition-all text-xs font-bold text-slate-700 cursor-pointer text-center"
                >
                  Masuk & Kelola Cabang
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
