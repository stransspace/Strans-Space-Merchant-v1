import React, { useState } from 'react';
import { 
  Store, 
  ChevronsUpDown, 
  Check, 
  MapPin, 
  Plus
} from 'lucide-react';
import { cn, formatRupiah } from '../../lib/utils';
import { Badge } from '../ui/badge';

export function OutletSwitcher({
  branches = [],
  activeBranchId,
  onSelectBranch,
  onOpenAddBranch,
  totalRevenue = 396000
}) {
  const [open, setOpen] = useState(false);

  const selectedBranch = activeBranchId === 'all' 
    ? { id: 'all', name: 'Semua Outlet', isAggregate: true, city: 'Pusat' }
    : branches.find(b => String(b.id) === String(activeBranchId)) || { id: 'all', name: 'Semua Outlet' };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex min-h-10 items-center gap-2 rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] px-3 text-left transition-all cursor-pointer shadow-2xs',
          'hover:bg-[var(--color-snow)] hover:border-[var(--color-brand-300)]'
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--color-brand-500)] to-[var(--color-brand-700)] text-white shadow-2xs">
          <Store className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 pr-1">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--color-brand-700)] leading-none">
            OUTLET
          </span>
          <span className="block truncate text-xs font-black leading-tight text-[var(--color-ink)] mt-0.5">
            {selectedBranch.name}
          </span>
        </div>

        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-slate-muted)] ml-1" />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] p-2 shadow-float z-50 animate-in fade-in duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)] flex justify-between items-center">
              <span>PILIH OUTLET</span>
              <span className="font-mono">{branches.length + 1} Pilihan</span>
            </div>

            <div className="space-y-1 mt-1">
              {/* Option 1: Semua Outlet */}
              <button
                type="button"
                onClick={() => {
                  onSelectBranch('all');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer',
                  activeBranchId === 'all'
                    ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-900)] font-bold'
                    : 'hover:bg-[var(--color-snow)] text-[var(--color-slate-body)]'
                )}
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {activeBranchId === 'all' && <Check className="h-4 w-4 text-[var(--color-brand-600)]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-bold">Semua Outlet</span>
                    <Badge variant="brand" className="text-[9px] px-1 py-0">Gabungan</Badge>
                  </div>
                  <span className="text-[10px] text-[var(--color-slate-muted)]">Agregasi Holding</span>
                </div>
              </button>

              {/* Specific Branches */}
              {branches.map((b) => {
                const isSelected = String(b.id) === String(activeBranchId);

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onSelectBranch(b.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-900)] font-bold'
                        : 'hover:bg-[var(--color-snow)] text-[var(--color-slate-body)]'
                    )}
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {isSelected && <Check className="h-4 w-4 text-[var(--color-brand-600)]" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="truncate font-bold text-[var(--color-ink)]">{b.name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-[var(--color-slate-muted)]">
                        <MapPin className="h-2.5 w-2.5" />
                        <span>{b.city || 'Cabang Aktif'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 mt-2 border-t border-[var(--color-hairline)]">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenAddBranch?.();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[var(--color-brand-700)] hover:bg-[var(--color-brand-50)] transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Outlet Baru</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
