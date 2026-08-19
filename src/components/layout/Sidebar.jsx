import React from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  ExternalLink,
  Crown,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { StransLogo } from '../ui/strans-logo';
import { Button } from '../ui/button';
import { NAV_GROUPS } from '../../lib/navigation';
import { useLanguage } from '../../lib/language-context';

export function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  branchCount = 2,
  planName = 'Rintis Space',
  planTag,
  onOpenUpgrade
}) {
  const { t } = useLanguage();

  const getTranslatedGroupTitle = (title) => {
    if (title === 'PANTAU') return t('nav.group.pantau', 'PANTAU');
    if (title === 'KELOLA') return t('nav.group.kelola', 'KELOLA');
    if (title === 'LAINNYA') return t('nav.group.lainnya', 'LAINNYA');
    return title;
  };

  const getTranslatedItemLabel = (item) => {
    switch (item.id) {
      case 'overview': return t('nav.overview', item.label);
      case 'sales': return t('nav.sales', item.label);
      case 'shifts': return t('nav.shifts', item.label);
      case 'catalog': return t('nav.catalog', item.label);
      case 'kasir': return t('nav.kasir', item.label);
      case 'wallet': return t('nav.wallet', item.label);
      case 'vouchers': return t('nav.vouchers', item.label);
      case 'outlets': return t('nav.outlets', item.label);
      case 'settings': return t('nav.settings', item.label);
      case 'help': return t('nav.help', item.label);
      default: return item.label;
    }
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--sidebar)] transition-all duration-200 lg:flex select-none z-20',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header Sidebar */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-[var(--color-hairline)] px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Bentangkan navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--color-brand-50)] text-[var(--color-brand-600)] transition-colors cursor-pointer"
          >
            <StransLogo size="sm" iconOnly />
          </button>
        ) : (
          <>
            <div className="flex items-center cursor-pointer" onClick={() => onTabChange('overview')}>
              <StransLogo size="sm" />
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              title="Ciutkan navigasi"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Main Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4 scroll-slim">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-slate-muted)]">
                {getTranslatedGroupTitle(group.title)}
              </p>
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = 
                  activeTab === item.id || 
                  item.children?.some(c => c.id === activeTab);
                const Icon = item.icon;
                const label = getTranslatedItemLabel(item);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'group flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-sm font-semibold transition-all cursor-pointer',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-[var(--color-brand-600)] text-white shadow-xs font-bold'
                          : 'text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)]'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-white' : 'text-[var(--color-brand-600)]'
                        )}
                      />

                      {!collapsed && (
                        <>
                          <span className="truncate">{label}</span>
                          {item.id === 'outlets' && (
                            <span
                              className={cn(
                                'ml-auto rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                                isActive
                                  ? 'bg-white/25 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {branchCount}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Area: Plan Meter & POS App Link */}
      <div className="space-y-2 border-t border-[var(--color-hairline)] p-2.5">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-10 w-full items-center justify-center rounded-xl text-[var(--color-brand-600)] hover:bg-[var(--color-brand-50)] cursor-pointer"
            title="Bentangkan navigasi"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : (
          <>
            {/* Plan Card */}
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="w-full rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)] p-3 space-y-1.5 text-left shadow-2xs hover:border-[var(--color-brand-300)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-bold text-xs text-[var(--color-ink)] truncate">{planName}</span>
              </div>
              <p className="text-[11px] text-[var(--color-slate-muted)] leading-tight">
                {planTag || t('topbar.planTag', '')}
              </p>
            </button>

            {/* Link Web POS */}
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)] transition-colors"
            >
              <span>{t('nav.posApp', 'Aplikasi kasir')}</span>
              <ExternalLink className="h-3.5 w-3.5 text-[var(--color-slate-muted)]" />
            </a>
          </>
        )}
      </div>
    </aside>
  );
}
