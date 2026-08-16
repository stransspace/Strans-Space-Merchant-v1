import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export function UserMenu({
  session,
  onLogout,
  onOpenSettings
}) {
  const [open, setOpen] = useState(false);

  const businessName = session?.tenant?.name || 'Kopi Kupu';
  const roleName = session?.cashier?.role || 'owner';

  return (
    <div className="relative">
      {/* Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] p-1 pr-3 shadow-2xs hover:bg-[var(--color-snow)] transition-all cursor-pointer"
      >
        {/* Emerald Square with SS */}
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white text-xs font-black tracking-wider shadow-xs">
          SS
        </div>

        <div className="hidden sm:block text-left min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--color-ink)] leading-tight">
            STRANS SPACE
          </div>
          <div className="text-[10px] text-[var(--color-slate-muted)] font-medium leading-none truncate max-w-24 mt-0.5">
            {businessName}
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] p-2 shadow-float z-50 animate-in fade-in duration-150 text-xs">
            {/* Header info */}
            <div className="p-3 border-b border-[var(--color-hairline)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--color-ink)]">{session?.cashier?.name || 'Owner'}</span>
                <Badge variant="brand" className="text-[9px] uppercase px-1.5">{roleName}</Badge>
              </div>
              <p className="text-[10px] text-[var(--color-slate-muted)] truncate">{session?.cashier?.email || 'owner@stranspace.com'}</p>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-semibold text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              >
                <Settings className="h-4 w-4 text-[var(--color-brand-600)]" />
                <span>Pengaturan Akun</span>
              </button>
            </div>

            <div className="pt-1 border-t border-[var(--color-hairline)]">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
