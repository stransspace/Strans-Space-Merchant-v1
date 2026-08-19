import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// Ditampilkan sebagai pengganti isi halaman ketika tab yang dibuka butuh tier
// paket lebih tinggi dari milik tenant saat ini. Penegakan sesungguhnya tetap di
// backend (server-authoritative) — ini murni supaya user tidak melihat halaman
// kosong/rusak saat mengakses fitur di luar paketnya.
export function UpgradeRequired({ featureLabel, requiredPlanLabel, onOpenUpgrade }) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
        <Lock className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-[var(--color-ink)]">{featureLabel} belum aktif</h2>
        <p className="max-w-sm text-sm text-[var(--color-slate-muted)]">
          Fitur ini tersedia mulai paket <span className="font-semibold text-[var(--color-ink)]">{requiredPlanLabel}</span>. Upgrade paket untuk membukanya.
        </p>
      </div>
      <Button onClick={onOpenUpgrade} className="mt-1">
        <Sparkles className="h-4 w-4" />
        Lihat Paket Langganan
      </Button>
    </Card>
  );
}
