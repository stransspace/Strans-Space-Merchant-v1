import React, { useState, useEffect, useMemo } from 'react';
import { 
  Boxes, 
  Factory, 
  Truck, 
  Package, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search
} from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';

const CENTRAL_KITCHEN_SUB_TABS = ['stocks', 'batches', 'requests'];

export default function CentralKitchenPage({ setSuccessMessage, setActionError, initialSubTab }) {
  const [activeTab, setActiveTab] = useState('stocks'); // 'stocks' | 'batches' | 'requests'

  // Deep-link dari GlobalSearch (Cmd+K), mis. "central-kitchen:requests".
  useEffect(() => {
    if (initialSubTab && CENTRAL_KITCHEN_SUB_TABS.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Central Warehouse Stocks
  const [stocks, setStocks] = useState([
    {
      id: 'cs-1',
      sku: 'RAW-ARABICA-50KG',
      name: 'Green Beans Arabica Gayo Grade 1',
      category: 'Bahan Mentah',
      stock: 120,
      unit: 'kg',
      minStock: 30,
      costPerUnit: 95000,
      supplier: 'Koperasi Petani Gayo',
      status: 'aman'
    },
    {
      id: 'cs-2',
      sku: 'RAW-ROBUSTA-50KG',
      name: 'Green Beans Robusta Temanggung',
      category: 'Bahan Mentah',
      stock: 80,
      unit: 'kg',
      minStock: 20,
      costPerUnit: 65000,
      supplier: 'Sentra Kopi Jawa',
      status: 'aman'
    },
    {
      id: 'cs-3',
      sku: 'PROD-SYRUP-CARAMEL',
      name: 'Sirup Salted Caramel Racikan Pusat',
      category: 'Hasil Racikan',
      stock: 45,
      unit: 'Liter',
      minStock: 15,
      costPerUnit: 42000,
      supplier: 'Dapur Pusat Strans',
      status: 'aman'
    },
    {
      id: 'cs-4',
      sku: 'PKG-CUP-16OZ',
      name: 'Paper Cup Hot & Cold 16oz (Dus 1000pcs)',
      category: 'Kemasan',
      stock: 15,
      unit: 'Dus',
      minStock: 5,
      costPerUnit: 480000,
      supplier: 'Pabrik Kemasan Indo',
      status: 'aman'
    },
    {
      id: 'cs-5',
      sku: 'RAW-SUGAR-ORGANIC',
      name: 'Gula Kelapa Organik Murni',
      category: 'Bahan Mentah',
      stock: 25,
      unit: 'kg',
      minStock: 30,
      costPerUnit: 28000,
      supplier: 'Suplier Gula Purwokerto',
      status: 'menipis'
    }
  ]);

  // Production Batches
  const [batches, setBatches] = useState([
    {
      id: 'b-1',
      batchNumber: 'BATCH-2026-0814',
      productName: 'Signature Espresso Blend Roast 1kg',
      quantityProduced: 50,
      unit: 'Pack',
      date: '14 Agu 2026',
      chefSupervisor: 'Head Roaster - Bagus',
      status: 'Selesai'
    },
    {
      id: 'b-2',
      batchNumber: 'BATCH-2026-0815',
      productName: 'Sirup Salted Caramel Racikan Pusat 5L',
      quantityProduced: 20,
      unit: 'Jerigen',
      date: '15 Agu 2026',
      chefSupervisor: 'Chef Kitchen - Rahmat',
      status: 'Selesai'
    },
    {
      id: 'b-3',
      batchNumber: 'BATCH-2026-0816',
      productName: 'Matcha Premix Uji Kyoto 500g',
      quantityProduced: 30,
      unit: 'Pouch',
      date: 'Hari ini, 09.00',
      chefSupervisor: 'QC Staff - Anita',
      status: 'Sedang Proses'
    }
  ]);

  // Branch Restock Transfer Requests
  const [requests, setRequests] = useState([
    {
      id: 'req-1',
      requestNumber: 'REQ-OUTLET-0816',
      branchName: 'Kopi Cisauk (Tangerang)',
      itemsList: 'Green Beans Arabica 10kg, Sirup Caramel 5L, Cup 16oz 2 Dus',
      requestedAt: 'Hari ini, 10.30',
      status: 'Menunggu Approval',
      trackingNumber: null
    },
    {
      id: 'req-2',
      requestNumber: 'REQ-OUTLET-0815',
      branchName: 'Kopi Bandung (Dago)',
      itemsList: 'Signature Blend Roast 15kg, Cup 16oz 3 Dus',
      requestedAt: '15 Agu 2026, 14.15',
      status: 'Dalam Pengiriman',
      trackingNumber: 'STRANS-LOG-4892'
    },
    {
      id: 'req-3',
      requestNumber: 'REQ-OUTLET-0812',
      branchName: 'Kopi Cisauk (Tangerang)',
      itemsList: 'Susu Fresh Milk 30L, Sirup Vanilla 4L',
      requestedAt: '12 Agu 2026, 09.00',
      status: 'Selesai Diterima',
      trackingNumber: 'STRANS-LOG-3108'
    }
  ]);

  // Form modals
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [newStockCategory, setNewStockCategory] = useState('Bahan Mentah');
  const [newStockQty, setNewStockQty] = useState('50');
  const [newStockUnit, setNewStockUnit] = useState('kg');
  const [newStockCost, setNewStockCost] = useState('85000');
  const [newStockSupplier, setNewStockSupplier] = useState('Suplier Pusat');

  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [newBatchProduct, setNewBatchProduct] = useState('');
  const [newBatchQty, setNewBatchQty] = useState('20');
  const [newBatchUnit, setNewBatchUnit] = useState('kg');
  const [newBatchSupervisor, setNewBatchSupervisor] = useState('Head Roaster');

  const totalValuation = useMemo(() => {
    return stocks.reduce((acc, item) => acc + (item.stock * item.costPerUnit), 0);
  }, [stocks]);

  const handleAddStock = (e) => {
    e.preventDefault();
    if (!newStockName.trim()) return;

    const newItem = {
      id: `cs-${Date.now()}`,
      sku: `RAW-${Date.now().toString(36).toUpperCase()}`,
      name: newStockName,
      category: newStockCategory,
      stock: Number(newStockQty) || 0,
      unit: newStockUnit,
      minStock: 10,
      costPerUnit: Number(newStockCost) || 0,
      supplier: newStockSupplier,
      status: 'aman'
    };

    setStocks([newItem, ...stocks]);
    setAddStockOpen(false);
    setNewStockName('');
    setSuccessMessage?.(`Bahan "${newItem.name}" berhasil ditambahkan ke Gudang Pusat.`);
  };

  const handleAddBatch = (e) => {
    e.preventDefault();
    if (!newBatchProduct.trim()) return;

    const newBatch = {
      id: `b-${Date.now()}`,
      batchNumber: `BATCH-2026-${Date.now().toString().slice(-4)}`,
      productName: newBatchProduct,
      quantityProduced: Number(newBatchQty) || 0,
      unit: newBatchUnit,
      date: 'Hari ini',
      chefSupervisor: newBatchSupervisor,
      status: 'Selesai'
    };

    setBatches([newBatch, ...batches]);
    setAddBatchOpen(false);
    setNewBatchProduct('');
    setSuccessMessage?.(`Batch produksi "${newBatch.batchNumber}" berhasil dicatat.`);
  };

  const handleApproveRequest = (reqId) => {
    const resi = `STRANS-LOG-${Math.floor(1000 + Math.random() * 9000)}`;
    setRequests(prev => prev.map(r => r.id === reqId ? {
      ...r,
      status: 'Dalam Pengiriman',
      trackingNumber: resi
    } : r));
    setSuccessMessage?.(`Permintaan restock disetujui! Resi logistik internal: ${resi}`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Gudang Pusat &amp; Central Kitchen
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Pusat pengadaan bahan baku mentah skala besar, peracikan batch produksi, dan distribusi antar cabang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="brand" className="gap-1.5 py-1.5 px-3 bg-violet-50 text-violet-700 border border-violet-200 shadow-2xs font-bold text-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Fitur Eksklusif Juragan Space</span>
          </Badge>
        </div>
      </div>

      {/* 2. 4 KPI Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
              Nilai Aset Gudang Pusat
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-heading text-xl font-black text-[var(--color-ink)]">
            {formatRupiah(totalValuation)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-slate-muted)]">
            {stocks.length} SKU Bahan Baku Master
          </p>
        </Card>

        {/* Card 2 */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
              Batch Produksi Bulan Ini
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
              <Factory className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-heading text-xl font-black text-[var(--color-ink)]">
            {batches.length} Batch Selesai
          </p>
          <p className="mt-0.5 text-xs text-emerald-600 font-bold">
            ✓ Standar QC 100% Lulus
          </p>
        </Card>

        {/* Card 3 */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
              Permintaan Restock Cabang
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-heading text-xl font-black text-[var(--color-ink)]">
            {requests.filter(r => r.status === 'Menunggu Approval').length} Antrean
          </p>
          <p className="mt-0.5 text-xs text-amber-600 font-bold">
            Butuh Persetujuan Pengiriman
          </p>
        </Card>

        {/* Card 4 */}
        <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
              Efisiensi Pemenuhan Cabang
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-heading text-xl font-black text-[var(--color-ink)]">
            98.8%
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-slate-muted)]">
            Rata-rata kirim &lt; 24 Jam
          </p>
        </Card>
      </div>

      {/* 3. Internal Navigation Sub-tabs */}
      <div className="flex gap-2 border-b border-[var(--color-hairline)] pb-2 overflow-x-auto scroll-slim">
        <Button
          variant={activeTab === 'stocks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('stocks')}
          className="gap-1.5 text-xs font-bold rounded-xl cursor-pointer"
        >
          <Boxes className="h-3.5 w-3.5" />
          <span>Stok Bahan Mentah Pusat ({stocks.length})</span>
        </Button>

        <Button
          variant={activeTab === 'batches' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('batches')}
          className="gap-1.5 text-xs font-bold rounded-xl cursor-pointer"
        >
          <Factory className="h-3.5 w-3.5" />
          <span>Log Batch Produksi ({batches.length})</span>
        </Button>

        <Button
          variant={activeTab === 'requests' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('requests')}
          className="gap-1.5 text-xs font-bold rounded-xl cursor-pointer"
        >
          <Truck className="h-3.5 w-3.5" />
          <span>Permintaan Restock Cabang ({requests.length})</span>
        </Button>
      </div>

      {/* TAB 1: STOK BAHAN MENTAH PUSAT */}
      {activeTab === 'stocks' && (
        <Card className="bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardHeader className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-hairline)]">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Daftar Bahan Baku di Gudang Pusat
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                Bahan mentah master yang siap didistribusikan atau diolah menjadi bahan jadi cabang
              </CardDescription>
            </div>

            <Button
              onClick={() => setAddStockOpen(true)}
              className="h-8.5 text-xs gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Stok Gudang</span>
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">SKU &amp; Nama Bahan</th>
                    <th className="px-4 py-3.5">Kategori</th>
                    <th className="px-4 py-3.5 text-right">Sisa Stok</th>
                    <th className="px-4 py-3.5 text-right">HPP Satuan</th>
                    <th className="px-4 py-3.5 text-right">Total Valuasi</th>
                    <th className="px-4 py-3.5">Suplier</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {stocks.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-brand-50)]/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[var(--color-ink)]">{item.name}</p>
                        <p className="text-[10px] font-mono text-[var(--color-brand-700)] font-semibold">{item.sku}</p>
                      </td>

                      <td className="px-4 py-4">
                        <Badge variant="secondary">{item.category}</Badge>
                      </td>

                      <td className="px-4 py-4 text-right font-black font-mono text-[var(--color-ink)]">
                        {item.stock} {item.unit}
                      </td>

                      <td className="px-4 py-4 text-right font-mono text-[var(--color-slate-body)]">
                        {formatRupiah(item.costPerUnit)} / {item.unit}
                      </td>

                      <td className="px-4 py-4 text-right font-black text-[var(--color-ink)]">
                        {formatRupiah(item.stock * item.costPerUnit)}
                      </td>

                      <td className="px-4 py-4 text-[var(--color-slate-muted)]">
                        {item.supplier}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <Badge variant={item.status === 'menipis' ? 'warning' : 'success'}>
                          {item.status === 'menipis' ? 'Stok Menipis' : 'Aman'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: LOG BATCH PRODUKSI */}
      {activeTab === 'batches' && (
        <Card className="bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardHeader className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-hairline)]">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Log Batch Produksi Central Kitchen
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                Pencatatan proses roasting kopi, pengolahan sirup, dan premix bumbu standar mutu holding
              </CardDescription>
            </div>

            <Button
              onClick={() => setAddBatchOpen(true)}
              className="h-8.5 text-xs gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Catat Batch Baru</span>
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">No. Batch</th>
                    <th className="px-4 py-3.5">Produk Hasil Olahan</th>
                    <th className="px-4 py-3.5 text-right">Hasil Jadi</th>
                    <th className="px-4 py-3.5">Tanggal Olah</th>
                    <th className="px-4 py-3.5">Penanggung Jawab (QC)</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-[var(--color-brand-50)]/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[var(--color-brand-800)]">
                        {b.batchNumber}
                      </td>

                      <td className="px-4 py-4 font-bold text-[var(--color-ink)]">
                        {b.productName}
                      </td>

                      <td className="px-4 py-4 text-right font-black font-mono text-[var(--color-ink)]">
                        {b.quantityProduced} {b.unit}
                      </td>

                      <td className="px-4 py-4 text-[var(--color-slate-muted)] font-mono">
                        {b.date}
                      </td>

                      <td className="px-4 py-4 font-medium text-[var(--color-slate-body)]">
                        {b.chefSupervisor}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <Badge variant={b.status === 'Selesai' ? 'success' : 'brand'}>
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PERMINTAAN RESTOCK CABANG */}
      {activeTab === 'requests' && (
        <Card className="bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
            <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
              Permintaan Pengiriman Bahan ke Cabang
            </CardTitle>
            <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
              Kelola dan setujui pasokan logistik dari Gudang Pusat ke outlet-outlet kasir
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">No. Permintaan</th>
                    <th className="px-4 py-3.5">Outlet Tujuan</th>
                    <th className="px-4 py-3.5">Daftar Bahan Diminta</th>
                    <th className="px-4 py-3.5">Waktu Pengajuan</th>
                    <th className="px-4 py-3.5">No. Resi Logistik</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--color-brand-50)]/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[var(--color-brand-800)]">
                        {r.requestNumber}
                      </td>

                      <td className="px-4 py-4 font-bold text-[var(--color-ink)]">
                        {r.branchName}
                      </td>

                      <td className="px-4 py-4 text-[var(--color-slate-body)] max-w-xs truncate">
                        {r.itemsList}
                      </td>

                      <td className="px-4 py-4 text-[var(--color-slate-muted)] font-mono">
                        {r.requestedAt}
                      </td>

                      <td className="px-4 py-4 font-mono text-[11px] text-[var(--color-brand-700)] font-bold">
                        {r.trackingNumber || '—'}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <Badge variant={
                          r.status === 'Selesai Diterima' ? 'success' : r.status === 'Dalam Pengiriman' ? 'brand' : 'warning'
                        }>
                          {r.status}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {r.status === 'Menunggu Approval' ? (
                          <Button
                            size="sm"
                            onClick={() => handleApproveRequest(r.id)}
                            className="h-7 text-[11px] gap-1 px-2.5 font-bold shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Setujui Kirim</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[var(--color-slate-muted)] font-semibold">Terkirim</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Tambah Stok Gudang */}
      <Dialog open={addStockOpen} onClose={() => setAddStockOpen(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setAddStockOpen(false)}>
          <DialogTitle>Tambah Stok Gudang Pusat</DialogTitle>
          <DialogDescription>Daftarkan bahan baku mentah skala besar dari suplier.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddStock}>
          <DialogContent className="space-y-3 pt-4 text-xs">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Bahan Baku</label>
              <Input
                required
                placeholder="Contoh: Green Beans Robusta Flores"
                value={newStockName}
                onChange={(e) => setNewStockName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Kategori</label>
                <select
                  value={newStockCategory}
                  onChange={(e) => setNewStockCategory(e.target.value)}
                  className="w-full h-9 rounded-xl border border-[var(--color-hairline)] bg-white px-3 text-xs"
                >
                  <option value="Bahan Mentah">Bahan Mentah</option>
                  <option value="Hasil Racikan">Hasil Racikan</option>
                  <option value="Kemasan">Kemasan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Satuan</label>
                <Input
                  required
                  placeholder="kg / Liter / Dus"
                  value={newStockUnit}
                  onChange={(e) => setNewStockUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Jumlah Masuk</label>
                <Input
                  type="number"
                  required
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">HPP Beli per Satuan</label>
                <Input
                  type="number"
                  required
                  value={newStockCost}
                  onChange={(e) => setNewStockCost(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Suplier / Petani</label>
              <Input
                placeholder="Nama vendor suplier"
                value={newStockSupplier}
                onChange={(e) => setNewStockSupplier(e.target.value)}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setAddStockOpen(false)}>Batal</Button>
            <Button type="submit">Simpan ke Gudang</Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: Tambah Batch Produksi */}
      <Dialog open={addBatchOpen} onClose={() => setAddBatchOpen(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setAddBatchOpen(false)}>
          <DialogTitle>Catat Batch Produksi Dapur Pusat</DialogTitle>
          <DialogDescription>Dokumentasikan hasil roasting atau peracikan sirup.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddBatch}>
          <DialogContent className="space-y-3 pt-4 text-xs">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Produk Racikan</label>
              <Input
                required
                placeholder="Contoh: House Blend Espresso Roast 1kg"
                value={newBatchProduct}
                onChange={(e) => setNewBatchProduct(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Jumlah Hasil Jadi</label>
                <Input
                  type="number"
                  required
                  value={newBatchQty}
                  onChange={(e) => setNewBatchQty(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Satuan</label>
                <Input
                  required
                  placeholder="Pack / Botol / Jerigen"
                  value={newBatchUnit}
                  onChange={(e) => setNewBatchUnit(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Chef / QC Supervisor</label>
              <Input
                value={newBatchSupervisor}
                onChange={(e) => setNewBatchSupervisor(e.target.value)}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setAddBatchOpen(false)}>Batal</Button>
            <Button type="submit">Catat Batch</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
