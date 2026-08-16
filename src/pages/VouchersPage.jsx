import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Ticket, 
  Percent, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  Tag
} from 'lucide-react';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher } from '../lib/api';
import { formatRupiah, formatDate, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import Pagination from '../components/Pagination';

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
    if (v.expiryDate || v.expiry_date) {
      const d = new Date(v.expiryDate || v.expiry_date);
      if (!isNaN(d.getTime())) formattedDate = d.toISOString().slice(0, 10);
    }
    setVoucherForm({
      code: v.code,
      description: v.description || '',
      discount_type: v.discountType || v.discount_type || 'percentage',
      discount_value: v.discountValue || v.discount_value || '',
      min_order_amount: v.minOrderAmount || v.min_order_amount || '',
      max_discount_amount: v.maxDiscountAmount || v.max_discount_amount || '',
      expiry_date: formattedDate,
      usage_limit: v.usageLimit || v.usage_limit || '',
      is_active: v.isActive !== undefined ? Number(v.isActive) : Number(v.is_active || 1)
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
    setSaving(true);
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

      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, payload);
        setSuccessMessage('Voucher berhasil diperbarui.');
      } else {
        await createVoucher(payload);
        setSuccessMessage('Voucher promo baru berhasil dibuat.');
      }
      setShowVoucherModal(false);
      loadVouchers();
    } catch (err) {
      setActionError(err.message || 'Gagal menyimpan voucher.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = async (id, code) => {
    if (!(await confirmAction(`Apakah Anda yakin ingin menghapus voucher "${code}"?`, { title: 'Hapus Voucher', confirmText: 'Ya, hapus' }))) return;
    try {
      await deleteVoucher(id);
      setSuccessMessage('Voucher berhasil dihapus.');
      loadVouchers();
    } catch (err) {
      setActionError(err.message || 'Gagal menghapus voucher.');
    }
  };

  const filteredVouchers = vouchers.filter(v =>
    (v.code || '').toLowerCase().includes(vouchersSearch.toLowerCase()) ||
    (v.description || '').toLowerCase().includes(vouchersSearch.toLowerCase())
  );

  const startIndex = (vouchersPage - 1) * ITEMS_PER_PAGE;
  const paginatedVouchers = filteredVouchers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Promo & Diskon Voucher
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Buat kode kupon diskon persentase atau potongan nominal tetap untuk menarik pelanggan di kasir.
          </p>
        </div>

        <Button onClick={openAddVoucher} className="shadow-md">
          <Plus className="h-4 w-4" />
          <span>Buat Voucher Baru</span>
        </Button>
      </div>

      {/* Main Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Daftar Kode Promo</CardTitle>
              <CardDescription>Kode promo yang berlaku saat checkout pesanan kasir.</CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-slate-muted)] pointer-events-none" />
              <Input
                placeholder="Cari kode promo..."
                value={vouchersSearch}
                onChange={(e) => {
                  setVouchersSearch(e.target.value);
                  setVouchersPage(1);
                }}
                className="pl-9 h-9 text-xs font-mono"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
              Memuat data voucher promo...
            </div>
          ) : paginatedVouchers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Belum ada voucher promo yang dibuat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Kode Voucher</th>
                    <th className="px-4 py-3.5">Diskon</th>
                    <th className="px-4 py-3.5">Keterangan</th>
                    <th className="px-4 py-3.5">Min. Belanja</th>
                    <th className="px-4 py-3.5">Berlaku Sampai</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {paginatedVouchers.map((v) => {
                    const isPercentage = (v.discountType || v.discount_type) === 'percentage';
                    const isActive = Number(v.isActive ?? v.is_active ?? 1) === 1;

                    return (
                      <tr key={v.id} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-[var(--color-ink)] flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shrink-0">
                            <Ticket className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-mono font-black text-sm text-[var(--color-brand-800)] tracking-wider">
                              {v.code}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 font-black text-sm text-emerald-700">
                          {isPercentage ? `${v.discountValue || v.discount_value}%` : formatRupiah(v.discountValue || v.discount_value)}
                        </td>

                        <td className="px-4 py-4 text-[var(--color-slate-body)]">
                          {v.description || '-'}
                        </td>

                        <td className="px-4 py-4 font-semibold text-[var(--color-ink)]">
                          {(v.minOrderAmount || v.min_order_amount) > 0 ? formatRupiah(v.minOrderAmount || v.min_order_amount) : 'Tanpa Min.'}
                        </td>

                        <td className="px-4 py-4 text-[var(--color-slate-muted)]">
                          {(v.expiryDate || v.expiry_date) ? formatDate(v.expiryDate || v.expiry_date) : 'Selamanya'}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <Badge variant={isActive ? 'success' : 'danger'}>
                            {isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openEditVoucher(v)} className="h-7 px-2 text-xs">
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(v.id, v.code)}
                              className="p-1.5 text-[var(--color-slate-muted)] hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
      {filteredVouchers.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={vouchersPage}
            totalItems={filteredVouchers.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setVouchersPage}
          />
        </div>
      )}

      {/* MODAL: Tambah/Edit Voucher */}
      <Dialog open={showVoucherModal} onClose={() => setShowVoucherModal(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowVoucherModal(false)}>
          <DialogTitle>{editingVoucher ? 'Sunting Voucher' : 'Buat Voucher Promo Baru'}</DialogTitle>
          <DialogDescription>Atur kode promo dan ketentuan diskon checkout.</DialogDescription>
        </DialogHeader>

        <form onSubmit={saveVoucher}>
          <DialogContent className="space-y-3.5 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Kode Voucher (Kupon)</label>
              <Input
                required
                placeholder="Contoh: DISKON10, GAJIAN50"
                value={voucherForm.code}
                onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Tipe Diskon</label>
                <Select
                  value={voucherForm.discount_type}
                  onChange={(e) => setVoucherForm({ ...voucherForm, discount_type: e.target.value })}
                >
                  <option value="percentage">Persen (%)</option>
                  <option value="fixed">Nominal Tetap (Rp)</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nilai Diskon</label>
                <Input
                  type="number"
                  min="0"
                  required
                  placeholder={voucherForm.discount_type === 'percentage' ? "Contoh: 15" : "Contoh: 10000"}
                  value={voucherForm.discount_value}
                  onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Min. Belanja (Rp)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0 (Tanpa min)"
                  value={voucherForm.min_order_amount}
                  onChange={(e) => setVoucherForm({ ...voucherForm, min_order_amount: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Kadaluarsa</label>
                <Input
                  type="date"
                  value={voucherForm.expiry_date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Keterangan Promo</label>
              <Input
                placeholder="Contoh: Diskon khusus hari kemerdekaan"
                value={voucherForm.description}
                onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowVoucherModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : editingVoucher ? 'Simpan Perubahan' : 'Buat Voucher'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
