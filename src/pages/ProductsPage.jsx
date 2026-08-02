import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Coffee, Layers, ShoppingBasket } from 'lucide-react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../lib/api';
import Pagination from '../components/Pagination';
import SpinnerButton from '../components/SpinnerButton';

export default function ProductsPage({ activeBranchId, setActionError, setSuccessMessage, confirmAction }) {
  const [products, setProducts] = useState([]);
  const [productsSearch, setProductsSearch] = useState('');
  const [productsPage, setProductsPage] = useState(1);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    price: '',
    costPrice: '',
    category: 'Kopi',
    tag: '',
    imageUrl: '',
    discountPrice: ''
  });

  const ITEMS_PER_PAGE = 10;

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError('Gagal memuat produk: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [activeBranchId]);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      id: '',
      name: '',
      price: '',
      costPrice: '',
      category: 'Kopi',
      tag: '',
      imageUrl: '',
      discountPrice: ''
    });
    setShowProductModal(true);
  };

  const openEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      id: prod.id,
      name: prod.name,
      price: prod.price || '',
      costPrice: prod.costPrice || '',
      category: prod.category || 'Kopi',
      tag: prod.tag || '',
      imageUrl: prod.imageUrl || '',
      discountPrice: prod.discountPrice || ''
    });
    setShowProductModal(true);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setActionError('');
    setSaving(true);
    try {
      const payload = {
        id: productForm.id || `item-${Date.now()}`,
        name: productForm.name,
        price: Number(productForm.price),
        costPrice: productForm.costPrice !== '' ? Number(productForm.costPrice) : null,
        category: productForm.category,
        tag: productForm.tag || null,
        imageUrl: productForm.imageUrl || null,
        discountPrice: productForm.discountPrice !== '' ? Number(productForm.discountPrice) : null
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        setSuccessMessage('Produk berhasil diperbarui.');
      } else {
        await createProduct(payload);
        setSuccessMessage('Produk baru berhasil ditambahkan.');
      }
      setShowProductModal(false);
      loadProducts();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!(await confirmAction('Apakah Anda yakin ingin menghapus/mengarsipkan menu ini?', { title: 'Arsipkan Menu', confirmText: 'Ya, arsipkan' }))) return;
    setActionError('');
    try {
      await deleteProduct(id);
      setSuccessMessage('Produk diarsipkan.');
      loadProducts();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productsSearch.toLowerCase()) ||
    p.id.toLowerCase().includes(productsSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productsSearch.toLowerCase())
  );

  const startIndex = (productsPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Product List */}
      <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Daftar Menu Outlet</h3>
            <p className="text-xs text-slate-600">Kelola katalog produk, harga, dan ketersediaan menu di kasir.</p>
          </div>
          <button 
            onClick={openAddProduct}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-sky-500/10 cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Menu</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Cari nama menu atau kategori..."
              value={productsSearch}
              onChange={(e) => {
                setProductsSearch(e.target.value);
                setProductsPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="p-4">ID/Kode</th>
                <th className="p-4">Nama Menu</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">HPP (Cost)</th>
                <th className="p-4">Harga Jual</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-slate-50/20">
              {paginatedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-100/30 text-slate-800">
                  <td className="p-4 font-mono text-slate-600">{p.id}</td>
                  <td className="p-4 font-bold flex items-center gap-2">
                    <Coffee size={14} className="text-sky-400 shrink-0" />
                    <span className="truncate max-w-[150px]">{p.name}</span>
                  </td>
                  <td className="p-4 capitalize">{p.category}</td>
                  <td className="p-4">Rp {p.costPrice ? Number(p.costPrice).toLocaleString('id-ID') : '0'}</td>
                  <td className="p-4 font-bold text-sky-400">Rp {p.price.toLocaleString('id-ID')}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3">
                      <button 
                        onClick={() => openEditProduct(p)} 
                        className="text-slate-600 hover:text-sky-400 transition-colors cursor-pointer"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(p.id)} 
                        className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Memuat data…</td></tr>
              ) : filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    Tidak ada menu produk yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={productsPage} 
          totalItems={filteredProducts.length} 
          itemsPerPage={ITEMS_PER_PAGE} 
          onPageChange={setProductsPage} 
        />
      </div>

      {/* Product Info Board */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl h-fit space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Ketentuan Katalog Menu</h3>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-4 bg-slate-50/40 border border-slate-100 rounded-xl space-y-2">
            <p className="font-bold text-slate-900 flex items-center gap-1.5 text-sky-400">
              <Layers size={14} />
              <span>Struktur Lisensi Menu</span>
            </p>
            <p>Jumlah menu item yang dapat didaftarkan terikat pada batas paket langganan Anda:</p>
            <ul className="list-disc pl-4 space-y-1 mt-1 font-mono text-[10px]">
              <li>Free Plan: Maks 20 menu</li>
              <li>Standard Plan: Maks 100 menu</li>
              <li>Premium Plan: Tanpa batas</li>
            </ul>
          </div>
          
          <div className="p-4 bg-slate-50/40 border border-slate-100 rounded-xl space-y-2">
            <p className="font-bold text-slate-900 flex items-center gap-1.5 text-purple-400">
              <ShoppingBasket size={14} />
              <span>HPP & Margin Keuntungan</span>
            </p>
            <p>Mengisi Harga Pokok Penjualan (HPP) sangat disarankan untuk menghasilkan analisis laba-rugi bersih yang akurat pada laporan keuangan merchant.</p>
          </div>
        </div>
      </div>

      {/* PRODUCT MODAL (ADD / EDIT) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingProduct ? 'Ubah Rincian Menu' : 'Tambah Produk Baru'}
              </h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveProduct} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Kode / ID Produk</label>
                <input 
                  type="text" 
                  required
                  disabled={!!editingProduct}
                  placeholder="Contoh: cf-kopi-susu"
                  value={productForm.id}
                  onChange={(e) => setProductForm({ ...productForm, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 disabled:opacity-50 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Nama Menu</label>
                <input 
                  type="text" 
                  required
                  placeholder="Nama Minuman / Makanan"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">HPP / Cost Price (Rupiah)</label>
                  <input 
                    type="number" 
                    placeholder="Harga beli / Modal"
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Harga Jual (Rupiah)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Harga Jual Retail"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Kategori</label>
                  <select 
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Kopi">Kopi</option>
                    <option value="Non Kopi">Non Kopi</option>
                    <option value="Pastry">Pastry</option>
                    <option value="Cake">Cake</option>
                    <option value="Sandwich">Sandwich</option>
                    <option value="Manual Brew">Manual Brew</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Tag Menu (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Signature / Favorit"
                    value={productForm.tag}
                    onChange={(e) => setProductForm({ ...productForm, tag: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Image URL (URL Gambar Menu)</label>
                <input 
                  type="text" 
                  placeholder="https://images.unsplash.com/..."
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowProductModal(false)}
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
                  Simpan Perubahan
                </SpinnerButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
