import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Store, 
  Shield, 
  Bell, 
  CreditCard, 
  Globe, 
  Sun, 
  Moon, 
  Monitor, 
  Check, 
  Sparkles, 
  Save, 
  TrendingUp, 
  Lock, 
  Crown,
  Building2,
  Phone,
  Percent,
  Receipt,
  Download,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { formatRupiah, formatRupiahShort, cn } from '../lib/utils';
import {
  THEME_PALETTES,
  applyThemePalette,
  applyThemeMode,
  getSavedPreferences
} from '../lib/theme';
import { useLanguage } from '../lib/language-context';
import { PLAN_CONFIG, planRank as getPlanRank, normalizePlan } from '../lib/plans';
import { upgradeSubscription, getPublicConfig, checkoutSubscription, getSubscriptionCheckoutStatus } from '../lib/api';
import { loadMidtransSnap } from '../lib/midtrans';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';

const SETTINGS_SUB_TABS = ['appearance', 'profile', 'security', 'notifications', 'plan'];

// Salinan marketing (harga & highlight fitur) — selaras dgn halaman harga publik
// strans-space.com/#harga. Terpisah dari PLAN_CONFIG (lib/plans.js) yang murni logika,
// supaya tampilan bisa berubah tanpa menyentuh definisi limit/rank.
const PLAN_DISPLAY = {
  rintis: {
    priceLabel: 'Rp0',
    priceNote: 'Gratis selamanya',
    highlights: ['1 Cabang & 1 Akun Kasir', 'Aplikasi Kasir POS (Web & Tablet)', 'Mode Offline', 'QRIS & Tunai'],
  },
  toko: {
    priceLabel: 'Rp47.000',
    priceNote: '/bulan',
    highlights: ['1 Cabang & hingga 3 Staf Kasir', 'Unlimited Produk & Transaksi', 'Struk Digital WhatsApp', 'Diskon, Promo & Pajak'],
  },
  cabang: {
    priceLabel: 'Rp143.000',
    priceNote: '/bulan (flat 3 cabang)',
    highlights: ['Hingga 3 Cabang (satu tagihan)', 'Resep & Potong Bahan Baku (HPP)', 'Laporan Laba Rugi Otomatis', '10 Akun Staf'],
  },
  juragan: {
    priceLabel: 'Rp279.000',
    priceNote: '/bulan',
    highlights: ['15+ Cabang & Unlimited Staf', 'Strans AI Daily WhatsApp Digest', 'Kitchen Display System & QR Meja', 'Gudang Pusat (Central Kitchen)'],
  },
};

