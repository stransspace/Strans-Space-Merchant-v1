import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher } from '../lib/api';
import Pagination from '../components/Pagination';
import SpinnerButton from '../components/SpinnerButton';

export default function VouchersPage({ activeBranchId, setActionError, setSuccessMessage, confirmAction }) {
  const [vouchers, setVouchers] = useState([]);
  const [vouchersSearch, setVouchersSearch] = useState('');
  const [vouchersPage, setVouchersPage] = useState(1);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    expiry_date: '',
    usage_limit: '',
    is_active: 1
  });

  const ITEMS_PER_PAGE = 10;

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const data = await getVouchers(scope);
      setVouchers(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError('Gagal memuat voucher: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, [activeBranchId]);

  const openAddVoucher = () => {
    setEditingVoucher(null);
    setVoucherForm({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      expiry_date: '',
      usage_limit: '',
      is_active: 1
    });
    setShowVoucherModal(true);
  };

  const openEditVoucher = (v) => {
    setEditingVoucher(v);
    let formattedDate = '';
    if (v.expiryDate) {
      const d = new Date(v.expiryDate);
      formattedDate = d.toISOString().slice(0, 16);
    }
    setVoucherForm({
      code: v.code,
      description: v.description || '',
      discount_type: v.discountType,
      discount_value: v.discountValue,
      min_order_amount: v.minOrderAmount || '',
      max_discount_amount: v.maxDiscountAmount || '',
      expiry_date: formattedDate,
      usage_limit: v.usageLimit || '',
      is_active: v.isActive !== undefined ? Number(v.isActive) : 1
    });
    setShowVoucherModal(true);
  };

  const saveVoucher = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!voucherForm.code || !voucherForm.discount_value) {
      setActionError('Kode voucher dan nilai diskon wajib diisi.');
      return;
    }
    try {
      const payload = {
        code: voucherForm.code.trim().toUpperCase(),
        description: voucherForm.description || null,
        discount_type: voucherForm.discount_type,
        discount_value: Number(voucherForm.discount_value),
        min_order_amount: voucherForm.min_order_amount !== '' ? Number(voucherForm.min_order_amount) : 0,
        max_discount_amount: voucherForm.max_discount_amount !== '' ? Number(voucherForm.max_discount_amount) : null,
        expiry_date: voucherForm.expiry_date || null,
        usage_limit: voucherForm.usage_limit !== '' ? Number(voucherForm.usage_limit) : null,
        is_active: Number(voucherForm.is_active)
      };
      setSaving(true);
      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, payload);
        setSuccessMessage('Voucher berhasil diperbarui.');
      } else {
        await createVoucher(payload);
        setSuccessMessage('Voucher baru berhasil dibuat.');
      }
      setShowVoucherModal(false);
      loadVouchers();
    } catch (err) {
      setActionError('Gagal menyimpan voucher: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = async (id) => {
    if (!(await confirmAction('Apakah Anda yakin ingin menghapus voucher ini?', { title: 'Hapus Voucher', confirmText: 'Ya, hapus' }))) return;
    try {
      await deleteVoucher(id);
      setSuccessMessage('Voucher berhasil dihapus.');
      loadVouchers();
    } catch (err) {
      setActionError('Gagal menghapus voucher: ' + err.message);
    }
  };

  const filteredVouchers = vouchers.filter(v => 
    (v.code || '').toLowerCase().includes(vouchersSearch.toLowerCase()) ||
    (v.description || '').toLowerCase().includes(vouchersSearch.toLowerCase())
  );

  const startIndex = (vouchersPage - 1) * ITEMS_PER_PAGE;
  const paginatedVouchers = filteredVouchers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Manajemen Voucher & Promo</h3>
          <p className="text-xs text-slate-600">Kelola kupon diskon pelanggan, minimal belanja, kuota penggunaan, dan tanggal kedaluwarsa kupon.</p>
        </div>
        <button 
          onClick={() => {
            if (activeBranchId === 'all') {
              setActionError('Silakan pilih salah satu cabang spesifik terlebih dahulu untuk mendaftarkan voucher diskon baru.');
              return;
            }
            openAddVoucher();
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
            activeBranchId === 'all'
              ? 'bg-slate-100 text-slate-500 border border-slate-200/60 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/10'
          }`}
        >
          <Plus size={14} />
          <span>Tambah Voucher</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Cari kode kupon atau deskripsi..."
            value={vouchersSearch}
            onChange={(e) => {
              setVouchersSearch(e.target.value);
              setVouchersPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500"
          />
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold">
            <tr>
              <th className="p-4">Kode Kupon</th>
              <th className="p-4">Deskripsi / Promo</th>
              {activeBranchId === 'all' && <th className="p-4">Cabang</th>}
              <th className="p-4 text-center">Nilai Diskon</th>
              <th className="p-4 text-center">Syarat Belanja Min.</th>
              <th className="p-4 text-center">Batas Kuota</th>
              <th className="p-4 text-center">Kedaluwarsa</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-slate-50/20">
            {paginatedVouchers.map((v) => {
              const isExpired = v.expiryDate && new Date(v.expiryDate) < new Date();
              const isQuotaFull = v.usageLimit && v.usedCount >= v.usageLimit;
              
              return (
                <tr key={v.id} className="hover:bg-slate-100/30 text-slate-800">
                  <td className="p-4 font-mono font-bold tracking-wider text-sky-400">
                    {v.code}
                  </td>
                  <td className="p-4 max-w-xs truncate text-slate-600">
                    {v.description || 'Kupon Diskon POS'}
                  </td>
                  {activeBranchId === 'all' && (
                    <td className="p-4 font-semibold text-slate-600 truncate max-w-[120px]">
                      {v.tenantName || 'Cabang Utama'}
                    </td>
                  )}
                  <td className="p-4 text-center font-bold">
                    {v.discountType === 'percentage' 
                      ? `${Number(v.discountValue)}%` 
                      : `Rp ${Number(v.discountValue).toLocaleString('id-ID')}`}
                  </td>
                  <td className="p-4 text-center text-slate-700">
                    Rp {Number(v.minOrderAmount || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-4 text-center font-mono">
                    <span className="text-slate-800 font-bold">{v.usedCount}</span>
                    <span className="text-slate-500"> / {v.usageLimit || '∞'}</span>
                  </td>
                  <td className="p-4 text-center text-slate-600 font-mono text-[10px]">
                    {v.expiryDate 
                      ? new Date(v.expiryDate).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) 
                      : 'Selamanya'}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold ${
                      !v.isActive ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                      isExpired ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      isQuotaFull ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {!v.isActive ? 'Nonaktif' : isExpired ? 'Expired' : isQuotaFull ? 'Habis' : 'Aktif'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button 
                        onClick={() => openEditVoucher(v)} 
                        className="text-slate-600 hover:text-sky-400 transition-colors cursor-pointer"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteVoucher(v.id)} 
                        className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {loading ? (
              <tr><td colSpan={activeBranchId === 'all' ? 9 : 8} className="p-8 text-center text-slate-400">Memuat data…</td></tr>
            ) : filteredVouchers.length === 0 && (
              <tr>
                <td colSpan={activeBranchId === 'all' ? 9 : 8} className="p-8 text-center text-slate-500">
                  Tidak ditemukan voucher promo yang cocok dengan pencarian Anda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={vouchersPage} 
        totalItems={filteredVouchers.length} 
        itemsPerPage={ITEMS_PER_PAGE} 
        onPageChange={setVouchersPage} 
      />

      {/* VOUCHER MODAL (ADD / EDIT) */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingVoucher ? 'Ubah Kupon Voucher' : 'Tambah Kupon Voucher'}
              </h3>
              <button 
                onClick={() => setShowVoucherModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveVoucher} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Kode Voucher</label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: DISKONHEMAT, KOPIASIK"
                  value={voucherForm.code}
                  onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500 uppercase font-mono tracking-wider"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Keterangan / Deskripsi</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Diskon 10% minimal pembelian 50rb"
                  value={voucherForm.description}
                  onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Tipe Diskon</label>
                  <select 
                    value={voucherForm.discount_type}
                    onChange={(e) => setVoucherForm({ ...voucherForm, discount_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Nominal Tetap (Rupiah)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Nilai Diskon</label>
                  <input 
                    type="number" 
                    required
                    placeholder={voucherForm.discount_type === 'percentage' ? 'Persen diskon (contoh: 10)' : 'Jumlah Rupiah (contoh: 15000)'}
                    value={voucherForm.discount_value}
                    onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Minimal Pembelian (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="Contoh: 50000"
                    value={voucherForm.min_order_amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, min_order_amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Maksimal Diskon (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="Kosongkan jika tak terbatas"
                    value={voucherForm.max_discount_amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, max_discount_amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Batas Penggunaan (Kuota)</label>
                  <input 
                    type="number" 
                    placeholder="Kosongkan jika tak terbatas"
                    value={voucherForm.usage_limit}
                    onChange={(e) => setVoucherForm({ ...voucherForm, usage_limit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Masa Berlaku (Expired)</label>
                  <input 
                    type="datetime-local" 
                    value={voucherForm.expiry_date}
                    onChange={(e) => setVoucherForm({ ...voucherForm, expiry_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Status Kupon</label>
                <select 
                  value={voucherForm.is_active}
                  onChange={(e) => setVoucherForm({ ...voucherForm, is_active: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value={1}>Aktif / Berlaku</option>
                  <option value={0}>Nonaktif / Ditangguhkan</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowVoucherModal(false)}
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
