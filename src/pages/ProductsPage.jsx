import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Coffee, 
  Layers, 
  ShoppingBag, 
  LayoutGrid, 
  List, 
  Tag, 
  Sparkles,
  TrendingUp,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { getProducts, createProduct, updateProduct, deleteProduct, getMaterials } from '../lib/api';
import { formatRupiah, formatNumber, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ProductModal } from '../components/modals/ProductModal';
import Pagination from '../components/Pagination';

export default function ProductsPage({ activeBranchId, setActionError, setSuccessMessage, confirmAction }) {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [productsSearch, setProductsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [productsPage, setProductsPage] = useState(1);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ITEMS_PER_PAGE = 12;

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsData, matsData] = await Promise.all([
        getProducts().catch(() => []),
        getMaterials().catch(() => [])
      ]);
      setProducts(Array.isArray(prodsData) ? prodsData : []);
      setMaterials(Array.isArray(matsData) ? matsData : []);
    } catch (err) {
      setActionError('Gagal memuat data produk: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranchId]);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchSearch = (
      (p.name || '').toLowerCase().includes(productsSearch.toLowerCase()) ||
      (p.id || '').toLowerCase().includes(productsSearch.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(productsSearch.toLowerCase()) ||
      (p.tag || '').toLowerCase().includes(productsSearch.toLowerCase())
    );
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const startIndex = (productsPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const openAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const openEditProduct = (prod) => {
    setEditingProduct(prod);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (payload) => {
    setSaving(true);
    setActionError('');
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        setSuccessMessage('Menu berhasil diperbarui.');
      } else {
        await createProduct(payload);
        setSuccessMessage('Menu baru berhasil ditambahkan.');
      }
      setShowProductModal(false);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Gagal menyimpan menu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!(await confirmAction(`Apakah Anda yakin ingin menghapus menu "${name}"?`, { title: 'Hapus Menu', confirmText: 'Ya, hapus' }))) return;
    setActionError('');
    try {
      await deleteProduct(id);
      setSuccessMessage('Menu berhasil dihapus.');
      loadData();
    } catch (err) {
      setActionError(err.message || 'Gagal menghapus menu.');
    }
  };

  // Metrics summary
  const totalItems = products.length;
  const avgPrice = totalItems > 0 ? Math.round(products.reduce((acc, p) => acc + (Number(p.price) || 0), 0) / totalItems) : 0;
  const withHppCount = products.filter(p => p.costPrice != null || (Array.isArray(p.materials) && p.materials.length > 0)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Katalog Menu & Produk
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kelola daftar menu jual, harga, varian, dan keterhubungan resep bahan baku ke kasir.
          </p>
        </div>

        <Button onClick={openAddProduct} className="shadow-md">
          <Plus className="h-4 w-4" />
          <span>Tambah Menu Baru</span>
        </Button>
      </div>

      {/* Mini Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Total Menu Terdaftar</span>
            <ShoppingBag className="h-4 w-4 text-[var(--color-brand-600)]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {totalItems} <span className="text-xs font-normal text-[var(--color-slate-muted)]">item</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Rata-Rata Harga Jual</span>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {formatRupiah(avgPrice)}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-white to-[var(--color-brand-50)]/40 border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-slate-muted)]">Menu Terhubung Resep/HPP</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-ink)]">
            {withHppCount} / {totalItems} <span className="text-xs font-normal text-[var(--color-slate-muted)]">menu</span>
          </div>
        </Card>
      </div>

      {/* Filter & View Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-slate-muted)] pointer-events-none" />
            <Input
              placeholder="Cari nama menu, tag, SKU, atau kategori..."
              value={productsSearch}
              onChange={(e) => {
                setProductsSearch(e.target.value);
                setProductsPage(1);
              }}
              className="pl-10 h-9.5 text-xs"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-[var(--color-snow)] p-1 border border-[var(--color-hairline)]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  viewMode === 'grid'
                    ? 'bg-white text-[var(--color-brand-800)] shadow-2xs'
                    : 'text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  viewMode === 'table'
                    ? 'bg-white text-[var(--color-brand-800)] shadow-2xs'
                    : 'text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                <List className="h-3.5 w-3.5" />
                <span>Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scroll-slim">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setProductsPage(1);
              }}
              className={cn(
                'whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors shrink-0',
                selectedCategory === cat
                  ? 'bg-[var(--color-brand-600)] text-white shadow-xs'
                  : 'bg-[var(--color-snow)] text-[var(--color-slate-body)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-800)] border border-[var(--color-hairline)]'
              )}
            >
              {cat === 'all' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Catalog Display */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
          Memuat katalog menu dari database...
        </div>
      ) : paginatedProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)] mb-3">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-ink)]">Tidak ada menu ditemukan</h3>
          <p className="text-xs text-[var(--color-slate-muted)] mt-1 max-w-sm mx-auto">
            {productsSearch ? `Tidak ada menu yang sesuai dengan pencarian "${productsSearch}".` : 'Mulai tambahkan menu pertama Anda agar kasir dapat memulai transaksi.'}
          </p>
          {!productsSearch && (
            <Button onClick={openAddProduct} size="sm" className="mt-4">
              <Plus className="h-4 w-4" />
              <span>Tambah Menu Sekarang</span>
            </Button>
          )}
        </Card>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedProducts.map((p) => {
            const priceNum = Number(p.price) || 0;
            const costPriceNum = p.costPrice != null ? Number(p.costPrice) : null;
            const marginAmt = costPriceNum != null ? priceNum - costPriceNum : null;
            const marginPct = marginAmt != null && priceNum > 0 ? Math.round((marginAmt / priceNum) * 100) : null;

            return (
              <Card
                key={p.id}
                className="overflow-hidden group flex flex-col justify-between hover:border-[var(--color-brand-300)] hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Image banner / placeholder */}
                  <div className="relative h-36 w-full bg-gradient-to-br from-[var(--color-brand-50)] to-slate-100 overflow-hidden flex items-center justify-center">
                    {p.imageUrl || p.image_url ? (
                      <img
                        src={p.imageUrl || p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Coffee className="h-10 w-10 text-[var(--color-brand-300)]" />
                    )}

                    {/* Tag badge */}
                    {p.tag && (
                      <div className="absolute top-2.5 left-2.5">
                        <Badge variant="coral" className="text-[10px] shadow-xs">
                          {p.tag}
                        </Badge>
                      </div>
                    )}

                    {/* Category badge */}
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white">
                        {p.category}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-sm text-[var(--color-ink)] leading-snug truncate" title={p.name}>
                      {p.name}
                    </h3>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="text-base font-black text-[var(--color-brand-700)]">
                        {formatRupiah(priceNum)}
                      </div>

                      {marginPct != null && (
                        <Badge variant={marginPct >= 50 ? 'success' : marginPct >= 20 ? 'brand' : 'warning'} className="text-[10px] px-1.5">
                          Margin {marginPct}%
                        </Badge>
                      )}
                    </div>

                    {/* HPP Detail */}
                    <div className="text-[11px] text-[var(--color-slate-muted)] flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]">
                      <span>HPP Pokok:</span>
                      <span className="font-medium text-[var(--color-slate-body)]">
                        {costPriceNum != null ? formatRupiah(costPriceNum) : 'Belum diisi'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 border-t border-[var(--color-hairline)] bg-[var(--color-snow)] flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditProduct(p)}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Sunting</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(p.id, p.name)}
                    className="h-8 w-8 flex items-center justify-center rounded-xl text-[var(--color-slate-muted)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-6 py-3.5">Menu Produk</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5">Tag</th>
                  <th className="px-4 py-3.5 text-right">Harga Jual</th>
                  <th className="px-4 py-3.5 text-right">HPP (Modal)</th>
                  <th className="px-4 py-3.5 text-center">Margin</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {paginatedProducts.map((p) => {
                  const priceNum = Number(p.price) || 0;
                  const costPriceNum = p.costPrice != null ? Number(p.costPrice) : null;
                  const marginAmt = costPriceNum != null ? priceNum - costPriceNum : null;
                  const marginPct = marginAmt != null && priceNum > 0 ? Math.round((marginAmt / priceNum) * 100) : null;

                  return (
                    <tr key={p.id} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-[var(--color-ink)] flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[var(--color-brand-50)] border border-[var(--color-hairline)] overflow-hidden shrink-0 flex items-center justify-center">
                          {p.imageUrl || p.image_url ? (
                            <img src={p.imageUrl || p.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Coffee className="h-4 w-4 text-[var(--color-brand-400)]" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[var(--color-ink)]">{p.name}</div>
                          <div className="text-[10px] text-[var(--color-slate-muted)] font-mono">{p.id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="secondary">{p.category}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {p.tag ? <Badge variant="coral">{p.tag}</Badge> : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-[var(--color-ink)]">
                        {formatRupiah(priceNum)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-rose-600">
                        {costPriceNum != null ? formatRupiah(costPriceNum) : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {marginPct != null ? (
                          <Badge variant={marginPct >= 50 ? 'success' : marginPct >= 20 ? 'brand' : 'warning'}>
                            {marginPct}%
                          </Badge>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openEditProduct(p)} className="h-7 px-2 text-xs">
                            <Edit3 className="h-3 w-3" />
                            <span>Sunting</span>
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
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
        </Card>
      )}

      {/* Pagination */}
      {filteredProducts.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={productsPage}
            totalItems={filteredProducts.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setProductsPage}
          />
        </div>
      )}

      {/* Product Edit / Create Modal */}
      <ProductModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        product={editingProduct}
        materials={materials}
        onSave={handleSaveProduct}
        saving={saving}
      />
    </div>
  );
}
