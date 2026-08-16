import React from 'react';
import { X, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StransLogo } from '../ui/strans-logo';
import { Badge } from '../ui/badge';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  Users, 
  BarChart3, 
  Coins, 
  Ticket, 
  Wallet, 
  History, 
  Settings 
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, minPlan: 0 },
  { id: 'products', label: 'Menu & Produk', icon: ShoppingBag, minPlan: 0 },
  { id: 'inventory', label: 'Bahan & Resep HPP', icon: Layers, minPlan: 1, badge: 'HPP' },
  { id: 'staff', label: 'Staf & Kasir', icon: Users, minPlan: 0 },
  { id: 'reports', label: 'Laporan Analitik', icon: BarChart3, minPlan: 0 },
  { id: 'expenses', label: 'Pengeluaran Kas', icon: Coins, minPlan: 1 },
  { id: 'vouchers', label: 'Promo & Voucher', icon: Ticket, minPlan: 1 },
  { id: 'wallet', label: 'Dompet Digital', icon: Wallet, minPlan: 0 },
  { id: 'logs', label: 'Log Aktivitas', icon: History, minPlan: 2, badge: 'Audit' },
  { id: 'settings', label: 'Pengaturan', icon: Settings, minPlan: 0 },
];

export function MobileNav({
  open,
  onClose,
  activeTab,
  onSelectTab,
  planRank = 0,
  planName = 'free',
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[var(--color-ink)]/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 flex w-72 max-w-[80vw] flex-col bg-[var(--sidebar)] p-4 shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4">
          <StransLogo size="sm" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-slate-muted)] hover:bg-[var(--color-brand-50)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLocked = planRank < item.minPlan;

            return (
              <button
                key={item.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-brand-600)] text-white shadow-sm'
                    : isLocked
                    ? 'opacity-40 cursor-not-allowed text-[var(--color-slate-muted)]'
                    : 'text-[var(--color-slate-body)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-ink)]'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-[var(--color-brand-600)]')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && !isLocked && (
                  <Badge variant={isActive ? 'coral' : 'brand'} className="text-[9px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
                {isLocked && <Lock className="h-3 w-3 text-amber-500" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-hairline)] pt-3">
          <div className="rounded-xl bg-[var(--color-brand-50)] p-3 text-xs">
            <span className="text-[10px] text-[var(--color-slate-muted)] font-semibold">Paket Aktif:</span>
            <div className="font-bold text-[var(--color-brand-800)] uppercase mt-0.5">
              {planName} Plan
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
