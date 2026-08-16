import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  Image as ImageIcon, 
  DollarSign, 
  Layers, 
  Plus, 
  Trash2, 
  AlertCircle,
  Percent,
  Check
} from 'lucide-react';
import { cn, formatRupiah } from '../../lib/utils';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';

const DEFAULT_CATEGORIES = ['Kopi', 'Non Kopi', 'Makanan', 'Snack', 'Pastry', 'Dessert', 'Minuman Dingin', 'Lainnya'];

export function ProductModal({
  open,
  onClose,
  product = null,
  materials = [],
  onSave,
  saving = false,
}) {
  const [activeSubTab, setActiveSubTab] = useState('info'); // 'info' | 'pricing' | 'recipe'

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kopi');
  const [customCategory, setCustomCategory] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [tag, setTag] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [productType, setProductType] = useState('recipe');
  const [unitLabel, setUnitLabel] = useState('porsi');

  // Recipe Lines State: array of { materialId, qty }
  const [recipeLines, setRecipeLines] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setActiveSubTab('info');
      if (product) {
        setName(product.name || '');
        const cat = product.category || 'Kopi';
        if (DEFAULT_CATEGORIES.includes(cat)) {
          setCategory(cat);
          setCustomCategory('');
        } else {
          setCategory('Lainnya');
          setCustomCategory(cat);
        }
        setPrice(product.price != null ? String(product.price) : '');
        setCostPrice(product.costPrice != null ? String(product.costPrice) : '');
        setTag(product.tag || '');
        setImageUrl(product.imageUrl || product.image_url || '');
        setDiscountPrice(product.discountPrice != null ? String(product.discountPrice) : '');
        setProductType(product.product_type || 'recipe');
        setUnitLabel(product.unit_label || 'porsi');

        // Parse existing recipe/materials if available
        if (Array.isArray(product.materials)) {
          setRecipeLines(product.materials.map(m => ({
            materialId: m.material_id || m.materialId || m.id,
            qty: m.qty != null ? String(m.qty) : '1'
          })));
        } else {
          setRecipeLines([]);
        }
      } else {
        setName('');
        setCategory('Kopi');
        setCustomCategory('');
        setPrice('');
        setCostPrice('');
        setTag('');
        setImageUrl('');
        setDiscountPrice('');
        setProductType('recipe');
        setUnitLabel('porsi');
        setRecipeLines([]);
      }
    }
  }, [open, product]);

  // Kalkulasi estimasi HPP otomatis dari bahan baku
  const calculatedRecipeCost = recipeLines.reduce((sum, line) => {
    const mat = materials.find(m => String(m.id) === String(line.materialId));
    if (!mat) return sum;
    const q = Number(line.qty) || 0;
    const p = Number(mat.price) || 0;
    return sum + (q * p);
  }, 0);

  // Gunakan HPP bahan bila ada resep, jika tidak gunakan costPrice manual
  const effectiveCostPrice = recipeLines.length > 0 ? calculatedRecipeCost : (Number(costPrice) || 0);
  const priceNum = Number(price) || 0;
  const marginAmt = priceNum - effectiveCostPrice;
  const marginPct = priceNum > 0 ? Math.round((marginAmt / priceNum) * 100) : 0;

  const handleAddRecipeLine = () => {
    if (materials.length === 0) return;
    setRecipeLines(prev => [...prev, { materialId: materials[0]?.id || '', qty: '1' }]);
  };

  const handleRemoveRecipeLine = (idx) => {
    setRecipeLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRecipeChange = (idx, field, value) => {
    setRecipeLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim();
    if (!finalName) {
      setError('Nama menu wajib diisi.');
      setActiveSubTab('info');
      return;
    }

    const finalPrice = Number(price);
    if (isNaN(finalPrice) || finalPrice < 0) {
      setError('Harga jual tidak valid.');
      setActiveSubTab('pricing');
      return;
    }

    const finalCat = category === 'Lainnya' && customCategory.trim() 
      ? customCategory.trim() 
      : category;

    const payload = {
      id: product?.id || `item-${Date.now()}`,
      name: finalName,
      price: finalPrice,
      costPrice: effectiveCostPrice > 0 ? effectiveCostPrice : null,
      category: finalCat,
      tag: tag.trim() || null,
      imageUrl: imageUrl.trim() || null,
      discountPrice: discountPrice ? Number(discountPrice) : null,
      product_type: productType,
      unit_label: unitLabel || 'porsi',
      materials: recipeLines.map(r => ({
        material_id: r.materialId,
        qty: Number(r.qty) || 1
      }))
    };

    onSave(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-2xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>{product ? 'Sunting Menu Produk' : 'Tambah Menu Baru'}</DialogTitle>
            <DialogDescription>
              {product ? 'Perbarui informasi harga, resep bahan, dan katalog menu.' : 'Lengkapi informasi menu untuk langsung tersedia di kasir.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Sub Tab Navigation */}
      <div className="flex border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 pt-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('info')}
          className={cn(
            'border-b-2 px-4 py-2.5 text-xs font-bold transition-colors',
            activeSubTab === 'info'
              ? 'border-[var(--color-brand-600)] text-[var(--color-brand-800)]'
              : 'border-transparent text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
          )}
        >
          1. Info Dasar & Kategori
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pricing')}
          className={cn(
            'border-b-2 px-4 py-2.5 text-xs font-bold transition-colors',
            activeSubTab === 'pricing'
              ? 'border-[var(--color-brand-600)] text-[var(--color-brand-800)]'
              : 'border-transparent text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
          )}
        >
          2. Harga & Profit Margin
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('recipe')}
          className={cn(
            'border-b-2 px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5',
            activeSubTab === 'recipe'
              ? 'border-[var(--color-brand-600)] text-[var(--color-brand-800)]'
              : 'border-transparent text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]'
          )}
        >
          <span>3. Resep HPP (Bahan)</span>
          {recipeLines.length > 0 && (
            <Badge variant="brand" className="text-[9px] px-1 py-0">{recipeLines.length}</Badge>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4 pt-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: INFO DASAR */}
          {activeSubTab === 'info' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                  Nama Menu Produk <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="Contoh: Kopi Susu Aren Signature"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                    Kategori Menu
                  </label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  {category === 'Lainnya' && (
                    <Input
                      placeholder="Ketik kategori baru..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                    Label / Tag Promo (Opsional)
                  </label>
                  <Input
                    placeholder="Contoh: Favorit, Best Seller, New"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                  URL Gambar Foto Produk
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1"
                  />
                  {imageUrl && (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-snow)]">
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HARGA & MARGIN */}
          {activeSubTab === 'pricing' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                    Harga Jual Normal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 28000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                    HPP Pokok / Modal Menu (Rp)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder={recipeLines.length > 0 ? String(calculatedRecipeCost) : "Contoh: 12000"}
                    value={recipeLines.length > 0 ? String(calculatedRecipeCost) : costPrice}
                    disabled={recipeLines.length > 0}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                  {recipeLines.length > 0 && (
                    <span className="text-[10px] text-[var(--color-brand-600)] mt-1 block">
                      * Dihitung otomatis dari resep bahan baku
                    </span>
                  )}
                </div>
              </div>

              {/* Profit Margin Preview Box */}
              <div className="rounded-2xl border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-brand-50)] to-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-slate-muted)]">Kalkulasi Keuntungan per Porsi</span>
                  <Badge variant={marginAmt >= 0 ? 'success' : 'danger'} className="text-xs">
                    Margin {marginPct}%
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2.5 border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-slate-muted)] block">Harga Jual</span>
                    <span className="font-bold text-xs text-[var(--color-ink)]">{formatRupiah(priceNum)}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-slate-muted)] block">HPP Bahan</span>
                    <span className="font-bold text-xs text-rose-600">{formatRupiah(effectiveCostPrice)}</span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-slate-muted)] block">Laba Kotor</span>
                    <span className={cn('font-bold text-xs', marginAmt >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                      {formatRupiah(marginAmt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESEP BAHAN BAKU HPP */}
          {activeSubTab === 'recipe' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--color-ink)]">Komposisi Resep Bahan Baku</h4>
                  <p className="text-[11px] text-[var(--color-slate-muted)]">
                    Stok bahan baku akan otomatis berkurang di kasir setiap menu ini terjual.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddRecipeLine}
                  disabled={materials.length === 0}
                  className="text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Bahan</span>
                </Button>
              </div>

              {materials.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-hairline)] p-6 text-center text-xs text-[var(--color-slate-muted)]">
                  Belum ada master data bahan baku. Silakan tambahkan bahan baku di menu <b>Bahan & Resep HPP</b> terlebih dahulu.
                </div>
              ) : recipeLines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-hairline)] p-6 text-center text-xs text-[var(--color-slate-muted)]">
                  Menu ini belum ditautkan ke resep bahan baku. Klik <b>Tambah Bahan</b> di atas.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {recipeLines.map((line, idx) => {
                    const selectedMat = materials.find(m => String(m.id) === String(line.materialId));

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-snow)] p-2.5"
                      >
                        <div className="flex-1">
                          <Select
                            value={line.materialId}
                            onChange={(e) => handleRecipeChange(idx, 'materialId', e.target.value)}
                            className="h-9 text-xs"
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({formatRupiah(m.price || 0)}/{m.unit || 'satuan'})
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="w-28 flex items-center gap-1">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="Qty"
                            value={line.qty}
                            onChange={(e) => handleRecipeChange(idx, 'qty', e.target.value)}
                            className="h-9 text-xs"
                          />
                          <span className="text-[10px] text-[var(--color-slate-muted)] font-semibold shrink-0">
                            {selectedMat?.unit || 'unit'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRecipeLine(idx)}
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : product ? 'Simpan Perubahan' : 'Buat Menu Baru'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
