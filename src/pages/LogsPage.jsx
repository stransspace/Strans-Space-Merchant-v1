import React, { useState, useEffect } from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { getActivityLogs, getCashiers } from '../lib/api';
import Pagination from '../components/Pagination';

export default function LogsPage({ activeBranchId, setActionError }) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [cashiersList, setCashiersList] = useState([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Advanced Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');

  const ITEMS_PER_PAGE = 10;

  const loadLogsAndCashiers = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        cashierId: selectedCashierId || undefined,
        action: selectedAction || undefined,
        entity: selectedEntity || undefined
      };

      const [logsData, cashiersData] = await Promise.all([
        getActivityLogs(scope, filters).catch(e => { console.error(e); return []; }),
        getCashiers(scope).catch(e => { console.error(e); return []; })
      ]);

      setActivityLogs(Array.isArray(logsData) ? logsData : []);
      setCashiersList(Array.isArray(cashiersData) ? cashiersData : []);
    } catch (err) {
      setActionError('Gagal memuat data log audit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogsAndCashiers();
  }, [activeBranchId]);

  const handleApplyFilters = () => {
    setLogsPage(1);
    loadLogsAndCashiers();
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCashierId('');
    setSelectedAction('');
    setSelectedEntity('');
    setLogsSearch('');
    setLogsPage(1);
    
    // Fetch logs again with empty filters
    setLoading(true);
    const scope = activeBranchId === 'all' ? 'company' : null;
    getActivityLogs(scope, {})
      .then(logsData => {
        setActivityLogs(Array.isArray(logsData) ? logsData : []);
      })
      .catch(err => {
        setActionError('Gagal memuat log audit: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const filteredLogs = activityLogs.filter(log => {
    const query = logsSearch.toLowerCase();
    return (
      (log.cashierName || 'System').toLowerCase().includes(query) ||
      (log.action || '').toLowerCase().includes(query) ||
      (log.entity || '').toLowerCase().includes(query) ||
      (log.details ? String(log.details).toLowerCase().includes(query) : false)
    );
  });

  const startIndex = (logsPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Log Audit & Aktivitas Staf</h3>
          <p className="text-xs text-slate-600">
            {activeBranchId === 'all' 
              ? 'Daftar audit tindakan staf real-time di seluruh cabang perusahaan.'
              : 'Daftar audit tindakan staf real-time di cabang aktif.'}
          </p>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="p-4 bg-slate-50/40 border border-slate-100 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tanggal Mulai</label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-mono font-semibold"
          />
        </div>
        
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tanggal Selesai</label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-mono font-semibold"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Staf / Kasir</label>
          <select
            value={selectedCashierId}
            onChange={(e) => setSelectedCashierId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-semibold"
          >
            <option value="">Semua Kasir</option>
            {cashiersList.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Jenis Tindakan</label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-semibold"
          >
            <option value="">Semua Tindakan</option>
            <option value="create">Create (Tambah)</option>
            <option value="update">Update (Ubah)</option>
            <option value="delete">Delete (Hapus)</option>
            <option value="adjust_stock">Adjust Stock (Penyesuaian)</option>
            <option value="checkout">Checkout (Buka Shift/Bayar)</option>
            <option value="payment_webhook">Webhook (Payment)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Entitas Modul</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500 font-semibold"
          >
            <option value="">Semua Modul</option>
            <option value="orders">Orders (Pesanan)</option>
            <option value="materials">Materials (Bahan Baku)</option>
            <option value="products">Products (Menu Menu)</option>
            <option value="vouchers">Vouchers (Kupon Promo)</option>
            <option value="expenses">Expenses (Biaya/Beban)</option>
            <option value="cashiers">Cashiers (Akun Staf)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Cari rincian perubahan..."
            value={logsSearch}
            onChange={(e) => {
              setLogsSearch(e.target.value);
              setLogsPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500 font-semibold"
          />
        </div>

        {/* Filter Action Buttons */}
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleResetFilters}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer text-xs"
          >
            <Filter size={14} />
            <span>Terapkan Filter</span>
          </button>
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold">
            <tr>
              <th className="p-4">Waktu</th>
              {activeBranchId === 'all' && <th className="p-4">Cabang</th>}
              <th className="p-4">Staf/Kasir</th>
              <th className="p-4">Tindakan</th>
              <th className="p-4">Entitas</th>
              <th className="p-4">Rincian Perubahan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-slate-50/20">
            {paginatedLogs.map((log) => {
              let detailsObj = null;
              if (log.details) {
                try {
                  detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                } catch (e) {
                  detailsObj = log.details;
                }
              }
              
              const actionColors = {
                create: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                update: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
                delete: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                adjust_stock: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                checkout: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
                payment_webhook: 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              };
              const actionBadgeClass = actionColors[log.action] || 'bg-slate-100 text-slate-600 border border-slate-200';

              return (
                <tr key={log.id} className="hover:bg-slate-100/30 text-slate-800">
                  <td className="p-4 text-slate-600 font-mono text-[10px] whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                  </td>
                  {activeBranchId === 'all' && (
                    <td className="p-4 font-bold text-slate-600 truncate max-w-[120px]" title={log.tenantName}>
                      {log.tenantName || 'Cabang Utama'}
                    </td>
                  )}
                  <td className="p-4 font-bold text-slate-900">
                    {log.cashierName || 'System'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${actionBadgeClass}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 capitalize font-semibold text-slate-700">
                    {log.entity} <span className="text-[10px] text-slate-500 font-mono">({log.entityId || '-'})</span>
                  </td>
                  <td className="p-4 max-w-xs truncate text-[11px] text-slate-600 font-mono" title={typeof detailsObj === 'object' ? JSON.stringify(detailsObj) : String(detailsObj)}>
                    {detailsObj ? (
                      typeof detailsObj === 'object' ? (
                        <span className="block truncate">
                          {Object.entries(detailsObj).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')}
                        </span>
                      ) : (
                        String(detailsObj)
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={activeBranchId === 'all' ? 6 : 5} className="p-8 text-center text-slate-500">
                  Tidak ditemukan aktivitas yang cocok dengan pencarian Anda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={logsPage} 
        totalItems={filteredLogs.length} 
        itemsPerPage={ITEMS_PER_PAGE} 
        onPageChange={setLogsPage} 
      />
    </div>
  );
}
