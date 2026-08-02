import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../lib/api';
import Pagination from '../components/Pagination';
import SpinnerButton from '../components/SpinnerButton';

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

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Manajemen Pengeluaran & Biaya Operasional</h3>
          <p className="text-xs text-slate-600">Catat dan pantau pengeluaran berkala outlet seperti sewa, listrik, air, gaji, perbaikan, dll.</p>
        </div>
        <button 
          onClick={() => {
            if (activeBranchId === 'all') {
              setActionError('Silakan pilih salah satu cabang spesifik terlebih dahulu untuk mendaftarkan biaya pengeluaran baru.');
              return;
            }
            openAddExpense();
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
            activeBranchId === 'all'
              ? 'bg-slate-100 text-slate-500 border border-slate-200/60 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/10'
          }`}
        >
          <Plus size={14} />
          <span>Catat Pengeluaran</span>
        </button>
      </div>

      {/* Expenses Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50/40 border border-slate-100 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Pengeluaran Tercatat</span>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            Rp {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-slate-50/40 border border-slate-100 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-500">Transaksi Pengeluaran</span>
          <p className="text-xl font-extrabold text-sky-400 mt-1">{expenses.length} Transaksi</p>
        </div>
        <div className="bg-slate-50/40 border border-slate-100 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-500">Kategori Terbanyak</span>
          <p className="text-xl font-extrabold text-purple-400 mt-1 truncate">
            {expenses.length > 0 ? (
              Object.entries(
                expenses.reduce((acc, curr) => {
                  acc[curr.category] = (acc[curr.category] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
            ) : '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Cari deskripsi atau kategori biaya..."
            value={expensesSearch}
            onChange={(e) => {
              setExpensesSearch(e.target.value);
              setExpensesPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500"
          />
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold">
            <tr>
              <th className="p-4">Tanggal Catat</th>
              {activeBranchId === 'all' && <th className="p-4">Cabang</th>}
              <th className="p-4">Kategori Biaya</th>
              <th className="p-4">Keterangan / Keperluan</th>
              <th className="p-4 text-right">Nominal Pengeluaran</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-slate-50/20">
            {paginatedExpenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-100/30 text-slate-800">
                <td className="p-4 font-mono text-slate-600">
                  {new Date(e.date || e.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                </td>
                {activeBranchId === 'all' && (
                  <td className="p-4 font-semibold text-slate-600 truncate max-w-[120px]">
                    {e.tenantName || 'Cabang Utama'}
                  </td>
                )}
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    e.category === 'Gaji Karyawan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    e.category === 'Sewa Tempat' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    e.category === 'Bahan Baku' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    e.category === 'Peralatan & Perbaikan' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {e.category}
                  </span>
                </td>
                <td className="p-4 text-slate-700 font-medium">{e.description}</td>
                <td className="p-4 text-right font-extrabold text-slate-900">
                  Rp {Number(e.amount).toLocaleString('id-ID')}
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-3">
                    <button 
                      onClick={() => openEditExpense(e)} 
                      className="text-slate-600 hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteExpense(e.id)} 
                      className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr><td colSpan={activeBranchId === 'all' ? 6 : 5} className="p-8 text-center text-slate-400">Memuat data…</td></tr>
            ) : filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={activeBranchId === 'all' ? 6 : 5} className="p-8 text-center text-slate-500">
                  Tidak ditemukan catatan pengeluaran operasional yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={expensesPage} 
        totalItems={filteredExpenses.length} 
        itemsPerPage={ITEMS_PER_PAGE} 
        onPageChange={setExpensesPage} 
      />

      {/* EXPENSE MODAL (ADD / EDIT) */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingExpense ? 'Ubah Catatan Pengeluaran' : 'Catat Pengeluaran Baru'}
              </h3>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveExpense} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Kategori Pengeluaran</label>
                <select 
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="Operasional">Operasional</option>
                  <option value="Gaji Karyawan">Gaji Karyawan</option>
                  <option value="Sewa Tempat">Sewa Tempat</option>
                  <option value="Peralatan & Perbaikan">Peralatan & Perbaikan</option>
                  <option value="Bahan Baku">Bahan Baku</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Keterangan / Keperluan</label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: Bayar Listrik Juni, Pembelian Blender Baru"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Nominal Biaya (Rp)</label>
                <input 
                  type="number" 
                  required
                  placeholder="Contoh: 150000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500 font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 border border-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <SpinnerButton
                  type="submit"
                  loading={saving}
                  loadingText="Menyimpan…"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan
                </SpinnerButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
