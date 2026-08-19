import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NAV_GROUPS } from '../../lib/navigation';
import { useLanguage } from '../../lib/language-context';

export function SectionTabs({ currentTab, onTabChange, planRank = Infinity }) {
  const { t } = useLanguage();

  // Find if currentTab belongs to any group item with children
  let parentItem = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.id === currentTab || item.children?.some(c => c.id === currentTab)) {
        parentItem = item;
        break;
      }
    }
    if (parentItem) break;
  }

  const tabs = parentItem?.children || [];
  if (tabs.length < 2) return null;

  const getTranslatedSubTab = (tab) => {
    switch (tab.id) {
      case 'transactions': return t('nav.transactions', tab.label);
      case 'reports': return t('nav.reports', tab.label);
      case 'shifts': return t('nav.shifts.tab', tab.label);
      case 'expenses': return t('nav.expenses', tab.label);
      case 'products': return t('nav.products', tab.label);
      case 'inventory': return t('nav.inventory', tab.label);
      case 'central-kitchen': return t('nav.centralKitchen', tab.label);
      case 'pos-devices':
      case 'kasir': return t('nav.posDevices', tab.label);
      case 'kds': return t('nav.kds', tab.label);
      case 'branches': return t('nav.branches', tab.label);
      case 'staff': return t('nav.staff', tab.label);
      case 'settings-profile': return t('nav.profile', tab.label);
      case 'logs': return t('nav.logs', tab.label);
      default: return tab.label;
    }
  };

  return (
    <nav aria-label={`Bagian ${parentItem?.label || ''}`} className="mb-4">
      <ul className="inline-flex min-w-full gap-1 rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] p-1 shadow-2xs">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id || (parentItem.id === currentTab && tabs[0].id === tab.id);
          const isLocked = typeof tab.requiresPlanRank === 'number' && planRank < tab.requiresPlanRank;
          const Icon = tab.icon;
          const label = getTranslatedSubTab(tab);

          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                title={isLocked ? 'Butuh upgrade paket' : undefined}
                className={cn(
                  'flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition-all cursor-pointer',
                  isActive
                    ? 'bg-[var(--color-brand-600)] text-white shadow-xs'
                    : isLocked
                      ? 'text-[var(--color-slate-muted)] hover:bg-[var(--color-snow)]'
                      : 'text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)]'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : isLocked ? 'text-[var(--color-slate-muted)]' : 'text-[var(--color-brand-600)]')} />
                <span>{label}</span>
                {isLocked && <Lock className="h-3 w-3 shrink-0 text-[var(--color-slate-muted)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
