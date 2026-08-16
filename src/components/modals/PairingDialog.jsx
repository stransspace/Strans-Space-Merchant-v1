import React, { useState } from 'react';
import { 
  Store, 
  Smartphone, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles, 
  ShieldCheck, 
  Info,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function PairingDialog({
  open,
  onClose,
  branch,
}) {
  const [copied, setCopied] = useState(false);

  const activationCode = branch?.activation_code || branch?.code || 'STRANS-8821';
  const branchName = branch?.name || 'Outlet Utama';

  const handleCopy = () => {
    try {
      navigator.clipboard?.writeText(activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Pemasangan Perangkat Kasir (POS)</DialogTitle>
            <DialogDescription>
              Hubungkan aplikasi Kasir Web / Android POS ke outlet <b>{branchName}</b>.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-5 pt-4">
        {/* Instructions */}
        <div className="rounded-xl border border-[var(--color-brand-100)] bg-[var(--color-brand-50)]/60 p-3.5 text-xs text-[var(--color-brand-900)] space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <Info className="h-4 w-4 text-[var(--color-brand-600)] shrink-0" />
            <span>Cara Menghubungkan Kasir:</span>
          </div>
          <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[var(--color-slate-body)]">
            <li>Buka aplikasi POS (Web Kasir atau Android) di mesin kasir.</li>
            <li>Pilih <b>Aktivasi Outlet</b> dan masukkan kode 6-digit di bawah ini.</li>
            <li>Kasir Anda langsung tersinkronisasi otomatis dengan katalog menu ini.</li>
          </ol>
        </div>

        {/* Big Code Card */}
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-brand-300)] bg-[var(--color-snow)] p-6 text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-slate-muted)]">
            KODE AKTIVASI OUTLET
          </span>

          <div className="my-2 select-all font-mono text-3xl font-black tracking-widest text-[var(--color-brand-800)]">
            {activationCode}
          </div>

          <p className="text-[11px] text-[var(--color-slate-muted)]">
            Outlet: <span className="font-bold text-[var(--color-ink)]">{branchName}</span>
          </p>

          <Button
            size="sm"
            variant={copied ? 'secondary' : 'default'}
            onClick={handleCopy}
            className="mt-4 w-full h-9 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Kode Berhasil Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Kode Aktivasi</span>
              </>
            )}
          </Button>
        </div>

        {/* Security guarantee note */}
        <div className="flex items-center justify-between text-[11px] text-[var(--color-slate-muted)] pt-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Enkripsi Token HMAC Kasir Aman</span>
          </div>
          <Badge variant="brand" className="text-[9px]">Otomatis Terhubung</Badge>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Tutup
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
