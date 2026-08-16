import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Store, 
  CheckCircle2, 
  QrCode, 
  ShieldAlert, 
  Radio,
  Clock,
  Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { PairingDialog } from '../components/modals/PairingDialog';
import { cn } from '../lib/utils';

export default function KasirPage({ activeBranchId, branches = [], session, setSuccessMessage, setActionError, confirmAction }) {
  const [pairingBranch, setPairingBranch] = useState(null);
  const [devices, setDevices] = useState([
    {
      id: 'dev-1',
      outletId: '1',
      outletName: 'Kopi Cisauk (Tangerang)',
      deviceName: 'Samsung Galaxy Tab A9 (Kasir Utama)',
      pairedAt: '12 Agu 2026, 08.30',
      lastSeen: 'Aktif baru saja',
      isOnline: true,
      appVersion: 'v2.4.0'
    },
    {
      id: 'dev-2',
      outletId: '1',
      outletName: 'Kopi Cisauk (Tangerang)',
      deviceName: 'Xiaomi Redmi Pad SE (Kasir 2 / Takeaway)',
      pairedAt: '10 Agu 2026, 14.15',
      lastSeen: 'Aktif 15 menit lalu',
      isOnline: true,
      appVersion: 'v2.4.0'
    },
    {
      id: 'dev-3',
      outletId: '2',
      outletName: 'Kopi Bandung (Dago)',
      deviceName: 'iPad 9th Gen (Kasir Bar)',
      pairedAt: '05 Agu 2026, 09.00',
      lastSeen: 'Aktif 1 jam lalu',
      isOnline: false,
      appVersion: 'v2.3.8'
    }
  ]);

  const handleRevoke = async (device) => {
    const ok = await confirmAction(
      `Putus akses perangkat "${device.deviceName}"? Kasir pada perangkat ini akan langsung ter-logout dan tidak bisa mencatat transaksi lagi sebelum dipasangkan ulang.`,
      { title: 'Putus Akses Mesin Kasir', confirmText: 'Ya, putus akses', danger: true }
    );

    if (!ok) return;

    setDevices(prev => prev.filter(d => d.id !== device.id));
    setSuccessMessage?.(`Perangkat "${device.deviceName}" berhasil diputus.`);
  };

  const selectedBranches = activeBranchId === 'all'
    ? branches
    : branches.filter(b => String(b.id) === String(activeBranchId));

  const branchesToDisplay = selectedBranches.length > 0
    ? selectedBranches
    : [{ id: '1', name: 'Kopi Cisauk (Tangerang)' }, { id: '2', name: 'Kopi Bandung (Dago)' }];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Kasir &amp; Perangkat
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Setiap HP atau tablet yang bisa berjualan atas nama usaha Anda, dan tombol untuk memutusnya.
          </p>
        </div>

        <Button
          onClick={() => setPairingBranch(branchesToDisplay[0])}
          className="h-9 text-xs gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Pasangkan Mesin Kasir</span>
        </Button>
      </div>

      {/* 2. Onboarding Instruction Card matching v2 */}
      <Card className="bg-white border-[var(--color-hairline)] shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[var(--color-brand-600)]" />
              <span>Langkah pertama: pasang aplikasinya</span>
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-slate-muted)]">
              Buka aplikasi kasir lewat peramban HP atau tablet yang akan dipakai, lalu simpan ke layar utama.
              Setelah itu masukkan kode aktivasi 6 digit — sekali saja, tidak perlu diulang tiap hari.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => window.open('http://localhost:5173', '_blank')}
            className="h-8.5 text-xs shrink-0 gap-1.5 bg-white border-[var(--color-hairline)] shadow-2xs cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Buka Aplikasi Kasir</span>
          </Button>
        </div>
      </Card>

      {/* 3. Devices Grouped by Branch matching v2 */}
      <div className="space-y-4">
        {branchesToDisplay.map((b) => {
          const branchDevices = devices.filter(d => String(d.outletId) === String(b.id));

          return (
            <Card key={b.id} className="bg-white border-[var(--color-hairline)] shadow-2xs overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-[var(--color-hairline)] bg-[var(--color-snow)]/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-[var(--color-ink)]">{b.name}</CardTitle>
                    <p className="text-[11px] text-[var(--color-slate-muted)]">{branchDevices.length} Mesin Kasir Terpasang</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPairingBranch(b)}
                  className="text-xs h-7.5 bg-white border-[var(--color-hairline)] shadow-2xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Tambah Mesin</span>
                </Button>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-[var(--color-hairline)]">
                {branchDevices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--color-slate-muted)]">
                    Belum ada mesin kasir yang terpasang di cabang ini. Klik tombol Tambah Mesin untuk menghubungkan tablet kasir.
                  </div>
                ) : (
                  branchDevices.map((dev) => (
                    <div key={dev.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 hover:bg-[var(--color-snow)]/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[var(--color-ink)] shrink-0 mt-0.5">
                          <Smartphone className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[var(--color-ink)]">{dev.deviceName}</span>
                            <Badge variant={dev.isOnline ? 'success' : 'secondary'} className="text-[10px] gap-1 px-1.5 py-0">
                              <span className={cn('h-1.5 w-1.5 rounded-full', dev.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                              <span>{dev.isOnline ? 'Online' : 'Offline'}</span>
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                            Dipasangkan: {dev.pairedAt} • Versi {dev.appVersion} • {dev.lastSeen}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(dev)}
                        className="text-xs h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Putus Akses</span>
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pairing Dialog Modal */}
      {pairingBranch && (
        <PairingDialog
          branch={pairingBranch}
          open={!!pairingBranch}
          onClose={() => setPairingBranch(null)}
          onPaired={() => {
            setPairingBranch(null);
            setSuccessMessage?.(`Mesin kasir baru berhasil dihubungkan ke ${pairingBranch.name}!`);
          }}
        />
      )}
    </div>
  );
}
