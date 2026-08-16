import React from 'react';
import { 
  ArrowUpRight, 
  ExternalLink, 
  Keyboard, 
  LifeBuoy, 
  Mail, 
  MessageCircle,
  HelpCircle,
  Sparkles,
  Layers,
  ShoppingBag,
  BarChart3,
  Coins,
  Store,
  Users,
  Wallet,
  Settings,
  Ticket,
  Clock,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { NAV_GROUPS } from '../lib/navigation';
import { useLanguage } from '../lib/language-context';
import { cn } from '../lib/utils';

export default function HelpPage({ onNavigate }) {
  const { t, language } = useLanguage();

  const SUPPORT_EMAIL = 'support@stranspace.com';
  const WHATSAPP_NUMBER = '6281234567890';
  const APP_VERSION = 'v2.4.0-enterprise';
  const POS_APP_URL = 'http://localhost:3800/pos';
  const SITE_URL = 'https://stranspace.com';

  const whatsappMessage = encodeURIComponent(
    language === 'en'
      ? 'Hello Strans Space Support team, I need assistance with the Owner Dashboard.'
      : 'Halo tim Strans Space, saya butuh bantuan terkait Dashboard Owner.'
  );

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

  const getTranslatedSubTab = (child) => {
    switch (child.id) {
      case 'transactions': return t('nav.transactions', child.label);
      case 'reports': return t('nav.reports', child.label);
      case 'shifts': return t('nav.shifts.tab', child.label);
      case 'expenses': return t('nav.expenses', child.label);
      case 'products': return t('nav.products', child.label);
      case 'inventory': return t('nav.inventory', child.label);
      case 'central-kitchen': return t('nav.centralKitchen', child.label);
      case 'pos-devices':
      case 'kasir': return t('nav.posDevices', child.label);
      case 'kds': return t('nav.kds', child.label);
      case 'branches': return t('nav.branches', child.label);
      case 'staff': return t('nav.staff', child.label);
      case 'settings-profile': return t('nav.profile', child.label);
      case 'logs': return t('nav.logs', child.label);
      default: return child.label;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
          {t('help.title', 'Bantuan & Panduan')}
        </h1>
        <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
          {t('help.desc', 'Panduan singkat memakai Dashboard Owner dan cara menghubungi tim Strans.')}
        </p>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Menu Taxonomy & Features Guide (2 Cols) */}
        <Card className="lg:col-span-2 border-[var(--color-hairline)] shadow-2xs">
          <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
            <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[var(--color-brand-600)]" />
              <span>{language === 'en' ? 'What Each Menu Does' : 'Isi & Fungsi Tiap Menu'}</span>
            </CardTitle>
            <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
              {language === 'en' 
                ? 'Overview of features and actions available on each page.' 
                : 'Panduan fungsi dan alur kerja yang bisa dikerjakan di masing-masing halaman.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                  {getTranslatedGroupTitle(group.title)}
                </p>

                <div className="divide-y divide-[var(--color-hairline)] rounded-2xl border border-[var(--color-hairline)] overflow-hidden bg-[var(--card)]">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const itemLabel = getTranslatedItemLabel(item);

                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3.5 p-3.5 hover:bg-[var(--color-snow)] transition-colors cursor-pointer"
                        onClick={() => {
                          if (onNavigate) {
                            if (item.id === 'catalog') onNavigate('products');
                            else if (item.id === 'sales') onNavigate('transactions');
                            else if (item.id === 'shifts') onNavigate('shifts');
                            else if (item.id === 'kasir') onNavigate('kasir');
                            else if (item.id === 'wallet') onNavigate('wallet');
                            else if (item.id === 'vouchers') onNavigate('vouchers');
                            else if (item.id === 'outlets') onNavigate('branches');
                            else onNavigate(item.id);
                          }
                        }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)] shadow-2xs">
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--color-ink)]">
                              {itemLabel}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-slate-muted)]" />
                          </div>

                          <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5 leading-relaxed">
                            {item.description}
                          </p>

                          {item.children && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-[var(--color-slate-muted)]">
                                {language === 'en' ? 'Sub-tabs:' : 'Tab di dalamnya:'}
                              </span>
                              {item.children.map((child) => (
                                <Badge
                                  key={child.id}
                                  variant="outline"
                                  className="text-[9px] py-0 px-1.5 bg-[var(--card)] text-[var(--color-slate-body)]"
                                >
                                  {getTranslatedSubTab(child)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: Shortcuts, Contact & App Meta (1 Col) */}
        <div className="space-y-4">
          {/* Card 1: Keyboard Shortcuts */}
          <Card className="border-[var(--color-hairline)] shadow-2xs">
            <CardHeader className="p-4 sm:p-5 border-b border-[var(--color-hairline)]">
              <CardTitle className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[var(--color-brand-600)]" />
                <span>{language === 'en' ? 'Keyboard Shortcuts' : 'Pintasan Papan Ketik'}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-2.5">
              {[
                { keys: 'Ctrl + K', desc: language === 'en' ? 'Open Global Search' : 'Buka Pencarian Global' },
                { keys: '/', desc: language === 'en' ? 'Quick Search Focus' : 'Fokus Cepat Pencarian' },
                { keys: 'Esc', desc: language === 'en' ? 'Close Dialog / Panel' : 'Tutup dialog atau pop-up' },
                { keys: 'Tab', desc: language === 'en' ? 'Navigate controls' : 'Pindah antar kendali input' },
              ].map((sc, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-slate-muted)]">{sc.desc}</span>
                  <kbd className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-snow)] px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--color-slate-body)] shadow-2xs">
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Card 2: Contact Us / Customer Care */}
          <Card className="border-[var(--color-hairline)] shadow-2xs">
            <CardHeader className="p-4 sm:p-5 border-b border-[var(--color-hairline)]">
              <CardTitle className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-[var(--color-brand-600)]" />
                <span>{language === 'en' ? 'Contact Support' : 'Hubungi Tim Strans'}</span>
              </CardTitle>
              <CardDescription className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                {language === 'en' ? 'Mon–Sat, 09:00–18:00 WIB' : 'Jam kerja Senin–Sabtu, 09.00–18.00 WIB'}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-2.5">
              <Button
                onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`, '_blank')}
                className="w-full gap-2 text-xs font-bold cursor-pointer shadow-2xs"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp Official Support</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Bantuan%20Strans%20Space`}
                className="w-full gap-2 text-xs font-bold bg-[var(--card)] cursor-pointer shadow-2xs"
              >
                <Mail className="h-4 w-4" />
                <span>{SUPPORT_EMAIL}</span>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Subscription & Version Details */}
          <Card className="border-[var(--color-hairline)] shadow-2xs">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--color-slate-muted)]">
                  {language === 'en' ? 'Active Plan' : 'Paket Aktif'}
                </span>
                <Badge variant="brand" className="text-[10px] font-black">
                  👑 Juragan Space (AI)
                </Badge>
              </div>

              <div className="border-t border-[var(--color-hairline)] pt-2.5 flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--color-slate-muted)]">
                  {language === 'en' ? 'Dashboard Version' : 'Versi Dashboard'}
                </span>
                <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                  {APP_VERSION}
                </span>
              </div>

              <div className="border-t border-[var(--color-hairline)] pt-2.5 space-y-2">
                <a
                  href={POS_APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--color-brand-600)] hover:underline"
                >
                  <span>{language === 'en' ? 'Cashier POS App' : 'Aplikasi Kasir POS'}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <a
                  href={SITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--color-brand-600)] hover:underline"
                >
                  <span>stranspace.com</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
