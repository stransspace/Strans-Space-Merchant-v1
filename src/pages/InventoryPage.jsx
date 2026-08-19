import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Layers, 
  AlertTriangle, 
  ArrowUpDown, 
  Building2, 
  CheckCircle2, 
  Sliders, 
  DollarSign, 
  Package
} from 'lucide-react';
import { 
  getMaterials, 
  getCentralStock, 
  createMaterial, 
  updateMaterial, 
  deleteMaterial, 
  adjustMaterialStock, 
  updateMaterialStockMin 
} from '../lib/api';
import { formatRupiah, formatNumber, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import Pagination from '../components/Pagination';

const INVENTORY_SUB_TABS = ['stock', 'materials'];

export default function InventoryPage({ activeBranchId, session, setActionError, setSuccessMessage, confirmAction, initialSubTab }) {
  const [materials, setMaterials] = useState([]);
  const [centralStock, setCentralStock] = useState(null);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'materials'

  // Deep-link dari GlobalSearch (Cmd+K), mis. "inventory:materials".
  useEffect(() => {
    if (initialSubTab && INVENTORY_SUB_TABS.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);


  const [inventorySearch, setInventorySearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState({ name: '', unit: 'gr', price: '' });
  
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedStockMaterial, setSelectedStockMaterial] = useState(null);
  const [stockForm, setStockForm] = useState({ qty: '', type: 'add', notes: '', stockMin: '' });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ITEMS_PER_PAGE = 10;

  const loadInventory = async () => {
    setLoading(true);
    try {
      if (activeBranchId === 'all') {
        const stockData = await getCentralStock().catch(e => { console.error(e); return null; });
        setCentralStock(stockData);
      } else {
        const list = await getMaterials().catch(e => { console.error(e); return []; });
        setMaterials(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      setActionError('Gagal memuat persediaan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [activeBranchId]);

  const openAddMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm({ name: '', unit: 'gr', price: '' });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (m) => {
    setEditingMaterial(m);
    setMaterialForm({ name: m.name, unit: m.unit || 'gr', price: m.price != null ? String(m.price) : '' });
    setShowMaterialModal(true);
  };

  const saveMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.name || !materialForm.unit) {
      setActionError('Nama dan satuan bahan baku wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: materialForm.name,
        unit: materialForm.unit,
        price: materialForm.price ? Number(materialForm.price) : 0
      };

      if (editingMaterial) {
        await updateMaterial(editingMaterial.id, payload);
        setSuccessMessage('Bahan baku berhasil diperbarui.');
      } else {
        await createMaterial(payload);
        setSuccessMessage('Bahan baku baru berhasil didaftarkan.');
      }
      setShowMaterialModal(false);
      loadInventory();
    } catch (err) {
      setActionError('Gagal menyimpan bahan baku: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMaterial = async (id, name) => {
    if (!(await confirmAction(`Apakah Anda yakin ingin menghapus bahan baku "${name}"?`, { title: 'Hapus Bahan Baku', confirmText: 'Ya, hapus' }))) return;
    try {
      await deleteMaterial(id);
      setSuccessMessage('Bahan baku berhasil dihapus.');
      loadInventory();
    } catch (err) {
      setActionError('Gagal menghapus bahan baku: ' + err.message);
    }
  };

  const openStockAdjust = (m) => {
    setSelectedStockMaterial(m);
    setStockForm({ qty: '', type: 'add', notes: '', stockMin: m.stock_min ?? '' });
    setShowStockModal(true);
  };

  const saveStockAdjust = async (e) => {
    e.preventDefault();
    if (!stockForm.qty || isNaN(Number(stockForm.qty))) {
      setActionError('Jumlah (Quantity) tidak valid.');
      return;
    }
    if (stockForm.stockMin !== '' && (isNaN(Number(stockForm.stockMin)) || Number(stockForm.stockMin) < 0)) {
      setActionError('Batas stok minimum harus berupa angka positif.');
      return;
    }
    setSaving(true);
    try {
      const activeTenant = activeBranchId === 'all' ? String(session.tenant.id) : activeBranchId;
      await adjustMaterialStock(selectedStockMaterial.id, {
        qty: Number(stockForm.qty),
        type: stockForm.type,
        notes: stockForm.notes,
        tenant_id: activeTenant
      });
      if (stockForm.stockMin !== '') {
        await updateMaterialStockMin(selectedStockMaterial.id, Number(stockForm.stockMin));
      }
      setSuccessMessage('Penyesuaian stok berhasil disimpan.');
      setShowStockModal(false);
      loadInventory();
    } catch (err) {
      setActionError('Gagal menyesuaikan stok: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const catalogList = activeBranchId === 'all' ? (centralStock?.materials || []) : materials;

  const filteredInventory = catalogList.filter(m =>
    (m.name || '').toLowerCase().includes(inventorySearch.toLowerCase())
  );
  const paginatedInventory = filteredInventory.slice((inventoryPage - 1) * ITEMS_PER_PAGE, inventoryPage * ITEMS_PER_PAGE);

  const lowStockCount = catalogList.filter(m => {
    const current = Number(m.stock || 0);
    const min = Number(m.stock_min || 0);
    return min > 0 && current <= min;
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Inventori & Bahan Baku HPP
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kontrol kuantitas stok bahan baku, batas minimum (low stock alert), dan perhitungan modal HPP per porsi.
          </p>
        </div>

        <Button onClick={openAddMaterial} className="shadow-md">
          <Plus className="h-4 w-4" />
          <span>Tambah Bahan Baku</span>
        </Button>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Total Jenis Bahan Baku</span>
            <Layers className="h-4 w-4 text-[var(--color-brand-600)]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {catalogList.length} <span className="text-xs font-normal text-[var(--color-slate-muted)]">komoditas</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Peringatan Stok Menipis</span>
            <AlertTriangle className={cn('h-4 w-4', lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500')} />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {lowStockCount} <span className="text-xs font-normal text-[var(--color-slate-muted)]">bahan perlu restock</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Cakupan Outlet</span>
            <Building2 className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {activeBranchId === 'all' ? 'Pusat (Semua Cabang)' : 'Cabang Aktif'}
          </div>
        </Card>
      </div>

      {/* Main Stock Table Card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {activeBranchId === 'all' ? 'Matriks Stok Persediaan Multi-Cabang' : 'Daftar Persediaan Bahan Baku'}
              </CardTitle>
              <CardDescription>
                {activeBranchId === 'all' 
                  ? 'Persebaran jumlah stok di masing-masing cabang holding perusahaan.'
                  : 'Pantau saldo stok fisik saat ini dan batas aman minimum.'}
              </CardDescription>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-slate-muted)] pointer-events-none" />
              <Input
                placeholder="Cari bahan baku..."
                value={inventorySearch}
                onChange={(e) => {
                  setInventorySearch(e.target.value);
                  setInventoryPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
              Memuat data persediaan bahan baku...
            </div>
          ) : paginatedInventory.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Tidak ada bahan baku yang ditemukan. Klik <b>Tambah Bahan Baku</b> untuk membuat master data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Nama Bahan Baku</th>
                    <th className="px-4 py-3.5">Satuan</th>
                    <th className="px-4 py-3.5 text-right">Harga Modal/Satuan</th>
                    {activeBranchId === 'all' ? (
                      // Multi-branch headers
                      (centralStock?.branches || []).map(b => (
                        <th key={b.id} className="px-4 py-3.5 text-center">{b.name}</th>
                      ))
                    ) : (
                      <>
                        <th className="px-4 py-3.5 text-center">Stok Saat Ini</th>
                        <th className="px-4 py-3.5 text-center">Batas Minimum</th>
                        <th className="px-4 py-3.5 text-center">Status</th>
                      </>
                    )}
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {paginatedInventory.map((m) => {
                    const currentStock = Number(m.stock || 0);
                    const minStock = Number(m.stock_min || 0);
                    const isLow = minStock > 0 && currentStock <= minStock;
                    const isOut = currentStock <= 0;

                    return (
                      <tr key={m.id} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-[var(--color-ink)] flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)] shrink-0">
                            <Layers className="h-4 w-4" />
                          </div>
                          <div>
                            <div>{m.name}</div>
                            <span className="text-[10px] text-[var(--color-slate-muted)] font-normal">ID: {m.id}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-medium text-[var(--color-slate-body)]">
                          <Badge variant="secondary">{m.unit || 'unit'}</Badge>
                        </td>

                        <td className="px-4 py-3.5 text-right font-semibold text-[var(--color-ink)]">
                          {formatRupiah(m.price || 0)}
                        </td>

                        {activeBranchId === 'all' ? (
                          (centralStock?.branches || []).map(b => {
                            const bStock = m.branch_stocks?.[b.id] ?? 0;
                            return (
                              <td key={b.id} className="px-4 py-3.5 text-center font-mono font-bold">
                                {formatNumber(bStock)} {m.unit}
                              </td>
                            );
                          })
                        ) : (
                          <>
                            <td className="px-4 py-3.5 text-center font-mono font-extrabold text-sm text-[var(--color-ink)]">
                              {formatNumber(currentStock)} <span className="text-[10px] font-normal text-[var(--color-slate-muted)]">{m.unit}</span>
                            </td>

                            <td className="px-4 py-3.5 text-center font-mono text-[var(--color-slate-muted)]">
                              {minStock > 0 ? `${formatNumber(minStock)} ${m.unit}` : '-'}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              {isOut ? (
                                <Badge variant="danger">Habis</Badge>
                              ) : isLow ? (
                                <Badge variant="warning">Menipis</Badge>
                              ) : (
                                <Badge variant="success">Aman</Badge>
                              )}
                            </td>
                          </>
                        )}

                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {activeBranchId !== 'all' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openStockAdjust(m)}
                                className="h-7 px-2 text-xs"
                              >
                                <Sliders className="h-3 w-3" />
                                <span>Atur Stok</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditMaterial(m)}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>

                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(m.id, m.name)}
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
      {filteredInventory.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={inventoryPage}
            totalItems={filteredInventory.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setInventoryPage}
          />
        </div>
      )}

      {/* MODAL: Form Tambah/Sunting Master Bahan */}
      <Dialog open={showMaterialModal} onClose={() => setShowMaterialModal(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowMaterialModal(false)}>
          <DialogTitle>{editingMaterial ? 'Sunting Bahan Baku' : 'Tambah Bahan Baku Baru'}</DialogTitle>
          <DialogDescription>
            Master bahan baku digunakan untuk menghitung modal HPP resep menu dan notifikasi stok menipis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={saveMaterial}>
          <DialogContent className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Nama Bahan Baku</label>
              <Input
                required
                placeholder="Contoh: Biji Kopi Arabica Gayo"
                value={materialForm.name}
                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Satuan Ukur</label>
                <Select
                  value={materialForm.unit}
                  onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                >
                  <option value="gr">Gram (gr)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ml">Mililiter (ml)</option>
                  <option value="liter">Liter</option>
                  <option value="pcs">Pcs / Biji</option>
                  <option value="porsi">Porsi</option>
                  <option value="lembar">Lembar</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Harga per Satuan (Rp)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Contoh: 150"
                  value={materialForm.price}
                  onChange={(e) => setMaterialForm({ ...materialForm, price: e.target.value })}
                />
              </div>
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowMaterialModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Bahan Baku'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: Form Penyesuaian Stok (Stock Adjustment) */}
      <Dialog open={showStockModal} onClose={() => setShowStockModal(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowStockModal(false)}>
          <DialogTitle>Penyesuaian Stok: {selectedStockMaterial?.name}</DialogTitle>
          <DialogDescription>
            Catat stok masuk pembelian baru, opname fisik, atau penyusutan bahan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={saveStockAdjust}>
          <DialogContent className="space-y-4 pt-4">
            <div className="rounded-xl bg-[var(--color-brand-50)] p-3 text-xs flex justify-between items-center">
              <span className="text-[var(--color-slate-muted)]">Stok Saat Ini:</span>
              <span className="font-bold text-sm text-[var(--color-brand-800)]">
                {formatNumber(selectedStockMaterial?.stock || 0)} {selectedStockMaterial?.unit}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Tipe Penyesuaian</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'add', label: '+ Masuk' },
                  { id: 'reduce', label: '- Keluar' },
                  { id: 'set', label: '= Set Fisik' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStockForm({ ...stockForm, type: t.id })}
                    className={cn(
                      'rounded-xl py-2 text-xs font-bold transition-all border',
                      stockForm.type === t.id
                        ? 'bg-[var(--color-brand-600)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--color-snow)] text-[var(--color-slate-body)] border-[var(--color-hairline)] hover:bg-[var(--color-brand-50)]'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                  Jumlah ({selectedStockMaterial?.unit})
                </label>
                <Input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={stockForm.qty}
                  onChange={(e) => setStockForm({ ...stockForm, qty: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                  Batas Min. Alert
                </label>
                <Input
                  type="number"
                  placeholder="Opsional"
                  value={stockForm.stockMin}
                  onChange={(e) => setStockForm({ ...stockForm, stockMin: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">Catatan / Keterangan</label>
              <Input
                placeholder="Contoh: Pembelian supplier, barang rusak, opname"
                value={stockForm.notes}
                onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowStockModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
