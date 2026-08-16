import React, { useState } from 'react';
import { 
  Store, 
  MapPin, 
  Phone, 
  Plus, 
  Trash2, 
  UserRound, 
  TrendingUp, 
  Smartphone, 
  Settings,
  CheckCircle2,
  Building2,
  Lock,
  Sparkles
} from 'lucide-react';
import { formatRupiah, formatRupiahShort, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';

export default function OutletsPage({ 
  branches = [], 
  session, 
  onRefreshBranches, 
  onCreateBranch,
  onDeleteBranch,
  setSuccessMessage, 
  setActionError,
  confirmAction
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('Tangerang');
  const [newBranchTarget, setNewBranchTarget] = useState('1200000');
  const [newBranchManager, setNewBranchManager] = useState('Budi Santoso');
  const [newBranchPhone, setNewBranchPhone] = useState('08123456789');
  const [loading, setLoading] = useState(false);

  const defaultBranchesList = branches.length > 0 ? branches : [
    {
      id: '1',
      name: 'Kopi Cisauk',
      address: 'Jl. Raya Cisauk No. 18, Tangerang, Banten',
      city: 'Tangerang',
      isMain: true,
      totalRevenue: 396000,
      targetRevenue: 1200000,
      totalOrders: 5,
      activeStaff: 3,
      managerName: 'Budi Santoso',
      phone: '0812-3456-7890',
      activationCode: 'STRANS-8821'
    },
    {
      id: '2',
      name: 'Kopi Bandung',
      address: 'Jl. Ir. H. Juanda No. 102, Dago, Bandung',
      city: 'Bandung',
      isMain: false,
      totalRevenue: 240000,
      targetRevenue: 850000,
      totalOrders: 3,
      activeStaff: 2,
      managerName: 'Siti Rahma',
      phone: '0813-9876-5432',
      activationCode: 'STRANS-4902'
    }
  ];

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setLoading(true);
    try {
      if (onCreateBranch) {
        await onCreateBranch({
          name: newBranchName,
          city: newBranchCity,
          targetRevenue: Number(newBranchTarget) || 1000000,
          managerName: newBranchManager,
          phone: newBranchPhone
        });
      }
      setAddOpen(false);
      setNewBranchName('');
      setSuccessMessage?.(`Outlet "${newBranchName}" berhasil ditambahkan!`);
    } catch (err) {
      setActionError?.(err.message || 'Gagal menambahkan outlet.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (b) => {
    const ok = await confirmAction(
      `Hapus outlet "${b.name}"? Seluruh data riwayat penjualan dan stok cabang ini akan diarsipkan.`,
      { title: 'Hapus Outlet', confirmText: 'Ya, hapus outlet', danger: true }
    );
    if (!ok) return;

    try {
      if (onDeleteBranch) {
        await onDeleteBranch(b);
      }
      setSuccessMessage?.(`Outlet "${b.name}" berhasil dihapus.`);
    } catch (err) {
      setActionError?.(err.message || 'Gagal menghapus outlet.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Outlet
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kelola cabang, target omset, dan penanggung jawab tiap lokasi.
          </p>
        </div>

        <Button
          onClick={() => setAddOpen(true)}
          className="h-9 text-xs gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Tambah Outlet</span>
        </Button>
      </div>

      {/* 2. Plan Quota Card matching v2 */}
      <Card className="bg-white border-[var(--color-hairline)] shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-sm font-bold text-[var(--color-ink)]">
                Paket Juragan Space (AI)
              </span>
              <Badge variant="brand" className="text-[10px] px-2 py-0.5 font-bold">
                {defaultBranchesList.length} dari Tanpa batas outlet
              </Badge>
            </div>

            <div className="w-full max-w-md h-2 rounded-full bg-[var(--color-snow)] overflow-hidden">
              <div className="h-full bg-[var(--color-brand-600)] rounded-full" style={{ width: '25%' }} />
            </div>

            <p className="text-xs text-[var(--color-slate-muted)]">
              Holding multi-outlet aktif. Anda masih bisa menambah infinity outlet lagi.
            </p>
          </div>

          <Button
            variant="outline"
            className="text-xs shrink-0 bg-white"
          >
            Bandingkan Paket
          </Button>
        </div>
      </Card>

      {/* 3. Branch Cards Grid matching v2 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {defaultBranchesList.map((branch) => {
          const target = branch.targetRevenue || 1000000;
          const current = branch.totalRevenue || 300000;
          const achievement = Math.min(100, Math.round((current / target) * 100));

          return (
            <Card key={branch.id} className="bg-white border-[var(--color-hairline)] shadow-2xs flex flex-col justify-between overflow-hidden">
              <div>
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-[var(--color-hairline)] flex flex-row items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--color-brand-500)] to-[var(--color-brand-700)] text-white shadow-2xs">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold text-[var(--color-ink)] truncate">
                        {branch.name}
                      </CardTitle>
                      <p className="text-[11px] text-[var(--color-slate-muted)] flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{branch.city || 'Tangerang, Banten'}</span>
                      </p>
                    </div>
                  </div>

                  <Badge variant={branch.isMain ? 'brand' : 'success'} className="text-[10px] px-2 py-0.5 font-bold shrink-0">
                    {branch.isMain ? 'Pusat' : 'Aktif'}
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* 3 Metrics Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-snow)] p-2.5 text-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">Omset</span>
                      <span className="block text-xs font-black text-[var(--color-ink)] font-mono mt-0.5">{formatRupiahShort(current)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">Transaksi</span>
                      <span className="block text-xs font-black text-[var(--color-ink)] font-mono mt-0.5">{branch.totalOrders || 5}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">Staf</span>
                      <span className="block text-xs font-black text-[var(--color-ink)] font-mono mt-0.5">{branch.activeStaff || 3} orang</span>
                    </div>
                  </div>

                  {/* Revenue Target Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-slate-muted)]">Target {formatRupiahShort(target)}</span>
                      <span className="font-bold text-[var(--color-ink)]">{achievement}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--color-snow)] overflow-hidden">
                      <div className="h-full bg-[var(--color-brand-600)] rounded-full transition-all duration-300" style={{ width: `${achievement}%` }} />
                    </div>
                  </div>

                  {/* Manager & Contact */}
                  <div className="pt-2 border-t border-[var(--color-hairline)] space-y-1.5 text-xs text-[var(--color-slate-body)]">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 text-[var(--color-brand-600)] shrink-0" />
                      <span className="font-semibold">{branch.managerName || 'Budi Santoso'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-[var(--color-slate-muted)] shrink-0" />
                      <span className="text-[var(--color-slate-muted)] font-mono text-[11px]">{branch.phone || '0812-3456-7890'}</span>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 pt-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuccessMessage?.(`Kode aktivasi kasir: ${branch.activationCode || 'STRANS-8821'}`)}
                  className="flex-1 text-xs h-8 bg-white border-[var(--color-hairline)] gap-1.5"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Kode Kasir</span>
                </Button>

                {!branch.isMain && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(branch)}
                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    title="Hapus Outlet"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* MODAL: Tambah Outlet Baru */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setAddOpen(false)}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Tambah Outlet Baru</DialogTitle>
              <DialogDescription>Buka cabang toko baru dengan kuota holding.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleAddBranch}>
          <DialogContent className="space-y-3 pt-4 text-xs">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Cabang / Toko</label>
              <Input
                required
                placeholder="Contoh: Kopi Senopati (Jakarta Selatan)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Kota</label>
                <Input
                  required
                  placeholder="Jakarta / Bandung / Bali"
                  value={newBranchCity}
                  onChange={(e) => setNewBranchCity(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Target Omset Bulanan</label>
                <Input
                  type="number"
                  required
                  value={newBranchTarget}
                  onChange={(e) => setNewBranchTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Penanggung Jawab (PIC)</label>
                <Input
                  placeholder="Nama manager cabang"
                  value={newBranchManager}
                  onChange={(e) => setNewBranchManager(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">No. WhatsApp PIC</label>
                <Input
                  placeholder="08123456789"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                />
              </div>
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Buka Cabang Sekarang'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
