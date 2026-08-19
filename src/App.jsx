import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Store,
  UserCheck,
  Mail,
  Lock,
  Building2,
  X,
  Sparkles
} from 'lucide-react';
import {
  getSession,
  clearSession,
  loginOwner,
  loginOwnerWithGoogle,
  registerOwner,
  resendVerification,
  getBranches,
  createBranch,
  setBranchActive,
  deleteBranch
} from './lib/api';
import { applyThemePalette, applyThemeMode, getSavedPreferences } from './lib/theme';
import { planRank, planLabel, branchLimitFor } from './lib/plans';
import { getRequiredPlanRank } from './lib/navigation';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './components/ui/dialog';
import { UpgradeRequired } from './components/layout/UpgradeRequired';

// Pages
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import ProductsPage from './pages/ProductsPage';
import OutletsPage from './pages/OutletsPage';
import StaffPage from './pages/StaffPage';
import ReportsPage from './pages/ReportsPage';
import ShiftsPage from './pages/ShiftsPage';
import InventoryPage from './pages/InventoryPage';
import CentralKitchenPage from './pages/CentralKitchenPage';
import LogsPage from './pages/LogsPage';
import VouchersPage from './pages/VouchersPage';
import ExpensesPage from './pages/ExpensesPage';
import KasirPage from './pages/KasirPage';
import KdsPage from './pages/KdsPage';
import SettingsPage from './pages/SettingsPage';
import WalletPage from './pages/WalletPage';
import HelpPage from './pages/HelpPage';
import { AICopilotWidget } from './components/ai/AICopilotWidget';
import Toast from './components/Toast';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SectionTabs } from './components/layout/SectionTabs';
import { MobileNav } from './components/layout/MobileNav';
import { GlobalSearch } from './components/layout/GlobalSearch';
import { StransLogo } from './components/ui/strans-logo';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export default function App() {
  // Session State
  const [session, setSession] = useState(getSession());
  const [activeTab, setActiveTab] = useState('overview');
  // Sub-tab awal untuk halaman yang punya sub-menu sendiri (settings, inventory, central-kitchen),
  // dipakai saat navigasi langsung dari GlobalSearch (id berformat "tab:subTab").
  const [pendingSubTab, setPendingSubTab] = useState(null);
  // Prompt upgrade paket, dipicu dari mana saja saat backend menolak request dgn
  // kode PLAN_UPGRADE_REQUIRED/BRANCH_LIMIT_REACHED/CASHIER_LIMIT_REACHED (lihat api.js).
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Search Palette State
  const [searchOpen, setSearchOpen] = useState(false);

  // Branch Selection State
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(
    localStorage.getItem('merchant_active_tenant_id') || 'all'
  );

  // Tambah cabang modal state
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [addBranchError, setAddBranchError] = useState('');
  const [branchResult, setBranchResult] = useState(null);

  // Toast stack state
  const [toasts, setToasts] = useState([]);
  const pushToast = (type, message) => {
    if (!message) return;
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const setSuccessMessage = (m) => pushToast('success', m);
  const setActionError = (m) => pushToast('error', m);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState(null);
  const confirmAction = (message, opts = {}) =>
    new Promise((resolve) => setConfirmState({ message, title: opts.title || 'Konfirmasi', confirmText: opts.confirmText || 'Ya, lanjutkan', danger: opts.danger !== false, resolve }));
  const resolveConfirm = (val) => { if (confirmState) confirmState.resolve(val); setConfirmState(null); };

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('owner.rasacoffee@gmail.com');
  const [loginPin, setLoginPin] = useState('123456');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Auth Mode & Register State
  const [authMode, setAuthMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('daftar') === '1' ? 'register' : 'login'; } catch { return 'login'; }
  });
  const [regBusiness, setRegBusiness] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [activationInfo, setActivationInfo] = useState(null);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyDismissed, setVerifyDismissed] = useState(false);

  // ESC & Shortcut listener
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (confirmState) resolveConfirm(false);
        if (activationInfo) setActivationInfo(null);
        if (addBranchOpen) setAddBranchOpen(false);
        if (searchOpen) setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, activationInfo, addBranchOpen, searchOpen]);

  // Apply saved theme on app load
  useEffect(() => {
    const prefs = getSavedPreferences();
    if (prefs.themeColor) applyThemePalette(prefs.themeColor);
    if (prefs.themeMode) applyThemeMode(prefs.themeMode);
  }, []);

  const reloadBranches = () => {
    if (session) {
      getBranches()
        .then(list => setBranches(Array.isArray(list) ? list : []))
        .catch(e => console.error('Failed to load branches:', e));
    }
  };

  useEffect(() => {
    reloadBranches();
  }, [session]);

  const isOwner = String(session?.cashier?.role || '').toLowerCase() === 'owner';

  const handleBranchChange = (branchId) => {
    setActiveBranchId(branchId);
    localStorage.setItem('merchant_active_tenant_id', branchId);
  };

  const openAddBranch = () => {
    setAddBranchError('');
    setNewBranchName('');
    setBranchResult(null);
    setAddBranchOpen(true);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const name = newBranchName.trim();
    if (!name) { setAddBranchError('Nama cabang wajib diisi.'); return; }
    setAddingBranch(true);
    setAddBranchError('');
    try {
      const resp = await createBranch(name);
      const b = resp?.data || {};
      setBranchResult({ name: b.name || name, code: b.activation_code || '', domain: b.domain || '', plan: b.subscription_plan || 'free' });
      setSuccessMessage(`Cabang "${b.name || name}" berhasil dibuat.`);
      reloadBranches();
    } catch (err) {
      setAddBranchError(err.message || 'Gagal membuat cabang baru.');
    } finally {
      setAddingBranch(false);
    }
  };

  const handleToggleBranchActive = async (branch) => {
    const nextState = !branch.is_active;
    try {
      await setBranchActive(branch.id, nextState);
      setSuccessMessage(`Cabang "${branch.name}" ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
      reloadBranches();
    } catch (err) {
      setActionError(err.message || 'Gagal mengubah status cabang.');
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (!(await confirmAction(`Hapus cabang "${branch.name}"? Seluruh data penjualan cabang ini akan dihapus permanen.`, { title: 'Hapus Cabang', confirmText: 'Ya, hapus cabang' }))) return;
    try {
      await deleteBranch(branch.id);
      setSuccessMessage(`Cabang "${branch.name}" berhasil dihapus.`);
      if (String(activeBranchId) === String(branch.id)) {
        handleBranchChange('all');
      }
      reloadBranches();
    } catch (err) {
      setActionError(err.message || 'Gagal menghapus cabang.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const resp = await loginOwner({ email: loginEmail, pin: loginPin });
      setSession(resp);
      setSuccessMessage(`Selamat datang kembali, ${resp.cashier.name}!`);
    } catch (err) {
      setLoginError(err.message || 'Gagal login. Pastikan email dan PIN benar.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    try {
      const resp = await registerOwner({
        businessName: regBusiness,
        ownerName: regOwner,
        email: regEmail,
        pin: regPin
      });
      setSession(resp);
      setActivationInfo({
        code: resp.tenant?.activation_code || 'STRANS-8821',
        businessName: resp.tenant?.name || regBusiness
      });
      setSuccessMessage('Pendaftaran berhasil! Akun toko Anda aktif.');
    } catch (err) {
      setRegError(err.message || 'Pendaftaran gagal.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setSuccessMessage('Anda telah keluar.');
  };

  // Setelah upgrade paket berhasil (lihat /api/subscription/upgrade), perbarui plan di
  // sesi aktif (state + localStorage) supaya seluruh UI (Sidebar, gate fitur) langsung
  // ikut berubah tanpa perlu login ulang.
  const updateSessionPlan = (newPlan) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updatedTenant = { ...prev.tenant, subscription_plan: newPlan };
      try { localStorage.setItem('merchant_tenant', JSON.stringify(updatedTenant)); } catch { /* ignore */ }
      return { ...prev, tenant: updatedTenant };
    });
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    try {
      await resendVerification();
      setSuccessMessage('Tautan verifikasi telah dikirim ke email Anda.');
    } catch (err) {
      setActionError(err.message || 'Gagal mengirim email verifikasi.');
    } finally {
      setResendingVerify(false);
    }
  };

  // Dipakai oleh Sidebar dan GlobalSearch (Cmd+K) untuk pindah tab, termasuk
  // deep-link langsung ke sub-tab, mis. "settings:security" atau "inventory:materials".
  const handleSelectTab = (rawId) => {
    const [tabId, subTab] = rawId.split(':');
    setPendingSubTab(subTab || null);
    if (tabId === 'catalog') setActiveTab('products');
    else if (tabId === 'sales') setActiveTab('transactions');
    else if (tabId === 'shifts') setActiveTab('shifts');
    else if (tabId === 'kasir') setActiveTab('kasir');
    else if (tabId === 'wallet') setActiveTab('wallet');
    else if (tabId === 'vouchers') setActiveTab('vouchers');
    else if (tabId === 'outlets') setActiveTab('branches');
    else setActiveTab(tabId);
  };

  // Paket langganan tenant yang sedang login — sumber kebenaran UI (nama paket,
  // kunci menu, dsb). Penegakan sesungguhnya tetap di backend.
  const currentPlan = session?.tenant?.subscription_plan;
  const currentPlanRank = planRank(currentPlan);
  const currentPlanLabel = planLabel(currentPlan);
  const currentBranchLimit = branchLimitFor(currentPlan);
  const branchLimitTag = currentBranchLimit === null
    ? `${branches.length > 0 ? branches.length : 1} Cabang (Tanpa batas)`
    : `${branches.length > 0 ? branches.length : 1}/${currentBranchLimit} Cabang`;

  // Tangkap sinyal upgrade-required dari mana saja (lihat SUBSCRIPTION-adjacent
  // handling di lib/api.js) supaya modal upgrade konsisten muncul di seluruh app,
  // tanpa perlu mengubah setiap catch block per halaman.
  useEffect(() => {
    const onPlanUpgradeRequired = (e) => setUpgradePrompt(e.detail);
    window.addEventListener('plan-upgrade-required', onPlanUpgradeRequired);
    return () => window.removeEventListener('plan-upgrade-required', onPlanUpgradeRequired);
  }, []);

  // -------------------------------------------------------------
  // RENDERING LOGIN / REGISTER
  // -------------------------------------------------------------
  if (!session) {
    return (
      <div className="flex min-h-screen bg-[var(--color-snow)] font-sans antialiased text-[var(--color-ink)]">
        {toasts.length > 0 && (
          <div className="fixed top-6 right-6 z-60 flex flex-col gap-2 max-w-sm">
            {toasts.map((t) => (
              <Toast key={t.id} id={t.id} type={t.type} message={t.message} duration={4000} onDismiss={dismissToast} />
            ))}
          </div>
        )}

        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[var(--color-brand-700)] via-[var(--color-brand-800)] to-[var(--color-brand-950)] text-white p-12 flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <StransLogo size="md" />
            <div className="mt-16 space-y-4 max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-300">
                ✨ Strans Space v2 Ekosistem Standalone
              </span>
              <h1 className="text-3xl font-black tracking-tight leading-tight">
                Kelola Seluruh Cabang & Laba Bersih dalam Satu Layar.
              </h1>
              <p className="text-sm text-emerald-100/80 leading-relaxed">
                Platform holding merchant terpadu: pantau kasir online, kalkulasi HPP resep otomatis, manajemen multi-outlet, dan mutasi saldo QRIS secara instan.
              </p>
            </div>
          </div>

          <div className="relative z-10 text-xs text-emerald-200/60 font-medium">
            © 2026 PT Strans Inovasi Indonesia • All Rights Reserved
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md space-y-6">
            <div className="lg:hidden mb-4">
              <StransLogo size="md" />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
                {authMode === 'login' ? 'Masuk ke Dashboard' : 'Daftar Akun Merchant'}
              </h2>
              <p className="text-xs text-[var(--color-slate-muted)] mt-1">
                {authMode === 'login' 
                  ? 'Gunakan email dan PIN keamanan akun owner untuk mengelola usaha.'
                  : 'Daftarkan usaha Anda gratis dalam 1 menit.'}
              </p>
            </div>

            <div className="flex rounded-2xl bg-slate-100 p-1 border border-[var(--color-hairline)]">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-[var(--color-brand-700)] shadow-xs' : 'text-[var(--color-slate-muted)]'}`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${authMode === 'register' ? 'bg-white text-[var(--color-brand-700)] shadow-xs' : 'text-[var(--color-slate-muted)]'}`}
              >
                Daftar Baru
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Email Owner</label>
                  <Input type="email" required placeholder="owner@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">PIN Keamanan</label>
                  <Input type="password" required placeholder="PIN 6 digit" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} />
                </div>
                <Button type="submit" disabled={loginLoading} className="w-full h-11 text-sm mt-4">
                  {loginLoading ? 'Memproses Masuk...' : 'Masuk ke Dashboard'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                {regError && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Toko / Bisnis</label>
                  <Input required placeholder="Contoh: Kopi Kupu" value={regBusiness} onChange={(e) => setRegBusiness(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Pemilik</label>
                  <Input required placeholder="Nama lengkap Anda" value={regOwner} onChange={(e) => setRegOwner(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Email</label>
                  <Input type="email" required placeholder="email@bisnis.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">PIN Keamanan (min 6 digit)</label>
                  <Input type="password" required minLength={6} placeholder="Buat PIN" value={regPin} onChange={(e) => setRegPin(e.target.value)} />
                </div>
                <Button type="submit" disabled={regLoading} className="w-full h-11 text-sm mt-4">
                  {regLoading ? 'Mendaftarkan...' : 'Daftar Gratis Sekarang'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN DASHBOARD SHELL
  // -------------------------------------------------------------
  return (
    <div className="flex h-screen bg-[var(--color-snow)] text-[var(--color-ink)] font-sans antialiased overflow-hidden select-none">
      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-60 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <Toast key={t.id} id={t.id} type={t.type} message={t.message} duration={4000} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-[var(--color-ink)]/50 backdrop-blur-xs p-4 animate-in fade-in" onClick={() => resolveConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${confirmState.danger ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-[var(--color-brand-600)]'}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[var(--color-ink)]">{confirmState.title}</h3>
            </div>
            <p className="mt-3 text-xs text-[var(--color-slate-body)] leading-relaxed">{confirmState.message}</p>
            <div className="mt-5 flex gap-2.5">
              <Button variant="outline" onClick={() => resolveConfirm(false)} className="flex-1">Batal</Button>
              <Button variant={confirmState.danger ? 'destructive' : 'default'} onClick={() => resolveConfirm(true)} className="flex-1">{confirmState.confirmText}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Prompt Dialog — dipicu global via event 'plan-upgrade-required' (lib/api.js) */}
      <Dialog open={!!upgradePrompt} onClose={() => setUpgradePrompt(null)} maxWidth="max-w-sm">
        <DialogHeader onClose={() => setUpgradePrompt(null)}>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-500" />
            Upgrade Paket
          </DialogTitle>
          <DialogDescription>
            {upgradePrompt?.requiredPlan ? `Fitur ini butuh paket ${upgradePrompt.requiredPlan}.` : 'Fitur ini butuh paket lebih tinggi.'}
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-[var(--color-slate-body)] leading-relaxed">{upgradePrompt?.message}</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setUpgradePrompt(null)}>Nanti dulu</Button>
          <Button onClick={() => { setUpgradePrompt(null); handleSelectTab('settings:plan'); }}>Lihat Paket Langganan</Button>
        </DialogFooter>
      </Dialog>

      {/* Sidebar Desktop */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleSelectTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        branchCount={branches.length > 0 ? branches.length : 2}
        planName={currentPlanLabel}
        planTag={branchLimitTag}
        planRank={currentPlanRank}
        onOpenUpgrade={() => handleSelectTab('settings:plan')}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Topbar Header */}
        <Topbar
          branches={branches}
          activeBranchId={activeBranchId}
          onSelectBranch={handleBranchChange}
          onOpenAddBranch={openAddBranch}
          session={session}
          onLogout={handleLogout}
          onSelectTab={handleSelectTab}
          onOpenUpgrade={() => handleSelectTab('settings:plan')}
          onToggleMobileNav={() => setMobileNavOpen(true)}
          planName={currentPlanLabel}
          planTag={branchLimitTag}
          planRank={currentPlanRank}
        />

        {/* Main Content Area with SectionTabs */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 scroll-slim">
          <div className="mx-auto max-w-[100rem]">
            {/* SectionTabs for subpages (e.g. Produk & Menu, Bahan & HPP) */}
            <SectionTabs
              currentTab={activeTab}
              onTabChange={(tabId) => setActiveTab(tabId)}
              planRank={currentPlanRank}
            />

            {/* Dynamic Pages */}
            {(activeTab === 'overview' || activeTab === 'dashboard') && (
              <DashboardPage
                activeBranchId={activeBranchId}
                branches={branches}
                session={session}
                onNavigate={(t) => setActiveTab(t)}
              />
            )}

            {(activeTab === 'products' || activeTab === 'menu-items') && (
              <ProductsPage
                activeBranchId={activeBranchId}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'inventory' || activeTab === 'inventory-raw') && (
              <InventoryPage
                activeBranchId={activeBranchId}
                session={session}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
                initialSubTab={pendingSubTab}
              />
            )}

            {(activeTab === 'central-kitchen' || activeTab === 'warehouse') && (
              currentPlanRank < getRequiredPlanRank('central-kitchen') ? (
                <UpgradeRequired
                  featureLabel="Gudang Pusat (Central Kitchen)"
                  requiredPlanLabel={planLabel('juragan')}
                  onOpenUpgrade={() => handleSelectTab('settings:plan')}
                />
              ) : (
                <CentralKitchenPage
                  setSuccessMessage={setSuccessMessage}
                  setActionError={setActionError}
                  initialSubTab={pendingSubTab}
                />
              )
            )}

            {(activeTab === 'transactions' || activeTab === 'sales' || activeTab === 'sales-history') && (
              <TransactionsPage
                activeBranchId={activeBranchId}
                branches={branches}
              />
            )}

            {(activeTab === 'reports' || activeTab === 'sales-reports') && (
              <ReportsPage
                activeBranchId={activeBranchId}
                branches={branches}
                setSuccessMessage={setSuccessMessage}
                onOpenUpgrade={() => handleSelectTab('settings:plan')}
              />
            )}

            {(activeTab === 'shifts' || activeTab === 'shifts-list') && (
              <ShiftsPage
                activeBranchId={activeBranchId}
                branches={branches}
                setSuccessMessage={setSuccessMessage}
              />
            )}

            {(activeTab === 'expenses' || activeTab === 'expenses-list') && (
              <ExpensesPage
                activeBranchId={activeBranchId}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'outlets' || activeTab === 'branches' || activeTab === 'branches-list') && (
              <OutletsPage
                branches={branches}
                session={session}
                onRefreshBranches={reloadBranches}
                onCreateBranch={handleCreateBranch}
                onDeleteBranch={handleDeleteBranch}
                setSuccessMessage={setSuccessMessage}
                setActionError={setActionError}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'staff' || activeTab === 'staff-list') && (
              <StaffPage
                activeBranchId={activeBranchId}
                session={session}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'kasir' || activeTab === 'pos-devices') && (
              <KasirPage
                activeBranchId={activeBranchId}
                branches={branches}
                session={session}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'kds') && (
              currentPlanRank < getRequiredPlanRank('kds') ? (
                <UpgradeRequired
                  featureLabel="Kitchen Display System (KDS)"
                  requiredPlanLabel={planLabel('juragan')}
                  onOpenUpgrade={() => handleSelectTab('settings:plan')}
                />
              ) : (
                <KdsPage
                  activeBranchId={activeBranchId}
                  branches={branches}
                  setSuccessMessage={setSuccessMessage}
                />
              )
            )}

            {(activeTab === 'wallet' || activeTab === 'wallet-settle') && (
              <WalletPage
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'vouchers') && (
              <VouchersPage
                activeBranchId={activeBranchId}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'settings' || activeTab === 'settings-profile') && (
              <SettingsPage
                activeBranchId={activeBranchId}
                branches={branches}
                session={session}
                onRefreshBranches={reloadBranches}
                setActionError={setActionError}
                setSuccessMessage={setSuccessMessage}
                initialSubTab={pendingSubTab}
                onPlanUpgraded={updateSessionPlan}
                confirmAction={confirmAction}
              />
            )}

            {(activeTab === 'logs' || activeTab === 'settings-logs') && (
              <LogsPage
                activeBranchId={activeBranchId}
                setActionError={setActionError}
              />
            )}

            {activeTab === 'help' && (
              <HelpPage onNavigate={(tabId) => setActiveTab(tabId)} />
            )}
          </div>
        </main>
      </div>

      {/* Permanent Fixed Juragan AI Strans Copilot Widget */}
      <AICopilotWidget />
    </div>
  );
}
