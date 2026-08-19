import React from 'react';
import { 
  Sparkles, 
  Bell, 
  Menu,
  ChevronDown
} from 'lucide-react';
import { OutletSwitcher } from './OutletSwitcher';
import { GlobalSearch } from './GlobalSearch';
import { UserMenu } from './UserMenu';
import { Badge } from '../ui/badge';

export function Topbar({
  branches = [],
  activeBranchId,
  onSelectBranch,
  onOpenAddBranch,
  session,
  onLogout,
  onSelectTab,
  onOpenUpgrade,
  onToggleMobileNav,
  planName = 'Rintis Space',
  planTag = '',
  planRank
}) {

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-hairline)] bg-[var(--sidebar)]/90 backdrop-blur-md shadow-2xs">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
        {/* Left Section: Mobile Menu + Outlet Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <OutletSwitcher
            branches={branches}
            activeBranchId={activeBranchId}
            onSelectBranch={onSelectBranch}
            onOpenAddBranch={onOpenAddBranch}
          />
        </div>

        {/* Right / Center Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Plan Pill Badge */}
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="hidden xl:flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/80 px-3 py-1 text-[11px] font-bold text-violet-700 shadow-2xs hover:bg-violet-100 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>👑 {planName}{planTag ? ` • ${planTag}` : ''}</span>
          </button>

          {/* Search Bar Pill */}
          <GlobalSearch onSelectTab={onSelectTab} planRank={planRank} />

          {/* Notification Bell */}
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)] transition-colors shadow-2xs cursor-pointer"
            title="Notifikasi"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--color-brand-600)] ring-2 ring-white" />
          </button>

          {/* User Profile Pill */}
          <UserMenu
            session={session}
            onLogout={onLogout}
            onOpenSettings={() => {}}
          />
        </div>
      </div>
    </header>
  );
}
