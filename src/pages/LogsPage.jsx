import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  History, 
  User, 
  Calendar, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import { getActivityLogs, getCashiers } from '../lib/api';
import { formatDate, formatDateTime, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';

export default function LogsPage({ activeBranchId, setActionError }) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [cashiersList, setCashiersList] = useState([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  const ITEMS_PER_PAGE = 12;

  const loadLogsAndCashiers = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        cashierId: selectedCashierId || undefined,
        action: selectedAction || undefined,
      };

      const [logsData, cashiersData] = await Promise.all([
        getActivityLogs(scope, filters).catch(() => []),
        getCashiers(scope).catch(() => [])
      ]);

      setActivityLogs(Array.isArray(logsData) ? logsData : []);
      setCashiersList(Array.isArray(cashiersData) ? cashiersData : []);
    } catch (err) {
      setActionError('Gagal memuat log audit: ' + err.message);
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
    setLogsSearch('');
    setLogsPage(1);
    setLoading(true);
    const scope = activeBranchId === 'all' ? 'company' : null;
    getActivityLogs(scope, {})
      .then(data => setActivityLogs(Array.isArray(data) ? data : []))
      .catch(err => setActionError('Gagal memuat log audit: ' + err.message))
      .finally(() => setLoading(false));
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
          Log Audit & Aktivitas Staf
        </h1>
        <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
          Jejak rekaman aktivitas staf, buka-tutup shift kasir, perubahan harga produk, dan manipulasi data.
        </p>
      </div>

      {/* Filter Card */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[var(--color-slate-muted)]">Dari:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-9 text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[var(--color-slate-muted)]">Sampai:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-9 text-xs font-mono"
            />
          </div>

          <div className="w-40">
            <Select
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">Semua Staf Kasir</option>
              {cashiersList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">Semua Aksi</option>
              <option value="create">Tambah Data</option>
              <option value="update">Ubah Data</option>
              <option value="delete">Hapus Data</option>
              <option value="login">Login Kasir</option>
            </Select>
          </div>

          <Button size="sm" onClick={handleApplyFilters} className="h-9">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={handleResetFilters} className="h-9">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-slate-muted)] pointer-events-none" />
          <Input
            placeholder="Ketik kata kunci untuk mencari dalam log aktivitas..."
            value={logsSearch}
            onChange={(e) => {
              setLogsSearch(e.target.value);
              setLogsPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Aktivitas Audit</CardTitle>
            <Badge variant="brand">{filteredLogs.length} Entri</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
              Memuat log audit aktivitas...
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Tidak ada data log yang sesuai dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Waktu Kejadian</th>
                    <th className="px-4 py-3.5">Pelaku (Staf)</th>
                    <th className="px-4 py-3.5">Aksi</th>
                    <th className="px-4 py-3.5">Entitas</th>
                    <th className="px-6 py-3.5">Rincian Perubahan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {paginatedLogs.map((log, idx) => {
                    const actionBadge = 
                      log.action === 'create' ? 'success' :
                      log.action === 'update' ? 'brand' :
                      log.action === 'delete' ? 'danger' : 'secondary';

                    return (
                      <tr key={log.id || idx} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-[var(--color-slate-muted)] text-[11px] whitespace-nowrap">
                          {formatDateTime(log.createdAt || log.created_at)}
                        </td>

                        <td className="px-4 py-3.5 font-bold text-[var(--color-ink)] flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-700)] text-[10px] font-bold">
                            {(log.cashierName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span>{log.cashierName || 'Sistem Otomatis'}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge variant={actionBadge} className="uppercase text-[9px]">
                            {log.action || 'activity'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5 font-medium text-[var(--color-slate-body)]">
                          {log.entity || '-'}
                        </td>

                        <td className="px-6 py-3.5 text-[var(--color-slate-body)] font-mono text-[11px] max-w-xs truncate" title={String(log.details || '')}>
                          {log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : '-'}
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

      {/* Pagination */}
      {filteredLogs.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={logsPage}
            totalItems={filteredLogs.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setLogsPage}
          />
        </div>
      )}
    </div>
  );
}