export default function SettingsPage({
  activeBranchId,
  branches = [],
  session,
  onRefreshBranches,
  setActionError,
  setSuccessMessage,
  onPlanUpgraded,
  confirmAction,
  initialSubTab
}) {
  const { language, setLanguage, t } = useLanguage();
  const saved = getSavedPreferences();

  const [activeTab, setActiveTab] = useState('appearance'); // 'appearance' | 'profile' | 'security' | 'notifications' | 'plan'

  // Deep-link dari GlobalSearch (Cmd+K), mis. "settings:security".
  useEffect(() => {
    if (initialSubTab && SETTINGS_SUB_TABS.includes(initialSubTab)) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Preferences states
  const [colorMode, setColorMode] = useState(saved.themeMode || 'light'); // 'light' | 'dark' | 'system'
  const [selectedThemeColor, setSelectedThemeColor] = useState(saved.themeColor || 'emerald');

  // Business profile form states
  const [businessName, setBusinessName] = useState(saved.profile?.businessName || session?.tenant?.name || 'Kopi Kupu & Strans Coffee Holding');
  const [businessCategory, setBusinessCategory] = useState(saved.profile?.businessCategory || 'F&B — Kafe & Restoran');
  const [taxPb1, setTaxPb1] = useState(saved.profile?.taxPb1 || '10');
  const [serviceCharge, setServiceCharge] = useState(saved.profile?.serviceCharge || '5');
  const [businessEmail, setBusinessEmail] = useState(saved.profile?.businessEmail || 'owner@kopikupu.id');
  const [businessPhone, setBusinessPhone] = useState(saved.profile?.businessPhone || '0812-3456-7890');

  // Security and notification toggles
  const [toggles, setToggles] = useState(saved.toggles || {
    twoFactor: true,
    voidPin: true,
    autoAuditLock: true,
    lowStockAlert: true,
    voidAlert: true,
    dailyDigest: true
  });

  // Billing modal
  const [billingModalOpen, setBillingModalOpen] = useState(false);

  // Paket berlangganan aktif — sumber kebenaran dari sesi, bukan hardcode.
  const currentPlanSlug = normalizePlan(session?.tenant?.subscription_plan);
  const currentRank = getPlanRank(session?.tenant?.subscription_plan);
  const planLabelMap = Object.fromEntries(PLAN_CONFIG.map((p) => [p.slug, p.label]));
  const [upgradingPlan, setUpgradingPlan] = useState(null);

  const handleDowngradePlan = async (plan) => {
    const proceed = confirmAction
      ? await confirmAction(
          `Turunkan paket ke ${plan.label}? Fitur yang eksklusif di paket saat ini akan langsung terkunci, dan kuota cabang/staf akan mengikuti batas ${plan.label}.`,
          { title: 'Downgrade Paket', confirmText: 'Ya, downgrade', danger: true }
        )
      : window.confirm(`Turunkan paket ke ${plan.label}?`);
    if (!proceed) return;

    setUpgradingPlan(plan.slug);
    try {
      const resp = await upgradeSubscription(plan.slug, 1);
      onPlanUpgraded?.(resp?.data?.plan || plan.slug);
      setSuccessMessage?.(resp?.message || `Paket berhasil diturunkan ke ${plan.label}.`);
    } catch (err) {
      setActionError?.(err.message || 'Gagal mengubah paket langganan.');
    } finally {
      setUpgradingPlan(null);
    }
  };

  // Tunggu webhook Midtrans mengonfirmasi pembayaran (polling ringan sbg fallback kalau
  // popup Snap ditutup/redirect sebelum webhook sempat masuk).
  const pollCheckoutUntilPaid = async (reference, { attempts = 10, intervalMs = 2000 } = {}) => {
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      try {
        const resp = await getSubscriptionCheckoutStatus(reference);
        if (resp?.status === 'paid') return resp;
        if (['expired', 'cancelled'].includes(resp?.status)) return resp;
      } catch { /* tetap coba lagi sampai attempts habis */ }
    }
    return null;
  };

  const handleUpgradePlan = async (plan) => {
    setUpgradingPlan(plan.slug);
    try {
      const config = await getPublicConfig();
      if (!config?.midtransClientKey) {
        throw new Error('Pembayaran belum dikonfigurasi. Hubungi admin.');
      }
      await loadMidtransSnap(config.midtransClientKey, config.midtransIsProduction);

      const checkout = await checkoutSubscription(plan.slug, 1);
      const reference = checkout.paymentReference;

      window.snap.pay(checkout.token, {
        onSuccess: async () => {
          setSuccessMessage?.('Pembayaran diterima. Mengaktifkan paket...');
          const result = await pollCheckoutUntilPaid(reference);
          if (result?.status === 'paid') {
            onPlanUpgraded?.(result.plan);
            setSuccessMessage?.(`Paket berhasil diupgrade ke ${planLabelMap[result.plan] || result.plan}.`);
          } else {
            setSuccessMessage?.('Pembayaran sedang diproses. Refresh halaman ini sebentar lagi untuk melihat paket aktif.');
          }
          setUpgradingPlan(null);
        },
        onPending: async () => {
          setSuccessMessage?.('Menunggu konfirmasi pembayaran...');
          const result = await pollCheckoutUntilPaid(reference, { attempts: 5 });
          if (result?.status === 'paid') {
            onPlanUpgraded?.(result.plan);
            setSuccessMessage?.(`Paket berhasil diupgrade ke ${planLabelMap[result.plan] || result.plan}.`);
          } else {
            setActionError?.('Pembayaran masih tertunda. Paket akan aktif otomatis begitu pembayaran dikonfirmasi.');
          }
          setUpgradingPlan(null);
        },
        onError: () => {
          setActionError?.('Pembayaran gagal diproses.');
          setUpgradingPlan(null);
        },
        onClose: () => {
          setUpgradingPlan(null);
        },
      });
    } catch (err) {
      setActionError?.(err.message || 'Gagal memulai pembayaran.');
      setUpgradingPlan(null);
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    applyThemePalette(selectedThemeColor);
    applyThemeMode(colorMode);
  }, []);

  const handleSelectThemeColor = (colorId) => {
    setSelectedThemeColor(colorId);
    applyThemePalette(colorId);
    setSuccessMessage?.(`${t('settings.themeColor.label')}: ${THEME_PALETTES[colorId]?.name || colorId}`);
  };

  const handleSelectColorMode = (mode) => {
    setColorMode(mode);
    applyThemeMode(mode);
    setSuccessMessage?.(
      mode === 'dark'
        ? (language === 'en' ? 'Dark Mode activated' : 'Mode Gelap diaktifkan')
        : mode === 'light'
          ? (language === 'en' ? 'Light Mode activated' : 'Mode Terang diaktifkan')
          : (language === 'en' ? 'System Theme activated' : 'Mode Otomatis diaktifkan')
    );
  };

  const handleSelectLanguage = (lang) => {
    setLanguage(lang);
    setSuccessMessage?.(
      lang === 'en'
        ? 'Interface language changed to English!'
        : 'Bahasa antarmuka diubah ke Bahasa Indonesia!'
    );
  };

  const handleToggle = (key) => {
    setToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('strans_toggles', JSON.stringify(next));
      } catch {}
      setSuccessMessage?.(language === 'en' ? 'Setting updated successfully.' : 'Pengaturan berhasil diperbarui.');
      return next;
    });
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const profileData = {
      businessName,
      businessCategory,
      taxPb1,
      serviceCharge,
      businessEmail,
      businessPhone
    };
    try {
      localStorage.setItem('strans_profile', JSON.stringify(profileData));
    } catch {}
    setSuccessMessage?.(
      language === 'en'
        ? 'Business profile saved! Changes will reflect on all cashier receipts.'
        : 'Profil usaha berhasil disimpan! Perubahan tarif pajak & nama usaha otomatis aktif di seluruh struk kasir.'
    );
  };

  const navTabs = [
    {
      id: 'appearance',
      label: t('settings.tab.appearance', 'Tampilan & Bahasa'),
      icon: Palette,
      description: 'Mode terang/gelap, warna tema, dan pilihan bahasa.'
    },
    {
      id: 'profile',
      label: t('settings.tab.profile', 'Profil Usaha'),
      icon: Store,
      description: 'Informasi bisnis, kategori usaha, dan pajak PB1.'
    },
    {
      id: 'security',
      label: t('settings.tab.security', 'Keamanan & Otorisasi'),
      icon: Shield,
      description: 'Verifikasi 2 langkah dan PIN supervisor pembatalan.'
    },
    {
      id: 'notifications',
      label: t('settings.tab.notifications', 'Notifikasi & Rekap AI'),
      icon: Bell,
      description: 'Peringatan stok menipis, void kasir, dan ringkasan harian.'
    },
    {
      id: 'plan',
      label: t('settings.tab.plan', 'Paket Berlangganan'),
      icon: CreditCard,
      description: 'Batas outlet, lisensi staf, dan rincian paket aktif.'
    }
  ];

  const currentTheme = THEME_PALETTES[selectedThemeColor] || THEME_PALETTES.emerald;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header matching Strans Space v2 */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
          {t('settings.title', 'Pengaturan')}
        </h1>
        <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
          {t('settings.desc', 'Profil usaha, pajak, tampilan antarmuka, keamanan, dan notifikasi holding.')}
        </p>
      </div>

      {/* 2. Main 2-Column Grid: Left Vertical Sub-menu + Right Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left Sub-menu Navigation */}
        <nav aria-label="Sub menu pengaturan" className="space-y-1">
          <div className="flex flex-row overflow-x-auto pb-2 scroll-slim lg:flex-col lg:pb-0 lg:space-y-1.5">
            {navTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-xs font-bold transition-all cursor-pointer',
                    isActive
                      ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                      : 'text-[var(--color-slate-body)] hover:bg-[var(--color-snow)] hover:text-[var(--color-ink)]'
                  )}
                >
                  <TabIcon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-white' : 'text-[var(--color-brand-600)]'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{tab.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right Tab Content */}
        <div className="min-w-0 space-y-5">
          {/* TAB 1: TAMPILAN & BAHASA */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              {/* Bahasa & Wilayah Card */}
              <Card className="border-[var(--color-hairline)] shadow-2xs">
                <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                  <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[var(--color-brand-600)]" />
                    <span>{t('settings.language.title', 'Bahasa & Wilayah')}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                    {t('settings.language.desc', 'Pilih bahasa tampilan untuk antarmuka dashboard dan struk kasir.')}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { value: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩', hint: 'Bahasa bawaan sistem antarmuka' },
                      { value: 'en', label: 'English (US)', flag: '🇬🇧', hint: 'English interface and receipts' },
                    ].map((lang) => {
                      const isSelected = language === lang.value;
                      return (
                        <button
                          key={lang.value}
                          type="button"
                          onClick={() => handleSelectLanguage(lang.value)}
                          className={cn(
                            'flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition-all cursor-pointer',
                            isSelected
                              ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]/60 text-[var(--color-ink)] shadow-2xs'
                              : 'border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-ink)] hover:bg-[var(--color-snow)]'
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-bold text-xs text-[var(--color-ink)]">
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                            </span>
                            {isSelected && <Badge variant="brand" className="text-[10px] px-1.5 py-0">{t('common.active', 'Aktif')}</Badge>}
                          </div>
                          <span className="text-[11px] text-[var(--color-slate-muted)]">{lang.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Mode Tampilan & Tema Warna Card */}
              <Card className="border-[var(--color-hairline)] shadow-2xs">
                <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                  <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                    <Palette className="h-4 w-4 text-[var(--color-brand-600)]" />
                    <span>{t('settings.theme.title', 'Tampilan & Tema Warna')}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                    {t('settings.theme.desc', 'Sesuaikan mode terang/gelap dan palet warna merek favorit Anda.')}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  {/* Mode Tampilan (Light/Dark) */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)] mb-2.5">
                      {language === 'en' ? 'Display Mode' : 'Mode Tampilan'}
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {[
                        { value: 'light', label: t('settings.mode.light', 'Terang'), icon: Sun, hint: language === 'en' ? 'Best for daytime' : 'Paling jelas di ruangan kasir' },
                        { value: 'dark', label: t('settings.mode.dark', 'Gelap'), icon: Moon, hint: language === 'en' ? 'Comfortable for night' : 'Nyaman untuk tutup buku malam' },
                        { value: 'system', label: t('settings.mode.system', 'Ikuti Perangkat'), icon: Monitor, hint: language === 'en' ? 'Matches OS preference' : 'Otomatis sesuai tablet/laptop' }
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = colorMode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectColorMode(opt.value)}
                            className={cn(
                              'flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-all cursor-pointer',
                              isSelected
                                ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]/60 text-[var(--color-ink)] shadow-2xs'
                                : 'border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-ink)] hover:bg-[var(--color-snow)]'
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <Icon className="h-4 w-4 text-[var(--color-brand-600)]" />
                              {isSelected && <Badge variant="brand" className="text-[9px] px-1 py-0">{t('common.active', 'Aktif')}</Badge>}
                            </div>
                            <span className="text-xs font-bold text-[var(--color-ink)] mt-1">{opt.label}</span>
                            <span className="text-[10px] text-[var(--color-slate-muted)]">{opt.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Warna Utama Tema + Live Visual Preview Box */}
                  <div className="pt-4 border-t border-[var(--color-hairline)]">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)] mb-2.5">
                      {t('settings.themeColor.label', 'Warna Utama Tema (Theme Color)')}
                    </h4>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Swatches pilihan warna */}
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--color-slate-muted)]">
                          {language === 'en'
                            ? 'Select an accent color to update highlights across all buttons and charts:'
                            : 'Pilih warna utama untuk mengubah warna aksen di seluruh tombol dan grafik dashboard:'}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {Object.values(THEME_PALETTES).map((themeOpt) => {
                            const isSelected = selectedThemeColor === themeOpt.id;
                            return (
                              <button
                                key={themeOpt.id}
                                type="button"
                                onClick={() => handleSelectThemeColor(themeOpt.id)}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-all cursor-pointer',
                                  isSelected
                                    ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]/60 text-[var(--color-ink)] font-bold shadow-2xs'
                                    : 'border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-ink)] hover:bg-[var(--color-snow)]'
                                )}
                              >
                                <span
                                  className="h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: themeOpt.colorHex }}
                                />
                                <span className="text-xs text-[var(--color-ink)] truncate flex-1 font-semibold">
                                  {themeOpt.name}
                                </span>
                                {isSelected && <Check className="h-4 w-4 text-[var(--color-brand-600)]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Kotak Pratinjau Visual (Live Mini UI Preview Box) */}
                      <div className="rounded-2xl border-2 border-[var(--color-brand-400)]/40 bg-[var(--color-snow)] p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink)]">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span>{t('settings.preview.title', 'Kotak Pratinjau Tema UI (Live)')}</span>
                          </span>
                          <span
                            className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-2xs"
                            style={{ backgroundColor: currentTheme.colorHex }}
                          >
                            {t('settings.preview.badge', 'Aksen Aktif')}
                          </span>
                        </div>

                        {/* Mini Dashboard Card Component */}
                        <div className="space-y-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--card)] p-3 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                                {language === 'en' ? 'Today Total Sales' : 'Total Penjualan Hari Ini'}
                              </p>
                              <p className="text-sm font-black text-[var(--color-ink)] mt-0.5">
                                Rp 12.450.000
                              </p>
                            </div>
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: currentTheme.colorHex }}
                            >
                              <TrendingUp className="h-3 w-3" /> +15.4%
                            </span>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-[var(--color-slate-muted)]">
                              <span>Target Outlet Cisauk</span>
                              <span className="font-bold text-[var(--color-ink)]">85%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: '85%', backgroundColor: currentTheme.colorHex }}
                              />
                            </div>
                          </div>

                          {/* Mini Buttons Sample */}
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              className="h-7 text-[11px] px-3 font-bold text-white rounded-xl shadow-2xs transition-transform active:scale-95 cursor-pointer"
                              style={{ backgroundColor: currentTheme.colorHex }}
                            >
                              {language === 'en' ? 'Primary Button' : 'Tombol Utama'}
                            </button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-3 bg-[var(--card)]">
                              {language === 'en' ? 'Secondary' : 'Sekunder'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: PROFIL USAHA */}
          {activeTab === 'profile' && (
            <Card className="border-[var(--color-hairline)] shadow-2xs">
              <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <Store className="h-4 w-4 text-[var(--color-brand-600)]" />
                  <span>{t('settings.profile.title', 'Profil Usaha & Pengaturan Kasir')}</span>
                </CardTitle>
                <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                  {t('settings.profile.desc', 'Informasi bisnis yang tercetak di struk belanja pelanggan dan laporan resmi.')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.name', 'Nama Usaha / Brand')}
                      </label>
                      <Input
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.category', 'Kategori Usaha')}
                      </label>
                      <Input
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.tax', 'Pajak Restoran PB1 (%)')}
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={taxPb1}
                          onChange={(e) => setTaxPb1(e.target.value)}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-[var(--color-slate-muted)] font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--color-slate-muted)] mt-1">
                        {language === 'en' ? 'Commonly 10% in most F&B jurisdictions.' : 'Umumnya 10% di sebagian besar daerah F&B.'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.service', 'Biaya Layanan / Service Charge (%)')}
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={serviceCharge}
                          onChange={(e) => setServiceCharge(e.target.value)}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-[var(--color-slate-muted)] font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--color-slate-muted)] mt-1">
                        {language === 'en' ? 'Set to 0 if no service charge is applied.' : 'Isi 0 jika tidak memungut biaya layanan.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.email', 'Email Resmi Usaha')}
                      </label>
                      <Input
                        type="email"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                        {t('settings.profile.phone', 'Nomor Kontak WhatsApp Toko')}
                      </label>
                      <Input
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-[var(--color-hairline)]">
                    <Button type="submit" className="gap-1.5 shadow-2xs cursor-pointer">
                      <Save className="h-3.5 w-3.5" />
                      <span>{t('common.save', 'Simpan Perubahan')}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: KEAMANAN & OTORISASI */}
          {activeTab === 'security' && (
            <Card className="border-[var(--color-hairline)] shadow-2xs">
              <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--color-brand-600)]" />
                  <span>{t('settings.security.title', 'Keamanan & Otorisasi Kasir')}</span>
                </CardTitle>
                <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                  {t('settings.security.desc', 'Aturan otorisasi pembatalan dan akses login yang berlaku untuk seluruh outlet.')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 divide-y divide-[var(--color-hairline)]">
                <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink)] block">
                      {t('settings.security.twoFactor', 'Verifikasi Dua Langkah (2FA)')}
                    </label>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.security.twoFactorDesc', 'Kirim kode OTP sekali pakai lewat surel/WhatsApp setiap kali masuk ke dashboard holding.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.twoFactor}
                    onCheckedChange={() => handleToggle('twoFactor')}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3.5">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink)] block">
                      {t('settings.security.voidPin', 'PIN Supervisor untuk Pembatalan (Void)')}
                    </label>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.security.voidPinDesc', 'Kasir tidak bisa membatalkan transaksi tanpa input PIN otorisasi manajer/supervisor toko.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.voidPin}
                    onCheckedChange={() => handleToggle('voidPin')}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3.5 last:pb-0">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink)] block">
                      {t('settings.security.auditLock', 'Kunci Audit Log Aktivitas Anti-Fraud AI')}
                    </label>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.security.auditLockDesc', 'Rekam setiap perubahan harga manual dan diskon kasir ke dalam log audit trail holding.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.autoAuditLock}
                    onCheckedChange={() => handleToggle('autoAuditLock')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: NOTIFIKASI & REKAP AI */}
          {activeTab === 'notifications' && (
            <Card className="border-[var(--color-hairline)] shadow-2xs">
              <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--color-brand-600)]" />
                  <span>{t('settings.notifications.title', 'Notifikasi & Rekap Penjualan AI')}</span>
                </CardTitle>
                <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                  {t('settings.notifications.desc', 'Pilih kabar dan sinyal bahaya apa saja yang perlu langsung dikirim ke WhatsApp Anda.')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 divide-y divide-[var(--color-hairline)]">
                <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink)] block">
                      {t('settings.notifications.stock', 'Peringatan Stok Bahan Baku Menipis')}
                    </label>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.notifications.stockDesc', 'Muncul dan dikirim ke bot Telegram saat sisa bahan di cabang turun di bawah batas minimum.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.lowStockAlert}
                    onCheckedChange={() => handleToggle('lowStockAlert')}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3.5">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink)] block">
                      {t('settings.notifications.void', 'Pemberitahuan Transaksi Void Seketika')}
                    </label>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.notifications.voidDesc', 'Setiap ada transaksi yang dibatalkan oleh kasir langsung dilaporkan detik itu juga.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.voidAlert}
                    onCheckedChange={() => handleToggle('voidAlert')}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3.5 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[var(--color-ink)]">
                        {t('settings.notifications.digest', 'Rekap Harian Tutup Buku Otomatis via AI')}
                      </label>
                      <Badge variant="brand" className="text-[9px] px-1.5 py-0">Juragan AI</Badge>
                    </div>
                    <p className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.notifications.digestDesc', 'Ringkasan omset bersih, P&L harian, dan analisis produk terlaris dikirim setiap pukul 22.00.')}
                    </p>
                  </div>
                  <Switch
                    checked={toggles.dailyDigest}
                    onCheckedChange={() => handleToggle('dailyDigest')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: PAKET BERLANGGANAN */}
          {activeTab === 'plan' && (
            <Card className="border-[var(--color-hairline)] shadow-2xs">
              <CardHeader className="p-5 border-b border-[var(--color-hairline)]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span>{t('settings.plan.title', 'Paket Berlangganan')}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-[var(--color-slate-muted)] mt-0.5">
                      {t('settings.plan.desc', 'Pilih paket sesuai kebutuhan bisnis Anda. Upgrade langsung aktif untuk seluruh cabang.')}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setBillingModalOpen(true)}
                    className="text-xs bg-[var(--card)] cursor-pointer gap-1.5 shadow-2xs shrink-0"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('settings.plan.invoices', 'Rincian Tagihan')}</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {PLAN_CONFIG.map((plan) => {
                    const display = PLAN_DISPLAY[plan.slug];
                    const isCurrent = plan.slug === currentPlanSlug;
                    const isLower = plan.rank < currentRank;
                    const isUpgrading = upgradingPlan === plan.slug;

                    return (
                      <div
                        key={plan.slug}
                        className={cn(
                          'flex flex-col rounded-2xl border p-4 space-y-3',
                          isCurrent
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] ring-1 ring-[var(--color-brand-200)]'
                            : 'border-[var(--color-hairline)] bg-[var(--card)]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-[var(--color-ink)]">{plan.label}</span>
                          {isCurrent && (
                            <Badge variant="brand" className="text-[10px] px-1.5 py-0.5">
                              {language === 'en' ? 'Active' : 'Aktif'}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <span className="text-lg font-black text-[var(--color-ink)]">{display.priceLabel}</span>
                          <span className="ml-1 text-[11px] text-[var(--color-slate-muted)]">{display.priceNote}</span>
                        </div>

                        <ul className="flex-1 space-y-1.5 text-[11px] text-[var(--color-slate-body)]">
                          {display.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 shrink-0 mt-0.5 text-[var(--color-brand-600)]" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>

                        {isCurrent ? (
                          <Button variant="outline" disabled className="w-full text-xs">
                            {language === 'en' ? 'Current Plan' : 'Paket Aktif'}
                          </Button>
                        ) : isLower && plan.rank === 0 ? (
                          <Button
                            variant="outline"
                            disabled
                            title={language === 'en' ? 'Cancelling to the free plan needs support' : 'Downgrade ke paket gratis perlu bantuan support'}
                            className="w-full text-xs opacity-60"
                          >
                            {language === 'en' ? 'Contact support' : 'Hubungi support'}
                          </Button>
                        ) : isLower ? (
                          <Button
                            variant="outline"
                            onClick={() => handleDowngradePlan(plan)}
                            disabled={upgradingPlan !== null}
                            className="w-full text-xs"
                          >
                            {isUpgrading
                              ? (language === 'en' ? 'Processing...' : 'Memproses...')
                              : (language === 'en' ? `Downgrade to ${plan.label}` : `Downgrade ke ${plan.label}`)}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUpgradePlan(plan)}
                            disabled={upgradingPlan !== null}
                            className="w-full text-xs"
                          >
                            {isUpgrading
                              ? (language === 'en' ? 'Processing...' : 'Memproses...')
                              : (language === 'en' ? `Upgrade to ${plan.label}` : `Upgrade ke ${plan.label}`)}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL: Billing & Invoices Dialog */}
      <Dialog open={billingModalOpen} onClose={() => setBillingModalOpen(false)} maxWidth="max-w-lg">
        <DialogHeader onClose={() => setBillingModalOpen(false)}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-2xs">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                {language === 'en' ? 'Billing & License' : 'Rincian Tagihan & Lisensi'}
              </DialogTitle>
              <DialogDescription>
                {language === 'en' ? 'Payment invoices for your Strans Space license.' : 'Riwayat pembayaran faktur paket Strans Space Anda.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogContent className="space-y-4 pt-4 text-xs">
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-snow)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-ink)]">
                {PLAN_CONFIG.find((p) => p.slug === currentPlanSlug)?.label}
              </span>
              <Badge variant="success" className="text-[10px]">
                {language === 'en' ? 'Active' : 'Aktif'}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--color-slate-muted)]">
              Multi-Outlet Unlimited • AI Fraud Guard • Central Kitchen Module • Instant Payouts
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-[var(--color-ink)] uppercase tracking-wider mb-2">
              {language === 'en' ? 'Payment Invoice History' : 'Riwayat Faktur Pembayaran'}
            </h4>
            <div className="border border-[var(--color-hairline)] rounded-xl overflow-hidden divide-y divide-[var(--color-hairline)]">
              <div className="p-3 flex items-center justify-between bg-[var(--card)] hover:bg-[var(--color-snow)] transition-colors">
                <div>
                  <p className="font-bold text-xs text-[var(--color-ink)]">INV-STRANS-2026-0816</p>
                  <p className="text-[10px] text-[var(--color-slate-muted)]">
                    {language === 'en' ? '16 Aug 2026 • QRIS / VA Payment' : '16 Agu 2026 • Pembayaran QRIS / VA'}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="font-black text-xs text-[var(--color-ink)]">Rp 3.588.000</p>
                    <Badge variant="success" className="text-[9px] px-1 py-0">
                      {language === 'en' ? 'Paid' : 'Lunas'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSuccessMessage?.(
                        language === 'en'
                          ? 'PDF Invoice INV-STRANS-2026-0816 ready to download!'
                          : 'Faktur PDF INV-STRANS-2026-0816 siap diunduh!'
                      );
                    }}
                    className="h-7 text-[10px] gap-1 bg-[var(--card)]"
                  >
                    <Download className="h-3 w-3" />
                    <span>{language === 'en' ? 'Invoice' : 'Faktur'}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button onClick={() => setBillingModalOpen(false)}>
            {language === 'en' ? 'Close' : 'Tutup'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
