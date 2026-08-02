import React, { useState, useEffect } from 'react';
import { Search, Edit, Trash2 } from 'lucide-react';
import { getMaterials, getCentralStock, createMaterial, updateMaterial, deleteMaterial, adjustMaterialStock, updateMaterialStockMin } from '../lib/api';
import Pagination from '../components/Pagination';
import SpinnerButton from '../components/SpinnerButton';

export default function InventoryPage({ activeBranchId, session, setActionError, setSuccessMessage, confirmAction }) {
  const [materials, setMaterials] = useState([]);
  const [centralStock, setCentralStock] = useState(null);
  
  const [inventorySearch, setInventorySearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [materialsPage, setMaterialsPage] = useState(1);
  
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState({ name: '', unit: '' });
  
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
    setMaterialForm({ name: '', unit: '' });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (m) => {
    setEditingMaterial(m);
    setMaterialForm({ name: m.name, unit: m.unit });
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
      if (editingMaterial) {
        await updateMaterial(editingMaterial.id, materialForm);
        setSuccessMessage('Bahan baku berhasil diperbarui.');
      } else {
        await createMaterial(materialForm);
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

  const handleDeleteMaterial = async (id) => {
    if (!(await confirmAction('Apakah Anda yakin ingin menghapus bahan baku ini?', { title: 'Hapus Bahan Baku', confirmText: 'Ya, hapus' }))) return;
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
      setSuccessMessage('Stok berhasil disesuaikan.');
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
    m.name.toLowerCase().includes(inventorySearch.toLowerCase())
  );
  const paginatedInventory = filteredInventory.slice((inventoryPage - 1) * ITEMS_PER_PAGE, inventoryPage * ITEMS_PER_PAGE);

  const filteredCatalog = catalogList.filter(m =>
    m.name.toLowerCase().includes(materialsSearch.toLowerCase())
  );
  const paginatedCatalog = filteredCatalog.slice((materialsPage - 1) * ITEMS_PER_PAGE, materialsPage * ITEMS_PER_PAGE);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Left Panel: Stock Levels (Consolidated Matrix or Local List) */}
      <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Stok Bahan Baku</h3>
            <p className="text-xs text-slate-600">
              {activeBranchId === 'all' 
                ? 'Matriks persediaan bahan baku real-time di seluruh cabang.'
                : 'Sisa kuantitas persediaan bahan baku pada cabang aktif.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Cari nama bahan baku..."
              value={inventorySearch}
              onChange={(e) => {
                setInventorySearch(e.target.value);
                setInventoryPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
          {activeBranchId === 'all' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-4">Nama Bahan</th>
                  <th className="p-4">Satuan</th>
                  {centralStock?.branches.map(b => (
                    <th key={b.id} className="p-4 text-center">{b.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-slate-50/20">
                {paginatedInventory.map(m => (
                  <tr key={m.id} className="hover:bg-slate-100/30 text-slate-800">
                    <td className="p-4 font-bold">{m.name}</td>
                    <td className="p-4 font-mono text-slate-600">{m.unit}</td>
                    {centralStock.branches.map(b => {
                      const match = centralStock.stocks.find(s => s.material_id === m.id && s.branch_id === b.id);
                      const qty = match ? Number(match.stock) : 0;
                      const isLow = match && match.stock_min && qty <= Number(match.stock_min);
                      return (
                        <td key={b.id} className="p-4 text-center">
                          <span className={`font-extrabold ${isLow ? 'text-rose-400 font-black' : 'text-slate-700'}`}>
                            {qty.toLocaleString('id-ID')}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {loading ? (
                  <tr><td colSpan={2 + (centralStock?.branches.length || 0)} className="p-8 text-center text-slate-400">Memuat data…</td></tr>
                ) : filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={2 + (centralStock?.branches.length || 0)} className="p-8 text-center text-slate-500">
                      Tidak ada stok bahan baku yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-4">Nama Bahan</th>
                  <th className="p-4 text-center">Sisa Stok</th>
                  <th className="p-4">Satuan</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-slate-50/20">
                {paginatedInventory.map(m => {
                  const isLow = m.stock_min && Number(m.stock) <= Number(m.stock_min);
                  return (
                    <tr key={m.id} className="hover:bg-slate-100/30 text-slate-800">
                      <td className="p-4 font-bold">{m.name}</td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-extrabold ${isLow ? 'text-rose-400 font-black' : 'text-sky-400'}`}>
                          {Number(m.stock).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{m.unit}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => openStockAdjust(m)}
                          className="px-3 py-1 bg-slate-100 hover:bg-sky-500 hover:text-white rounded-lg font-bold text-[10px] uppercase transition-all cursor-pointer"
                        >
                          Sesuaikan Stok
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {loading ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-400">Memuat data…</td></tr>
                ) : filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-slate-500">
                      Tidak ada stok bahan baku yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <Pagination 
          currentPage={inventoryPage} 
          totalItems={filteredInventory.length} 
          itemsPerPage={ITEMS_PER_PAGE} 
          onPageChange={setInventoryPage} 
        />
      </div>

      {/* Right Panel: Master Materials Management */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl h-fit space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Master Bahan Baku</h3>
            <p className="text-[10px] text-slate-600">Daftar global bahan baku perusahaan.</p>
          </div>
          <button
            onClick={openAddMaterial}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all shadow-md cursor-pointer"
          >
            Tambah Bahan
          </button>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Cari bahan..."
            value={materialsSearch}
            onChange={(e) => {
              setMaterialsSearch(e.target.value);
              setMaterialsPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500"
          />
        </div>

        <div className="space-y-2.5 pr-1">
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {paginatedCatalog.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50/40 border border-slate-100/80 rounded-xl font-bold">
                <div>
                  <p className="text-xs text-slate-800">{m.name}</p>
                  <p className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">Satuan: {m.unit}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditMaterial(m)}
                    className="p-1.5 text-slate-600 hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(m.id)}
                    className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {filteredCatalog.length === 0 && (
              <p className="text-center text-xs text-slate-500 py-6">Tidak ada master bahan baku yang cocok.</p>
            )}
          </div>
          <Pagination 
            currentPage={materialsPage} 
            totalItems={filteredCatalog.length} 
            itemsPerPage={ITEMS_PER_PAGE} 
            onPageChange={setMaterialsPage} 
          />
        </div>
      </div>

      {/* MATERIAL MODAL (ADD / EDIT) */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingMaterial ? 'Ubah Master Bahan Baku' : 'Tambah Master Bahan Baku'}
              </h3>
              <button 
                onClick={() => setShowMaterialModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveMaterial} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Nama Bahan Baku</label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: Biji Kopi Gayo, Susu UHT"
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Satuan Ukur</label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: gram, ml, pcs, bag"
                  value={materialForm.unit}
                  onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowMaterialModal(false)}
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

      {/* STOCK ADJUST MODAL */}
      {showStockModal && selectedStockMaterial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Sesuaikan Stok</h3>
                <p className="text-[10px] text-slate-500">Bahan: <span className="text-sky-400 font-bold">{selectedStockMaterial.name}</span> ({selectedStockMaterial.unit})</p>
              </div>
              <button 
                onClick={() => setShowStockModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Tipe Penyesuaian</label>
                <select 
                  value={stockForm.type}
                  onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="add">Tambah Stok (+)</option>
                  <option value="subtract">Kurangi Stok (-)</option>
                  <option value="set">Setel Stok (Opname)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Kuantitas / Jumlah ({selectedStockMaterial.unit})</label>
                <input 
                  type="number" 
                  required
                  placeholder="Kuantitas penyesuaian"
                  value={stockForm.qty}
                  onChange={(e) => setStockForm({ ...stockForm, qty: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Catatan Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembelian baru, Expired, dll."
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">
                  Batas Stok Minimum ({selectedStockMaterial.unit}) — Notifikasi Telegram
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Contoh: 500 (kosongkan jika tidak ingin notifikasi)"
                  value={stockForm.stockMin}
                  onChange={(e) => setStockForm({ ...stockForm, stockMin: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Staf yang mengaktifkan notifikasi stok (di halaman Kasir & Staf) akan diberi tahu lewat Telegram saat stok bahan ini turun ke batas ini atau di bawahnya.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border border-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <SpinnerButton
                  type="submit"
                  loading={saving}
                  loadingText="Menerapkan…"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Terapkan
                </SpinnerButton>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
