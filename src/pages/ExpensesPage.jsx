import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Coins, 
  Calendar, 
  Tag, 
  TrendingDown,
  Receipt
} from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../lib/api';
import { formatRupiah, formatDate, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import Pagination from '../components/Pagination';

const EXPENSE_CATEGORIES = ['Operasional', 'Bahan Baku & Dapur', 'Gaji / Upah', 'Utilitas (Listrik/Air/Internet)', 'Sewa & Tempat', 'Marketing & Iklan', 'Perbaikan & Maintenance', 'Lainnya'];

export default function ExpensesPage({ activeBranchId, setActionError, setSuccessMessage, confirmAction }) {
  const [expenses, setExpenses] = useState([]);
  const [expensesSearch, setExpensesSearch] = useState('');
  const [expensesPage, setExpensesPage] = useState(1);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Operasional',
    description: '',
    amount: ''
  });

  const ITEMS_PER_PAGE = 10;

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const data = await getExpenses(scope);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError('Gagal memuat pengeluaran: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [activeBranchId]);

  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      category: 'Operasional',
      description: '',
      amount: ''
    });
    setShowExpenseModal(true);
  };

  const openEditExpense = (e) => {
    setEditingExpense(e);
    setExpenseForm({
      category: e.category || 'Operasional',
      description: e.description || '',
      amount: e.amount || ''
    });
    setShowExpenseModal(true);
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!expenseForm.category || !expenseForm.description || !expenseForm.amount) {
      setActionError('Kategori, keterangan, dan nominal pengeluaran wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: expenseForm.category.trim(),
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount)
      };
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
        setSuccessMessage('Pengeluaran berhasil diperbarui.');
      } else {
        await createExpense(payload);
        setSuccessMessage('Pengeluaran baru berhasil dicatat.');
      }
      setShowExpenseModal(false);
      loadExpenses();
    } catch (err) {
      setActionError('Gagal menyimpan pengeluaran: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!(await confirmAction('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?', { title: 'Hapus Pengeluaran', confirmText: 'Ya, hapus' }))) return;
    try {
      await deleteExpense(id);
      setSuccessMessage('Catatan pengeluaran berhasil dihapus.');
      loadExpenses();
    } catch (err) {
      setActionError('Gagal menghapus pengeluaran: ' + err.message);
    }
  };

  const filteredExpenses = expenses.filter(e =>
    (e.description || '').toLowerCase().includes(expensesSearch.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(expensesSearch.toLowerCase())
  );

  const startIndex = (expensesPage - 1) * ITEMS_PER_PAGE;
  const paginatedExpenses = filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Biaya & Pengeluaran Kas
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Pencatatan kas keluar operasional untuk perhitungan akurat laba bersih pada laporan P&L.
          </p>
        </div>

        <Button onClick={openAddExpense} className="shadow-md">
          <Plus className="h-4 w-4" />
          <span>Catat Kas Keluar</span>
        </Button>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-white to-rose-50/30 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Total Pengeluaran Dicatat</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {formatRupiah(totalExpenseAmount)}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/30 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Jumlah Transaksi Biaya</span>
            <Receipt className="h-4 w-4 text-[var(--color-brand-600)]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {expenses.length} <span className="text-xs font-normal text-[var(--color-slate-muted)]">catatan</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/30 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Cakupan Outlet</span>
            <Tag className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {activeBranchId === 'all' ? 'Semua Cabang' : 'Outlet Aktif'}
          </div>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Riwayat Pengeluaran Operasional</CardTitle>
              <CardDescription>Daftar seluruh kas keluar yang mempengaruhi neraca laba rugi.</CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-slate-muted)] pointer-events-none" />
              <Input
                placeholder="Cari keterangan biaya..."
                value={expensesSearch}
                onChange={(e) => {
                  setExpensesSearch(e.target.value);
                  setExpensesPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
              Memuat data pengeluaran kas...
            </div>
          ) : paginatedExpenses.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Belum ada catatan pengeluaran kas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Kategori Biaya</th>
                    <th className="px-4 py-3.5">Keterangan / Keperluan</th>
                    {activeBranchId === 'all' && <th className="px-4 py-3.5">Cabang</th>}
                    <th className="px-4 py-3.5 text-right">Nominal Pengeluaran</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {paginatedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-[var(--color-ink)] flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-[var(--color-brand-600)] shrink-0" />
                        <span>{formatDate(exp.date || exp.created_at)}</span>
                      </td>

                      <td className="px-4 py-4">
                        <Badge variant="secondary">{exp.category || 'Operasional'}</Badge>
                      </td>

                      <td className="px-4 py-4 text-[var(--color-slate-body)] font-medium">
                        {exp.description}
                      </td>

                      {activeBranchId === 'all' && (
                        <td className="px-4 py-4 font-semibold text-[var(--color-ink)]">
                          {exp.tenantName || 'Outlet Utama'}
                        </td>
                      )}

                      <td className="px-4 py-4 text-right font-extrabold text-sm text-rose-600">
                        {formatRupiah(exp.amount || 0)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openEditExpense(exp)} className="h-7 px-2 text-xs">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 text-[var(--color-slate-muted)] hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredExpenses.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={expensesPage}
            totalItems={filteredExpenses.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setExpensesPage}
          />
        </div>
      )}

      {/* MODAL: Tambah/Edit Pengeluaran */}
      <Dialog open={showExpenseModal} onClose={() => setShowExpenseModal(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowExpenseModal(false)}>
          <DialogTitle>{editingExpense ? 'Sunting Pengeluaran' : 'Catat Pengeluaran Kas Baru'}</DialogTitle>
          <DialogDescription>Pengeluaran ini akan langsung dicatat pada neraca pembukuan cabang.</DialogDescription>
        </DialogHeader>

        <form onSubmit={saveExpense}>
          <DialogContent className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Kategori Biaya</label>
              <Select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Nominal Kas Keluar (Rp)</label>
              <Input
                type="number"
                min="0"
                required
                placeholder="Contoh: 150000"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Keterangan / Keperluan</label>
              <Input
                required
                placeholder="Contoh: Beli es batu kristal 5 kantong, perbaikan kran air"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowExpenseModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : editingExpense ? 'Simpan Perubahan' : 'Catat Pengeluaran'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
