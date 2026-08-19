import React, { useState, useEffect } from 'react';
import {
  Search,
  Command,
  LayoutDashboard,
  ShoppingBag,
  Layers,
  Users,
  BarChart3,
  Coins,
  Ticket,
  Wallet,
  History,
  Settings,
  Plus,
  ArrowRight,
  X,
  Palette,
  Store,
  Shield,
  Bell,
  CreditCard,
  Package,
  Boxes,
  Truck,
  Lock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/language-context';
import { PLAN_RANK } from '../../lib/plans';

export function GlobalSearch({
  onSelectTab,
  onOpenAddBranch,
  planRank = Infinity,
  className = '',
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const searchItems = [
    { id: 'dashboard', title: t('nav.overview', 'Ringkasan'), category: t('nav.group.pantau', 'Navigasi'), icon: LayoutDashboard },
    { id: 'products', title: t('nav.products', 'Menu & Katalog Produk'), category: t('nav.group.kelola', 'Navigasi'), icon: ShoppingBag },
    { id: 'inventory', title: t('nav.inventory', 'Stok Bahan Baku'), category: t('nav.group.kelola', 'Navigasi'), icon: Layers },
    { id: 'central-kitchen', title: t('nav.centralKitchen', 'Gudang Pusat'), category: t('nav.group.kelola', 'Navigasi'), icon: Layers, requiresPlanRank: PLAN_RANK.juragan },
    { id: 'staff', title: t('nav.staff', 'Staf & Hak Akses'), category: t('nav.group.kelola', 'Navigasi'), icon: Users },
    { id: 'reports', title: t('nav.reports', 'Laporan Keuangan'), category: t('nav.group.pantau', 'Navigasi'), icon: BarChart3 },
    { id: 'expenses', title: t('nav.expenses', 'Pengeluaran Kas'), category: t('nav.group.pantau', 'Navigasi'), icon: Coins },
    { id: 'vouchers', title: t('nav.vouchers', 'Promo & Kupon'), category: t('nav.group.kelola', 'Navigasi'), icon: Ticket },
    { id: 'wallet', title: t('nav.wallet', 'Dompet & Saldo Digital'), category: t('nav.group.kelola', 'Navigasi'), icon: Wallet },
    { id: 'outlets', title: t('nav.outlets', 'Cabang & Outlet'), category: t('nav.group.kelola', 'Navigasi'), icon: Users },
    { id: 'settings', title: t('nav.settings', 'Pengaturan Usaha'), category: t('nav.group.lainnya', 'Navigasi'), icon: Settings },

    // Sub-halaman Pengaturan
    { id: 'settings:appearance', title: t('settings.tab.appearance', 'Tampilan & Bahasa'), category: t('nav.settings', 'Pengaturan Usaha'), icon: Palette },
    { id: 'settings:profile', title: t('settings.tab.profile', 'Profil Usaha'), category: t('nav.settings', 'Pengaturan Usaha'), icon: Store },
    { id: 'settings:security', title: t('settings.tab.security', 'Keamanan & Otorisasi'), category: t('nav.settings', 'Pengaturan Usaha'), icon: Shield },
    { id: 'settings:notifications', title: t('settings.tab.notifications', 'Notifikasi & Rekap AI'), category: t('nav.settings', 'Pengaturan Usaha'), icon: Bell },
    { id: 'settings:plan', title: t('settings.tab.plan', 'Paket Berlangganan'), category: t('nav.settings', 'Pengaturan Usaha'), icon: CreditCard },

    // Sub-halaman Stok Bahan Baku
    { id: 'inventory:stock', title: t('inventory.tab.stock', 'Stok Cabang'), category: t('nav.inventory', 'Stok Bahan Baku'), icon: Layers },
    { id: 'inventory:materials', title: t('inventory.tab.materials', 'Daftar Bahan Baku'), category: t('nav.inventory', 'Stok Bahan Baku'), icon: Package },

    // Sub-halaman Gudang Pusat
    { id: 'central-kitchen:stocks', title: t('centralKitchen.tab.stocks', 'Stok Gudang Pusat'), category: t('nav.centralKitchen', 'Gudang Pusat'), icon: Boxes, requiresPlanRank: PLAN_RANK.juragan },
    { id: 'central-kitchen:batches', title: t('centralKitchen.tab.batches', 'Batch Produksi'), category: t('nav.centralKitchen', 'Gudang Pusat'), icon: Package, requiresPlanRank: PLAN_RANK.juragan },
    { id: 'central-kitchen:requests', title: t('centralKitchen.tab.requests', 'Permintaan Cabang'), category: t('nav.centralKitchen', 'Gudang Pusat'), icon: Truck, requiresPlanRank: PLAN_RANK.juragan },
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = searchItems.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      {/* Search Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-snow)] px-3 py-1.5 text-xs text-[var(--color-slate-muted)] transition-all hover:border-[var(--color-brand-300)] hover:bg-[var(--card)] focus:outline-none w-48 sm:w-64 cursor-pointer',
          className
        )}
      >
        <Search className="h-3.5 w-3.5 text-[var(--color-slate-muted)]" />
        <span className="flex-1 text-left truncate">{t('topbar.search', 'Cari menu, laporan...')}</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-hairline)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-slate-muted)] shadow-2xs">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      {/* Search Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-xs" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Input Header */}
            <div className="flex items-center border-b border-[var(--color-hairline)] px-4 py-3">
              <Search className="h-5 w-5 text-[var(--color-brand-600)] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={language === 'en' ? 'Type to search pages or actions...' : 'Ketik untuk mencari halaman atau aksi...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-slate-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[var(--color-slate-muted)] hover:bg-[var(--color-brand-50)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto p-2">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                {language === 'en' ? 'Quick Navigation' : 'Navigasi Cepat'}
              </div>

              {results.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--color-slate-muted)]">
                  {language === 'en' ? 'No matching pages found.' : 'Tidak ditemukan menu yang sesuai.'}
                </div>
              ) : (
                results.map((item) => {
                  const Icon = item.icon;
                  const isSubPage = item.id.includes(':');
                  const isLocked = typeof item.requiresPlanRank === 'number' && planRank < item.requiresPlanRank;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (onSelectTab) onSelectTab(item.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs text-[var(--color-slate-body)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn('h-4 w-4', isLocked ? 'text-[var(--color-slate-muted)]' : 'text-[var(--color-brand-600)]')} />
                        <div className="flex flex-col items-start">
                          <span className="font-semibold">{item.title}</span>
                          {isSubPage && (
                            <span className="text-[10px] text-[var(--color-slate-muted)]">{item.category}</span>
                          )}
                        </div>
                      </div>
                      {isLocked ? (
                        <Lock className="h-3 w-3 text-[var(--color-slate-muted)]" />
                      ) : (
                        <ArrowRight className="h-3 w-3 text-[var(--color-slate-muted)]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
