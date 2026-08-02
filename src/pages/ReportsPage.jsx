import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronRight,
  Coffee,
  TrendingUp,
  Coins,
  TrendingDown,
  Layers,
  Printer,
  Filter,
  Sparkles
} from 'lucide-react';
import { getDailyReports, getProfitLossReport, API_URL, getHeaders } from '../lib/api';
import Pagination from '../components/Pagination';

export default function ReportsPage({ activeBranchId, setActionError }) {
  // Page Tab state
  const [reportTab, setReportTab] = useState('daily'); // 'daily' or 'profit-loss'

  // Daily reports states
  const [dailyReports, setDailyReports] = useState([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);

  // Profit & Loss states
  const [plSummary, setPlSummary] = useState(null);
  const [plProducts, setPlProducts] = useState([]);
  const [plCategories, setPlCategories] = useState([]);
  const [plLoading, setPlLoading] = useState(false);
  const [productsPage, setProductsPage] = useState(1);

  // Date Filters (default: last 30 days)
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const ITEMS_PER_PAGE = 10;

  const loadReports = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const data = await getDailyReports(scope);
      setDailyReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError('Gagal memuat laporan harian: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProfitLoss = async () => {
    setPlLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const data = await getProfitLossReport(scope, startDate, endDate);
      if (data) {
        setPlSummary(data.summary || null);
        setPlProducts(data.productBreakdown || []);
        setPlCategories(data.categoryBreakdown || []);
      }
    } catch (err) {
      setActionError('Gagal memuat laporan Profit & Loss: ' + err.message);
    } finally {
      setPlLoading(false);
    }
  };

  useEffect(() => {
    if (reportTab === 'daily') {
      loadReports();
    } else {
      loadProfitLoss();
    }
  }, [activeBranchId, reportTab]);

  // Fetch report details when report date selected
  useEffect(() => {
    if (!selectedReportDate) return;
    const fetchReportDetail = async () => {
      setReportDetailLoading(true);
      try {
        let dateQuery = selectedReportDate;
        if (dateQuery.includes('T')) {
          dateQuery = dateQuery.split('T')[0];
        }
        const res = await fetch(`${API_URL}/api/reports/daily/${dateQuery}`, {
          headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to load report detail');
        const data = await res.json();
        setReportDetail(data);
      } catch (err) {
        setActionError('Gagal memuat detail laporan: ' + err.message);
      } finally {
        setReportDetailLoading(false);
      }
    };
    fetchReportDetail();
  }, [selectedReportDate]);

  const handlePrintPL = () => {
    window.print();
  };

  const startIndex = (reportsPage - 1) * ITEMS_PER_PAGE;
  const paginatedReports = dailyReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const productStartIndex = (productsPage - 1) * ITEMS_PER_PAGE;
  const paginatedPlProducts = plProducts.slice(productStartIndex, productStartIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Page Tabs */}
      <div className="flex border-b border-slate-100 gap-6 text-sm select-none print:hidden">
        <button
          onClick={() => setReportTab('daily')}
          className={`pb-3 font-bold cursor-pointer transition-all border-b-2 ${
            reportTab === 'daily'
              ? 'border-sky-500 text-sky-400 font-extrabold'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Closing Harian Kasir
        </button>
        <button
          onClick={() => setReportTab('profit-loss')}
          className={`pb-3 font-bold cursor-pointer transition-all border-b-2 ${
            reportTab === 'profit-loss'
              ? 'border-sky-500 text-sky-400 font-extrabold'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Laporan Profit & Loss (HPP)
        </button>
      </div>

      {/* TAB 1: DAILY CLOSINGS */}
      {reportTab === 'daily' && (
        <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4 animate-in fade-in duration-300">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Laporan Penjualan Harian</h3>
            <p className="text-xs text-slate-600">Riwayat transaksi keuangan dan omset harian. Klik baris laporan untuk detail.</p>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-4">Tanggal Penjualan</th>
                  <th className="p-4">Total Order</th>
                  <th className="p-4">Produk Terjual</th>
                  <th className="p-4">Omset / Pendapatan</th>
                  <th className="p-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-slate-50/20">
                {paginatedReports.map((d, idx) => {
                  let dateStr = d.date;
                  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                  const formattedDate = new Date(dateStr).toLocaleDateString('id-ID', { dateStyle: 'full' });
                  
                  return (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedReportDate(dateStr)}
                      className="hover:bg-slate-100/30 text-slate-800 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-bold flex items-center gap-2">
                        <Calendar size={14} className="text-sky-400 shrink-0" />
                        <span>{formattedDate}</span>
                      </td>
                      <td className="p-4 font-semibold">{d.totalOrders} order</td>
                      <td className="p-4">{d.totalItemsSold || 0} unit</td>
                      <td className="p-4 font-extrabold text-emerald-400">Rp {Number(d.totalRevenue).toLocaleString('id-ID')}</td>
                      <td className="p-4 text-center">
                        <button className="text-sky-400 hover:text-sky-300 flex items-center justify-center gap-1 mx-auto font-bold text-[10px] uppercase cursor-pointer">
                          <span>Detail</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {dailyReports.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      Tidak ditemukan catatan laporan harian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination 
            currentPage={reportsPage} 
            totalItems={dailyReports.length} 
            itemsPerPage={ITEMS_PER_PAGE} 
            onPageChange={setReportsPage} 
          />
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS / COGS */}
      {reportTab === 'profit-loss' && (
        <div className="space-y-6">
          {/* Date Filter & Actions Header */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold uppercase text-[10px]">Dari</span>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-100 text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-mono font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold uppercase text-[10px]">Sampai</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-100 text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-mono font-bold"
                />
              </div>
              <button
                onClick={loadProfitLoss}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ml-auto md:ml-0"
              >
                <Filter size={14} />
                <span>Filter Laporan</span>
              </button>
            </div>
            
            <button
              onClick={handlePrintPL}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 hover:border-slate-400/80 text-slate-900 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer w-full md:w-auto justify-center"
            >
              <Printer size={14} />
              <span>Cetak Laporan (PDF)</span>
            </button>
          </div>

          {/* PRINT-ONLY HEADER */}
          <div className="hidden print:block text-slate-950 border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black uppercase text-center tracking-wider">STRANS MERCHANT HOLDING</h1>
            <p className="text-center font-bold text-sm text-slate-700 mt-1">Laporan Laba Rugi & HPP (Profit & Loss Statement)</p>
            <div className="flex justify-between text-xs font-mono font-semibold mt-4">
              <span>Periode: {new Date(startDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })} - {new Date(endDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
              <span>Cabang: {activeBranchId === 'all' ? 'Semua Outlet' : 'ID Outlet: ' + activeBranchId}</span>
            </div>
          </div>

          {/* Metrik P&L Cards */}
          {plSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-3 print:hidden">
                  <TrendingUp size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Total Pendapatan</span>
                <p className="text-xl font-black text-slate-900 print:text-slate-950 mt-1">
                  Rp {plSummary.totalRevenue.toLocaleString('id-ID')}
                </p>
                <span className="text-[9px] text-slate-500 print:text-slate-600 font-bold block mt-1">Dari {plSummary.totalOrders} order</span>
              </div>

              <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3 print:hidden">
                  <TrendingDown size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Biaya HPP (COGS)</span>
                <p className="text-xl font-black text-rose-400 mt-1">
                  - Rp {plSummary.totalCOGS.toLocaleString('id-ID')}
                </p>
                <span className="text-[9px] text-slate-500 print:text-slate-600 font-bold block mt-1">
                  HPP Menu: {plSummary.totalRevenue > 0 ? `${Math.round((plSummary.totalCOGS / plSummary.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 print:hidden">
                  <Coins size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Laba Kotor (Gross)</span>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  Rp {plSummary.grossProfit.toLocaleString('id-ID')}
                </p>
                <span className="text-[9px] text-slate-500 print:text-slate-600 font-bold block mt-1">
                  Margin Kotor: {plSummary.totalRevenue > 0 ? `${Math.round((plSummary.grossProfit / plSummary.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3 print:hidden">
                  <Layers size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Beban Operasional</span>
                <p className="text-xl font-black text-rose-400 mt-1">
                  - Rp {plSummary.totalExpenses.toLocaleString('id-ID')}
                </p>
                <span className="text-[9px] text-slate-500 print:text-slate-600 font-bold block mt-1">
                  Beban Usaha: {plSummary.totalRevenue > 0 ? `${Math.round((plSummary.totalExpenses / plSummary.totalRevenue) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 print:hidden ${
                  plSummary.netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  <Sparkles size={16} />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Laba Bersih (Net)</span>
                <p className={`text-xl font-black mt-1 ${plSummary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Rp {plSummary.netProfit.toLocaleString('id-ID')}
                </p>
                <span className="text-[9px] text-slate-500 print:text-slate-600 font-bold block mt-1">
                  Net Margin: {Math.round(plSummary.netMargin)}%
                </span>
              </div>
            </div>
          )}

          {/* Visual Progress Bar P&L */}
          {plSummary && plSummary.totalRevenue > 0 && (
            <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-5 rounded-2xl space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 print:text-slate-600 block">Persentase Struktur Finansial terhadap Pendapatan</span>
              <div className="w-full h-8 bg-slate-50 rounded-xl overflow-hidden flex font-mono text-[10px] font-bold text-white select-none">
                {(() => {
                  const cogsPct = Math.round((plSummary.totalCOGS / plSummary.totalRevenue) * 100);
                  const expPct = Math.round((plSummary.totalExpenses / plSummary.totalRevenue) * 100);
                  const profitPct = Math.max(0, 100 - cogsPct - expPct);
                  return (
                    <>
                      {cogsPct > 0 && (
                        <div className="bg-rose-500 flex items-center justify-center transition-all" style={{ width: `${cogsPct}%` }}>
                          COGS ({cogsPct}%)
                        </div>
                      )}
                      {expPct > 0 && (
                        <div className="bg-purple-500 flex items-center justify-center transition-all" style={{ width: `${expPct}%` }}>
                          Opex ({expPct}%)
                        </div>
                      )}
                      {profitPct > 0 && (
                        <div className="bg-emerald-500 flex items-center justify-center transition-all" style={{ width: `${profitPct}%` }}>
                          Net Profit ({profitPct}%)
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Table 1: Detailed Product HPP/COGS Breakdown */}
            <div className="lg:col-span-2 bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-slate-900 print:text-slate-900 text-base">Breakdown Harga Pokok Penjualan (HPP) per Produk</h3>
              <div className="border border-slate-100 print:border-slate-300 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 print:bg-slate-200 text-slate-700 print:text-slate-800 font-bold">
                    <tr>
                      <th className="p-4">Nama Produk</th>
                      <th className="p-4 text-center">Qty</th>
                      <th className="p-4 text-right">Harga Jual Avg</th>
                      <th className="p-4 text-right">HPP Satuan</th>
                      <th className="p-4 text-right">Total HPP</th>
                      <th className="p-4 text-right">Total Pendapatan</th>
                      <th className="p-4 text-center">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-300 bg-slate-50/20">
                    {paginatedPlProducts.map((p) => {
                      const avgSellPrice = p.qtySold > 0 ? Math.round(Number(p.revenue) / p.qtySold) : 0;
                      const productMargin = p.revenue > 0 ? Math.round(((Number(p.revenue) - Number(p.totalCOGS)) / Number(p.revenue)) * 100) : 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-100/30 text-slate-800 print:text-slate-800">
                          <td className="p-4 font-bold flex items-center gap-1.5">
                            <Coffee size={14} className="text-sky-400 shrink-0 print:hidden" />
                            <span>{p.name}</span>
                          </td>
                          <td className="p-4 text-center font-semibold font-mono">{p.qtySold} pcs</td>
                          <td className="p-4 text-right">Rp {avgSellPrice.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right text-slate-600 print:text-slate-600">Rp {Number(p.costPrice).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right text-rose-400">Rp {Number(p.totalCOGS).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right font-extrabold text-slate-900 print:text-slate-900">Rp {Number(p.revenue).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              productMargin >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {productMargin}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {plProducts.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-500">Tidak ada rincian bahan/produk terjual.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={productsPage} 
                totalItems={plProducts.length} 
                itemsPerPage={ITEMS_PER_PAGE} 
                onPageChange={setProductsPage} 
              />
            </div>

            {/* Table 2: Category Breakdown */}
            <div className="bg-white print:bg-white print:border print:border-slate-300 border border-slate-100 p-6 rounded-2xl h-fit space-y-4">
              <h3 className="font-bold text-slate-900 print:text-slate-900 text-base">Profitabilitas per Kategori</h3>
              <div className="border border-slate-100 print:border-slate-300 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 print:bg-slate-200 text-slate-700 print:text-slate-800 font-bold">
                    <tr>
                      <th className="p-4">Kategori</th>
                      <th className="p-4 text-right">Pendapatan</th>
                      <th className="p-4 text-right">HPP</th>
                      <th className="p-4 text-center">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-300 bg-slate-50/20">
                    {plCategories.map((c) => {
                      const categoryMargin = c.revenue > 0 ? Math.round(((Number(c.revenue) - Number(c.totalCOGS)) / Number(c.revenue)) * 100) : 0;
                      return (
                        <tr key={c.category} className="hover:bg-slate-100/30 text-slate-800 print:text-slate-800">
                          <td className="p-4 font-bold capitalize">{c.category}</td>
                          <td className="p-4 text-right text-emerald-400 font-bold">Rp {Number(c.revenue).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right text-rose-400">Rp {Number(c.totalCOGS).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              categoryMargin >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {categoryMargin}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {plCategories.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-500">Tidak ada kategori.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY REPORT DETAIL MODAL */}
      {selectedReportDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200 print:hidden">
          <div className="w-full max-w-2xl bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Rincian Laporan Penjualan: {new Date(selectedReportDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}
              </h3>
              <button
                onClick={() => { setSelectedReportDate(null); setReportDetail(null); }}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {reportDetailLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-600 text-xs gap-2">
                <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Memuat detail data...</span>
              </div>
            ) : reportDetail ? (
              <div className="space-y-6 text-xs text-slate-700">

                {/* Highlights */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50/60 p-4 border border-slate-100 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Total Pendapatan</p>
                    <p className="text-lg font-black text-emerald-400">
                      Rp {Number(reportDetail.summary?.totalRevenue || 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-slate-50/60 p-4 border border-slate-100 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Total Transaksi</p>
                    <p className="text-lg font-black text-slate-900">
                      {reportDetail.summary?.totalOrders || 0} order
                    </p>
                  </div>
                  <div className="bg-slate-50/60 p-4 border border-slate-100 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Produk Terjual</p>
                    <p className="text-lg font-black text-sky-400">
                      {reportDetail.summary?.totalItemsSold || 0} unit
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Payment Breakdown */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-sky-400">Metode Pembayaran</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100/50 text-slate-700 font-bold">
                          <tr>
                            <th className="p-3">Metode</th>
                            <th className="p-3">Jumlah</th>
                            <th className="p-3 text-right">Total Pendapatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportDetail.paymentBreakdown?.map((pb, idx) => (
                            <tr key={idx}>
                              <td className="p-3 capitalize font-bold">{pb.paymentMethod}</td>
                              <td className="p-3">{pb.count} order</td>
                              <td className="p-3 text-right font-bold text-emerald-400">Rp {Number(pb.total).toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                          {(!reportDetail.paymentBreakdown || reportDetail.paymentBreakdown.length === 0) && (
                            <tr>
                              <td colSpan="3" className="p-4 text-center text-slate-500">Tidak ada data</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Shift Information */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-purple-400">Riwayat Shift Kasir</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100/50 text-slate-700 font-bold">
                          <tr>
                            <th className="p-3">Nama Kasir</th>
                            <th className="p-3">Buka Tunai</th>
                            <th className="p-3">Tutup Tunai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportDetail.shiftInfo?.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-100/20">
                              <td className="p-3 font-bold">{s.cashierName}</td>
                              <td className="p-3">Rp {Number(s.openingCash).toLocaleString('id-ID')}</td>
                              <td className="p-3 font-semibold text-emerald-400">
                                {s.closingCash ? `Rp ${Number(s.closingCash).toLocaleString('id-ID')}` : 'Masih Aktif'}
                              </td>
                            </tr>
                          ))}
                          {(!reportDetail.shiftInfo || reportDetail.shiftInfo.length === 0) && (
                            <tr>
                              <td colSpan="3" className="p-4 text-center text-slate-500">Tidak ada riwayat shift</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* Items sold detailed list */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-amber-400">Breakdown Produk Terjual</h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20 max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100/50 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">Nama Menu</th>
                          <th className="p-3">Varian</th>
                          <th className="p-3 text-center">Jumlah Qty</th>
                          <th className="p-3 text-right">Nilai Penjualan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportDetail.itemsSummary?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/10">
                            <td className="p-3 font-bold flex items-center gap-1.5">
                              <Coffee size={12} className="text-sky-400 shrink-0" />
                              <span>{item.name}</span>
                            </td>
                            <td className="p-3 text-slate-600">{item.variantName || '-'}</td>
                            <td className="p-3 text-center font-bold">{item.totalQty} pcs</td>
                            <td className="p-3 text-right font-bold text-sky-400">Rp {Number(item.revenue).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                        {(!reportDetail.itemsSummary || reportDetail.itemsSummary.length === 0) && (
                          <tr>
                            <td colSpan="4" className="p-4 text-center text-slate-500">Tidak ada produk terjual</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                Gagal memuat detail laporan.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
