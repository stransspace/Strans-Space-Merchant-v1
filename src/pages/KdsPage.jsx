import React, { useState } from 'react';
import { 
  ChefHat, 
  Clock, 
  Flame, 
  CheckCircle2, 
  QrCode, 
  Plus, 
  Printer, 
  Download,
  Store,
  Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

export default function KdsPage({ activeBranchId, branches = [], setSuccessMessage }) {
  const [subTab, setSubTab] = useState('orders'); // 'orders' | 'tables'

  const [orders, setOrders] = useState([
    {
      id: 'kds-1',
      orderNumber: '#TRX-9485',
      tableNumber: 'Meja 4',
      orderType: 'Dine In',
      elapsedMinutes: 4,
      status: 'Sedang Dimasak',
      createdAt: '14.22',
      items: [
        { name: 'Kopi Susu Aren Signature', qty: 2, notes: 'Less ice, less sugar' },
        { name: 'Croissant Butter', qty: 1, notes: 'Hangatkan' }
      ]
    },
    {
      id: 'kds-2',
      orderNumber: '#TRX-9484',
      tableNumber: 'Bawa Pulang',
      orderType: 'Take Away',
      elapsedMinutes: 8,
      status: 'Antrean',
      createdAt: '14.18',
      items: [
        { name: 'Caramel Macchiato', qty: 2, notes: 'Extra shot espresso' },
        { name: 'French Fries Truffle', qty: 2, notes: 'Saus sambal pisah' }
      ]
    },
    {
      id: 'kds-3',
      orderNumber: '#TRX-9483',
      tableNumber: 'Meja 2 (QR Order)',
      orderType: 'QR Meja',
      elapsedMinutes: 14,
      status: 'Siap Saji',
      createdAt: '14.12',
      items: [
        { name: 'Americano Double Shot', qty: 2, notes: 'Hot' }
      ]
    }
  ]);

  const [tables, setTables] = useState([
    { id: 'tbl-1', number: '01', capacity: 2, status: 'Terisi', activeOrder: '#TRX-9480' },
    { id: 'tbl-2', number: '02', capacity: 4, status: 'Terisi', activeOrder: '#TRX-9483' },
    { id: 'tbl-3', number: '03', capacity: 4, status: 'Kosong' },
    { id: 'tbl-4', number: '04', capacity: 6, status: 'Terisi', activeOrder: '#TRX-9485' },
    { id: 'tbl-5', number: '05', capacity: 2, status: 'Kosong' },
  ]);

  const [addTableOpen, setAddTableOpen] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableCap, setNewTableCap] = useState('4');

  const advanceOrderStatus = (orderId) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (o.status === 'Antrean') return { ...o, status: 'Sedang Dimasak' };
        if (o.status === 'Sedang Dimasak') return { ...o, status: 'Siap Saji' };
      }
      return o;
    }));
    setSuccessMessage?.('Status pesanan dapur diperbarui!');
  };

  const handleAddTable = (e) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;

    const newTbl = {
      id: `tbl-${Date.now()}`,
      number: newTableNum.padStart(2, '0'),
      capacity: Number(newTableCap) || 4,
      status: 'Kosong'
    };

    setTables([...tables, newTbl]);
    setAddTableOpen(false);
    setNewTableNum('');
    setSuccessMessage?.(`Meja ${newTbl.number} berhasil ditambahkan! QR Code siap dicetak.`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Layar Dapur &amp; KDS (Kitchen Display System)
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Layar interaktif antrean masak barista/koki dan manajemen pemesanan mandiri QR Meja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={subTab === 'orders' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubTab('orders')}
            className="text-xs font-bold gap-1.5 h-8.5 rounded-xl cursor-pointer"
          >
            <ChefHat className="h-4 w-4" />
            <span>Tiket Antrean Dapur</span>
          </Button>

          <Button
            variant={subTab === 'tables' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubTab('tables')}
            className="text-xs font-bold gap-1.5 h-8.5 rounded-xl cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Kelola QR Meja ({tables.length})</span>
          </Button>
        </div>
      </div>

      {/* 2. SUBTAB: ORDERS (KDS) */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          {/* 3 Status KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-xs font-bold uppercase tracking-wider">Antrean Masuk</span>
                <Clock className="h-4 w-4" />
              </div>
              <p className="font-heading text-2xl font-black mt-1 text-[var(--color-ink)]">
                {orders.filter(o => o.status === 'Antrean').length} Tiket
              </p>
            </Card>

            <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
              <div className="flex items-center justify-between text-orange-700">
                <span className="text-xs font-bold uppercase tracking-wider">Sedang Dimasak</span>
                <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
              </div>
              <p className="font-heading text-2xl font-black mt-1 text-orange-600">
                {orders.filter(o => o.status === 'Sedang Dimasak').length} Tiket
              </p>
            </Card>

            <Card className="p-4 bg-white border-[var(--color-hairline)] shadow-2xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-xs font-bold uppercase tracking-wider">Siap Saji (Ready)</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-heading text-2xl font-black mt-1 text-emerald-600">
                {orders.filter(o => o.status === 'Siap Saji').length} Tiket
              </p>
            </Card>
          </div>

          {/* Kitchen Tickets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  'bg-white border-2 shadow-2xs overflow-hidden flex flex-col justify-between',
                  order.status === 'Sedang Dimasak'
                    ? 'border-orange-400 ring-2 ring-orange-100'
                    : order.status === 'Siap Saji'
                      ? 'border-emerald-500 bg-emerald-50/20'
                      : 'border-[var(--color-hairline)]'
                )}
              >
                <div>
                  <div className="p-4 pb-3 border-b border-[var(--color-hairline)] bg-[var(--color-snow)]/70 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[var(--color-ink)]">{order.orderNumber}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{order.orderType}</Badge>
                      </div>
                      <p className="text-xs font-bold text-[var(--color-brand-800)] mt-0.5">{order.tableNumber}</p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <Clock className="h-3 w-3" />
                        <span>{order.elapsedMinutes} mnt lalu</span>
                      </div>
                      <Badge
                        variant={order.status === 'Siap Saji' ? 'success' : order.status === 'Sedang Dimasak' ? 'warning' : 'secondary'}
                        className="text-[10px] mt-1"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 pb-2 border-b border-[var(--color-hairline)] last:border-0 last:pb-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-800)] text-xs font-black shrink-0">
                          {it.qty}x
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-[var(--color-ink)]">{it.name}</p>
                          {it.notes && (
                            <p className="text-[11px] text-amber-700 font-semibold mt-0.5 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                              📝 {it.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 pt-0">
                  {order.status === 'Antrean' && (
                    <Button
                      onClick={() => advanceOrderStatus(order.id)}
                      className="w-full h-9 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                    >
                      <Flame className="h-3.5 w-3.5" />
                      <span>Mulai Masak</span>
                    </Button>
                  )}

                  {order.status === 'Sedang Dimasak' && (
                    <Button
                      onClick={() => advanceOrderStatus(order.id)}
                      className="w-full h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Tandai Siap Saji</span>
                    </Button>
                  )}

                  {order.status === 'Siap Saji' && (
                    <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-800 text-center font-bold text-xs flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Pesanan Sudah Diantar</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 3. SUBTAB: TABLES & QR CODE */}
      {subTab === 'tables' && (
        <Card className="bg-white border-[var(--color-hairline)] shadow-2xs">
          <CardHeader className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-hairline)]">
            <div>
              <CardTitle className="text-sm font-bold text-[var(--color-ink)]">
                Manajemen Meja &amp; QR Order Mandiri
              </CardTitle>
              <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                Pelanggan dapat scan QR di meja untuk memesan dan membayar langsung tanpa antre di kasir
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8.5 text-xs gap-1.5 bg-white"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Semua QR Meja</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setAddTableOpen(true)}
                className="h-8.5 text-xs gap-1.5 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Meja</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-[var(--color-hairline)] p-4 text-center space-y-2 bg-[var(--color-snow)]/50 hover:border-[var(--color-brand-400)] transition-all"
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-[var(--color-slate-muted)]">Kapasitas {t.capacity} Org</span>
                    <Badge variant={t.status === 'Terisi' ? 'brand' : 'secondary'} className="text-[9px] px-1 py-0">
                      {t.status}
                    </Badge>
                  </div>

                  <div className="py-2">
                    <p className="font-heading text-3xl font-black text-[var(--color-ink)]">
                      Meja {t.number}
                    </p>
                    {t.activeOrder && (
                      <p className="text-[10px] font-mono text-[var(--color-brand-700)] font-bold mt-0.5">
                        {t.activeOrder}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSuccessMessage?.(`QR Code Meja ${t.number} siap diunduh!`);
                    }}
                    className="w-full text-xs h-7 bg-white gap-1"
                  >
                    <QrCode className="h-3.5 w-3.5 text-[var(--color-brand-600)]" />
                    <span>Unduh QR</span>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Tambah Meja */}
      <Dialog open={addTableOpen} onClose={() => setAddTableOpen(false)} maxWidth="max-w-xs">
        <DialogHeader onClose={() => setAddTableOpen(false)}>
          <DialogTitle>Tambah Meja Baru</DialogTitle>
          <DialogDescription>Daftarkan nomor meja untuk sistem kasir &amp; QR order.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddTable}>
          <DialogContent className="space-y-3 pt-3 text-xs">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nomor Meja</label>
              <Input
                required
                placeholder="Contoh: 06"
                value={newTableNum}
                onChange={(e) => setNewTableNum(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Kapasitas Kursi</label>
              <Input
                type="number"
                required
                value={newTableCap}
                onChange={(e) => setNewTableCap(e.target.value)}
              />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setAddTableOpen(false)}>Batal</Button>
            <Button type="submit">Tambah Meja</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
