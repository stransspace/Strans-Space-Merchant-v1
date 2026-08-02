import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  BarChart3, 
  Layers, 
  History, 
  Ticket, 
  Coins, 
  Settings, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Store,
  ChevronRight,
  UserCheck,
  Mail,
  Lock,
  Plus,
  Building2,
  X,
  Power,
  Trash2,
  Wallet
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

// Pages
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import StaffPage from './pages/StaffPage';
import ReportsPage from './pages/ReportsPage';
import InventoryPage from './pages/InventoryPage';
import LogsPage from './pages/LogsPage';
import VouchersPage from './pages/VouchersPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import WalletPage from './pages/WalletPage';
import Toast from './components/Toast';

export default function App() {
  // Session State
  const [session, setSession] = useState(getSession());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [impersonating, setImpersonating] = useState(false);
  // Pesan bila sesi barusan diblokir (langganan ditangguhkan/berakhir). Dibaca sekali.
  const [authBlockNotice, setAuthBlockNotice] = useState(() => {
    if (typeof window === 'undefined') return '';
    const m = sessionStorage.getItem('authBlockMessage');
    if (m) sessionStorage.removeItem('authBlockMessage');
    return m || '';
  });

  // Branch Selection State
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(
    localStorage.getItem('merchant_active_tenant_id') || 'all'
  );
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  // Tambah cabang mandiri (owner). branchResult menyimpan hasil sukses (kode aktivasi).
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [addBranchError, setAddBranchError] = useState('');
  const [branchResult, setBranchResult] = useState(null); // { name, code, domain, plan }

  // Loading & Action States
  const [loading, setLoading] = useState(false);
  // Antrean toast (stack): banyak notifikasi bisa tampil bertumpuk tanpa saling menimpa.
  // API lama setSuccessMessage(msg)/setActionError(msg) dipertahankan agar semua pemanggil tetap jalan.
  const [toasts, setToasts] = useState([]);
  const pushToast = (type, message) => {
    if (!message) return;
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const setSuccessMessage = (m) => pushToast('success', m);
  const setActionError = (m) => pushToast('error', m);
  // Dialog konfirmasi berstyle (pengganti window.confirm native). Berbasis Promise:
  // `await confirmAction('pesan', { danger:true })` -> true/false.
  const [confirmState, setConfirmState] = useState(null);
  const confirmAction = (message, opts = {}) =>
    new Promise((resolve) => setConfirmState({ message, title: opts.title || 'Konfirmasi', confirmText: opts.confirmText || 'Ya, lanjutkan', danger: opts.danger !== false, resolve }));
  const resolveConfirm = (val) => { if (confirmState) confirmState.resolve(val); setConfirmState(null); };

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('owner.rasacoffee@gmail.com');
  const [loginPin, setLoginPin] = useState('123456');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Auth Mode & Register Form State ('login' | 'register'). Landing bisa mengarahkan
  // langsung ke tab daftar via ?daftar=1.
  const [authMode, setAuthMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('daftar') === '1' ? 'register' : 'login'; } catch { return 'login'; }
  });
  const [regBusiness, setRegBusiness] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [activationInfo, setActivationInfo] = useState(null); // {code, domain} setelah daftar
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyDismissed, setVerifyDismissed] = useState(false);

  // Tekan ESC untuk menutup modal teratas (konfirmasi / info aktivasi).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmState) { resolveConfirm(false); return; }
      if (activationInfo) setActivationInfo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, activationInfo]);

  const reloadBranches = () => {
    if (session) {
      getBranches()
        .then(list => setBranches(Array.isArray(list) ? list : []))
        .catch(e => console.error('Failed to load branches:', e));
    }
  };

  const isOwner = String(session?.cashier?.role || '').toLowerCase() === 'owner';

  const openAddBranch = () => {
    setAddBranchError('');
    setNewBranchName('');
    setBranchResult(null);
    setAddBranchOpen(true);
    setBranchDropdownOpen(false);
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
      reloadBranches();
      setSuccessMessage(resp?.message || 'Cabang berhasil ditambahkan.');
    } catch (err) {
      // Kuota paket penuh → arahkan ke upgrade, bukan error mentah.
      if (err?.data?.code === 'BRANCH_LIMIT_REACHED') {
        setAddBranchError(err.message);
      } else {
        setAddBranchError(err.message || 'Gagal menambah cabang.');
      }
    } finally {
      setAddingBranch(false);
    }
  };

  const handleToggleBranchActive = async (b) => {
    const willActivate = Number(b.is_active) !== 1;
    const ok = await confirmAction(
      willActivate
        ? `Aktifkan kembali cabang "${b.name}"? Kasir cabang ini bisa login lagi.`
        : `Nonaktifkan cabang "${b.name}"? Kasir cabang ini tidak bisa login sampai diaktifkan lagi.`,
      { title: willActivate ? 'Aktifkan Cabang' : 'Nonaktifkan Cabang', confirmText: willActivate ? 'Ya, aktifkan' : 'Ya, nonaktifkan', danger: !willActivate }
    );
    if (!ok) return;
    try {
      const resp = await setBranchActive(b.id, willActivate);
      reloadBranches();
      setSuccessMessage(resp?.message || 'Status cabang diperbarui.');
    } catch (err) {
      setActionError(err.message || 'Gagal mengubah status cabang.');
    }
  };

  const handleDeleteBranch = async (b) => {
    const ok = await confirmAction(
      `Hapus cabang "${b.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      { title: 'Hapus Cabang', confirmText: 'Ya, hapus', danger: true }
    );
    if (!ok) return;
    try {
      const resp = await deleteBranch(b.id);
      // Bila cabang yang dihapus sedang aktif dipilih, kembali ke tampilan Semua Cabang.
      if (String(activeBranchId) === String(b.id)) handleBranchChange('all');
      reloadBranches();
      setSuccessMessage(resp?.message || 'Cabang dihapus.');
    } catch (err) {
      // Pesan spesifik (mis. masih ada kasir) sudah ada di err.message.
      setActionError(err.message || 'Gagal menghapus cabang.');
    }
  };

  useEffect(() => {
    if (session) {
      setActiveBranchId(localStorage.getItem('merchant_active_tenant_id') || String(session.tenant?.id || ''));
      reloadBranches();
    } else {
      setBranches([]);
      setActiveBranchId('');
    }
  }, [session]);

  const activeBranch = activeBranchId === 'all' ? null : (branches.find(b => String(b.id) === String(activeBranchId)) || (session ? session.tenant : null));

  // Gating paket (mirror server enforcePlanAccess). Tier: free/basic(0) < standard(1) < premium(2).
  const currentPlan = String(activeBranch?.subscription_plan || session?.tenant?.subscription_plan || 'free').toLowerCase();
  const planRank = ['premium', 'enterprise'].includes(currentPlan) ? 2 : currentPlan === 'standard' ? 1 : 0;
  const tabMinPlan = { inventory: 1, vouchers: 1, expenses: 1, logs: 2 }; // sisanya (dashboard/products/staff/reports/settings) = semua paket
  const canTab = (tab) => planRank >= (tabMinPlan[tab] || 0);

  // Bila tab aktif tak diizinkan paket saat ini (mis. setelah ganti cabang), balik ke Ringkasan.
  useEffect(() => {
    if (session && !canTab(activeTab)) setActiveTab('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, activeTab, currentPlan]);


  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPin) {
      setLoginError('Email dan PIN wajib diisi');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const result = await loginOwner({
        email: loginEmail,
        pin: loginPin
      });
      setSession(result);
      setSuccessMessage('Login Berhasil! Selamat Datang.');
    } catch (err) {
      setLoginError(err.message || 'Gagal login. Cek kredensial Anda.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!regBusiness || !regOwner || !regEmail || !regPin) {
      setRegError('Semua field wajib diisi.');
      return;
    }
    if (regPin.length < 6) {
      setRegError('PIN minimal 6 karakter.');
      return;
    }
    setRegLoading(true);
    try {
      const result = await registerOwner({
        businessName: regBusiness,
        ownerName: regOwner,
        email: regEmail,
        pin: regPin,
      });
      // Auto-login: setSession sudah dilakukan di api; set state sesi + tampilkan kode aktivasi.
      setActivationInfo({ code: result.activationCode, domain: result.tenant?.domain });
      setSession({ cashier: result.cashier, tenant: result.tenant });
      setSuccessMessage('Pendaftaran berhasil! Selamat datang di STRANS.');
    } catch (err) {
      setRegError(err.message || 'Gagal mendaftar.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    try {
      const r = await resendVerification();
      if (r?.already) {
        setSession(prev => prev ? { ...prev, cashier: { ...prev.cashier, email_verified: 1 } } : prev);
        setSuccessMessage('Email Anda sudah terverifikasi.');
      } else {
        setSuccessMessage('Email verifikasi dikirim ulang. Cek inbox/spam Anda.');
      }
    } catch (err) {
      setActionError(err.message || 'Gagal mengirim ulang verifikasi.');
    } finally {
      setResendingVerify(false);
    }
  };

  // Tandai email terverifikasi bila user kembali dari tautan verifikasi (?verified=1).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === '1') {
        setSession(prev => {
          if (!prev) return prev;
          const updated = { ...prev, cashier: { ...prev.cashier, email_verified: 1 } };
          try { localStorage.setItem('merchant_cashier', JSON.stringify(updated.cashier)); } catch { /* noop */ }
          return updated;
        });
        setSuccessMessage('Email berhasil diverifikasi. Terima kasih!');
        params.delete('verified');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
      }
    } catch { /* noop */ }
  }, []);

  // Google Sign-In Integration
  const handleGoogleLoginCallback = async (response) => {
    const idToken = response.credential;
    setLoginLoading(true);
    setLoginError('');
    try {
      const result = await loginOwnerWithGoogle({
        credential: idToken,
        tenantDomain: null
      });
      if (result && result.cashier) {
        setSession(result);
        setSuccessMessage('Login Berhasil dengan Google! Selamat Datang.');
      } else {
        throw new Error('Gagal login Google.');
      }
    } catch (err) {
      setLoginError(err.message || 'Gagal login Google. Cek apakah email Anda terdaftar.');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    if (!session) {
      const initGoogle = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1008719970978-hb24n2q4kg7g11629jha2h3841139401.apps.googleusercontent.com',
            callback: handleGoogleLoginCallback,
          });
          const btn = document.getElementById('google-signin-btn');
          if (btn) {
            window.google.accounts.id.renderButton(btn, {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'pill',
              logo_alignment: 'center',
              // Google caps the button width at 400px; requesting more leaves a gap
              width: Math.min(btn.clientWidth || 320, 400)
            });
          }
        }
      };

      if (window.google) {
        initGoogle();
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      }
    }
  }, [session]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setActiveTab('dashboard');
  };

  const handleBranchChange = (branchId) => {
    localStorage.setItem('merchant_active_tenant_id', branchId);
    setActiveBranchId(branchId);
    setSuccessMessage('Cabang aktif berhasil diubah.');
  };

  // Login Screen Component
  if (!session) {
    return (
      <div className="min-h-screen lg:grid lg:grid-cols-2 bg-white font-sans">
        {authBlockNotice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
              <span className="text-lg leading-none">⚠️</span>
              <div className="flex-1 text-sm text-amber-800 font-semibold">{authBlockNotice}</div>
              <button onClick={() => setAuthBlockNotice('')} className="text-amber-500 hover:text-amber-700 font-bold">✕</button>
            </div>
          </div>
        )}

        {/* Left: Brand panel (hidden on mobile) */}
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 text-white">
          <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-sky-300/20 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none"></div>
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

          <div className="relative z-10 flex items-center gap-3">
            <img src="/assets/logo.png" alt="STRANS" className="w-10 h-10 rounded-xl shadow-lg shadow-blue-900/20 ring-2 ring-white/30" />
            <span className="font-extrabold tracking-wide uppercase text-lg">STRANS Merchant</span>
          </div>

          <div className="relative z-10 space-y-8 max-w-md">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              Kelola seluruh outlet Anda dari satu dashboard terpusat.
            </h2>
            <p className="text-sm text-blue-50/80 leading-relaxed">
              Portal owner dan pengelola untuk memantau penjualan, stok, staf, dan keuangan seluruh cabang STRANS Anda secara real-time.
            </p>
            <ul className="space-y-3.5">
              {[
                'Data penjualan & stok tersinkron real-time',
                'Kelola banyak cabang dari satu akun',
                'Akses aman dengan enkripsi setara perbankan',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-blue-50/95">
                  <CheckCircle2 size={18} className="shrink-0 text-white" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-[11px] font-semibold text-blue-50/60 uppercase tracking-wider flex items-center gap-1.5">
            <Store size={12} />
            <span>Portal Owner & Pengelola Outlet</span>
          </p>
        </div>

        {/* Right: Login form panel */}
        <div className="flex flex-col items-center justify-center p-6 sm:p-12 relative">
          <div className="w-full max-w-sm">

            {/* Mobile-only brand header */}
            <div className="lg:hidden flex items-center gap-3 mb-10">
              <img src="/assets/logo.png" alt="STRANS" className="w-9 h-9 rounded-xl shadow-md shadow-blue-500/20" />
              <span className="font-extrabold tracking-wide uppercase text-slate-900">STRANS Merchant</span>
            </div>

            {/* Toggle Masuk / Daftar */}
            <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setRegError(''); }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setLoginError(''); }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Daftar Gratis
              </button>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {authMode === 'login' ? 'Masuk ke Akun Anda' : 'Daftar Akun Baru'}
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                {authMode === 'login' ? 'Kelola outlet dan cabang bisnis Anda dari sini.' : 'Gratis selamanya di paket Free — tanpa kartu kredit.'}
              </p>
            </div>

            {(authMode === 'login' ? loginError : regError) && (
              <div className="flex items-center gap-2.5 p-4 mb-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-semibold">
                <AlertCircle size={16} className="shrink-0 text-rose-500" />
                <span>{authMode === 'login' ? loginError : regError}</span>
              </div>
            )}

            {authMode === 'login' ? (
            <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="text-xs font-bold text-slate-700 block mb-1.5">
                  Email Staf / Owner
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="owner.rasacoffee@gmail.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-pin" className="text-xs font-bold text-slate-700 block mb-1.5">
                  PIN / Sandi Keamanan
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-pin"
                    type="password"
                    required
                    placeholder="Masukkan sandi keamanan"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 mt-6 cursor-pointer transform active:scale-[0.98]"
              >
                {loginLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Masuk ke Dashboard</span>
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] uppercase font-bold tracking-wider">Atau</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="mt-4 flex justify-center">
                <div id="google-signin-btn"></div>
              </div>
            </div>
            </>
            ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-business" className="text-xs font-bold text-slate-700 block mb-1.5">Nama Bisnis / Toko</label>
                <input id="reg-business" type="text" required placeholder="Contoh: Kopi Senja" value={regBusiness} onChange={(e) => setRegBusiness(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
              </div>
              <div>
                <label htmlFor="reg-owner" className="text-xs font-bold text-slate-700 block mb-1.5">Nama Pemilik</label>
                <input id="reg-owner" type="text" required placeholder="Nama lengkap Anda" value={regOwner} onChange={(e) => setRegOwner(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
              </div>
              <div>
                <label htmlFor="reg-email" className="text-xs font-bold text-slate-700 block mb-1.5">Email (untuk login)</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input id="reg-email" type="email" required placeholder="email@bisnis.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="reg-pin" className="text-xs font-bold text-slate-700 block mb-1.5">PIN / Sandi (min. 6 karakter)</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input id="reg-pin" type="password" required minLength={6} placeholder="Buat PIN keamanan" value={regPin} onChange={(e) => setRegPin(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
                </div>
              </div>
              <button type="submit" disabled={regLoading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 mt-6 cursor-pointer transform active:scale-[0.98]">
                {regLoading ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) : (<span>Daftar Gratis Sekarang</span>)}
              </button>
              <p className="text-[11px] text-slate-400 text-center">Dengan mendaftar, akun Anda otomatis di paket <span className="font-bold text-slate-600">Free</span>. Upgrade kapan saja.</p>
            </form>
            )}

            <p className="mt-10 text-center text-xs text-slate-400">
              Butuh bantuan akses? <a href="mailto:support@stranspace.com" className="font-semibold text-blue-600 hover:text-blue-700">Hubungi tim support</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Antrean toast: banyak notifikasi ditumpuk vertikal, tiap kartu hilang sendiri */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-60 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <Toast key={t.id} id={t.id} type={t.type} message={t.message} duration={t.type === 'error' ? 5000 : 4000} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Dialog konfirmasi berstyle */}
      {confirmState && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4" onClick={() => resolveConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${confirmState.danger ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
                  <AlertCircle size={20} />
                </div>
                <h3 className="font-bold text-slate-900">{confirmState.title}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">{confirmState.message}</p>
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button onClick={() => resolveConfirm(false)} className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Batal</button>
              <button onClick={() => resolveConfirm(true)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${confirmState.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500'}`}>{confirmState.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Banner kode aktivasi setelah pendaftaran — untuk mengaktifkan aplikasi POS */}
      {activationInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={() => setActivationInfo(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={22} /></div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Selamat datang di STRANS! 🎉</h3>
                <p className="mt-1 text-sm text-slate-500">Akun Anda aktif di paket <span className="font-bold text-slate-700">Free</span>. Untuk memakai aplikasi kasir (POS) di perangkat, aktifkan dengan kode berikut:</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Kode Aktivasi POS</p>
              <p className="mt-1 select-all font-mono text-2xl font-black tracking-widest text-blue-700">{activationInfo.code}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { try { navigator.clipboard?.writeText(activationInfo.code); setSuccessMessage('Kode aktivasi disalin.'); } catch { /* noop */ } }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Salin Kode
              </button>
              <button
                onClick={() => setActivationInfo(null)}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Mulai Kelola Bisnis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Cabang (owner) — company-tier, cabang mewarisi paket perusahaan */}
      {addBranchOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={() => !addingBranch && setAddBranchOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {!branchResult ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600"><Building2 size={18} /></div>
                    <h3 className="font-extrabold text-slate-900">Tambah Cabang Baru</h3>
                  </div>
                  <button onClick={() => !addingBranch && setAddBranchOpen(false)} aria-label="Tutup" className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleCreateBranch} className="px-6 py-5 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cabang baru otomatis mengikuti paket perusahaan Anda (<span className="font-bold text-slate-700 uppercase">{currentPlan}</span>) — <span className="font-semibold text-slate-700">tanpa biaya tambahan selama masih dalam kuota paket</span>. Setiap cabang punya kode aktivasi sendiri untuk perangkat POS.
                  </p>
                  {addBranchError && (
                    <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{addBranchError}</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="new-branch" className="text-xs font-bold text-slate-700 block mb-1.5">Nama Cabang</label>
                    <input id="new-branch" type="text" required autoFocus placeholder="Contoh: Kopi Senja - Cabang Dago" value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all shadow-sm" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setAddBranchOpen(false)} disabled={addingBranch}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                      Batal
                    </button>
                    <button type="submit" disabled={addingBranch}
                      className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {addingBranch ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) : (<span>Tambah Cabang</span>)}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="px-6 py-7">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={30} /></div>
                  <h3 className="mt-4 text-xl font-extrabold text-slate-900">Cabang Ditambahkan! 🎉</h3>
                  <p className="mt-1 text-sm text-slate-500"><span className="font-semibold text-slate-700">{branchResult.name}</span> aktif di paket <span className="font-bold text-slate-700 uppercase">{branchResult.plan}</span>. Pasang aplikasi POS di perangkat cabang dan aktifkan dengan kode berikut:</p>
                </div>
                <div className="mt-5 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Kode Aktivasi POS</p>
                  <p className="mt-1 select-all font-mono text-2xl font-black tracking-widest text-sky-700">{branchResult.code || '—'}</p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button"
                    onClick={() => { try { navigator.clipboard?.writeText(branchResult.code); setSuccessMessage('Kode aktivasi disalin.'); } catch { /* noop */ } }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Salin Kode
                  </button>
                  <button type="button" onClick={() => setAddBranchOpen(false)}
                    className="flex-1 rounded-xl bg-sky-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-sky-700">
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner verifikasi email (soft) — muncul bila email belum terverifikasi */}
      {session?.cashier && Number(session.cashier.email_verified) !== 1 && !verifyDismissed && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-amber-500 text-white px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold shadow-md">
          <span>⚠️ Verifikasi email Anda{session.cashier.email ? ` (${session.cashier.email})` : ''} untuk mengamankan akun.</span>
          <button
            onClick={handleResendVerification}
            disabled={resendingVerify}
            className="rounded-md bg-white/25 px-3 py-1 font-bold transition hover:bg-white/40 disabled:opacity-60"
          >
            {resendingVerify ? 'Mengirim...' : 'Kirim Ulang Email'}
          </button>
          <button onClick={() => setVerifyDismissed(true)} className="ml-1 text-white/80 hover:text-white" aria-label="Tutup">✕</button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-200 flex items-center gap-3">
            <img src="/assets/logo.png" alt="Strans Merchant" className="w-8 h-8 rounded-lg shadow-md shadow-sky-500/20" />
            <div>
              <h1 className="font-extrabold text-sm tracking-wide uppercase text-slate-900">STRANS <span className="text-sky-600">MERCHANT</span></h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase">Dashboard Bisnis</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Ringkasan Bisnis</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'products' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShoppingBag size={18} />
              <span>Manajemen Menu</span>
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'staff' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users size={18} />
              <span>Kasir & Staf</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'reports' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={18} />
              <span>Laporan Keuangan</span>
            </button>
            {isOwner && <button
              onClick={() => setActiveTab('wallet')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'wallet' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wallet size={18} />
              <span>Dompet</span>
            </button>}
            {canTab('inventory') && <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers size={18} />
              <span>Inventori & Stok</span>
            </button>}
            {canTab('logs') && <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'logs' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <History size={18} />
              <span>Log Aktivitas Staf</span>
            </button>}
            {canTab('vouchers') && <button
              onClick={() => setActiveTab('vouchers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'vouchers' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Ticket size={18} />
              <span>Voucher & Promo</span>
            </button>}
            {canTab('expenses') && <button
              onClick={() => setActiveTab('expenses')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'expenses' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Coins size={18} />
              <span>Biaya & Pengeluaran</span>
            </button>}
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings size={18} />
              <span>Pengaturan Cabang</span>
            </button>
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0">
              {(activeBranch?.name || 'Semua Cabang').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{activeBranch?.name || 'Semua Cabang'}</p>
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 block w-fit mt-1">
                {(activeBranch?.subscription_plan || session.tenant.subscription_plan || 'free')} Plan
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold cursor-pointer"
          >
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Impersonating Demo Banner */}
        {impersonating && (
          <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-2.5 text-slate-950 flex items-center justify-between text-xs font-bold shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <UserCheck size={16} />
              <span>Mode Impersonasi: Anda masuk sebagai staf pengelola (operator) STRANS SPACE untuk meninjau outlet {session.tenant.name}.</span>
            </div>
            <button 
              onClick={() => setImpersonating(false)}
              className="bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 px-2.5 py-1 rounded-md border border-slate-950/10 transition-all text-[10px]"
            >
              Kembali ke Portal Admin
            </button>
          </div>
        )}

        {/* Main Content Header */}
        <header className="px-8 py-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{activeBranchId === 'all' ? 'Semua Cabang' : (activeBranch?.name || session.tenant.name)}</h2>
            <p className="text-xs text-slate-500">{activeBranchId === 'all' ? 'Dashboard Konsolidasi • Performa Seluruh Outlet' : 'Dashboard Manajemen Pusat • ID Cabang: ' + (activeBranch?.id || session.tenant?.id || '-')}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Custom Branch Selector Dropdown */}
            {(branches.length > 1 || isOwner) && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="flex items-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 shadow-sm transition-all cursor-pointer text-xs text-slate-900 font-extrabold focus:outline-none"
                >
                  <Store size={14} className="text-sky-600" />
                  <span className="max-w-[120px] truncate">{activeBranchId === 'all' ? 'Semua Cabang' : (activeBranch?.name || 'Pilih Cabang')}</span>
                  <ChevronRight size={14} className={`text-slate-400 transition-transform duration-200 ${branchDropdownOpen ? 'rotate-90' : 'rotate-0'}`} />
                </button>

                {branchDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBranchDropdownOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-1.5 border-b border-slate-200 mb-1">
                        <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Pilih Cabang Aktif</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        <button
                          onClick={() => {
                            handleBranchChange('all');
                            setBranchDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-all cursor-pointer ${
                            activeBranchId === 'all' ? 'bg-sky-500/5 text-sky-600 font-extrabold' : 'text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-extrabold truncate">Semua Cabang</p>
                            <p className="text-[9px] font-mono text-slate-500 font-semibold uppercase mt-0.5">Gabungan Seluruh Outlet</p>
                          </div>
                          {activeBranchId === 'all' && <CheckCircle2 size={14} className="text-sky-600 shrink-0" />}
                        </button>
                        {branches.map((b) => {
                          const isSelected = String(b.id) === String(activeBranchId);
                          const isInactive = Number(b.is_active) !== 1;
                          return (
                            <div
                              key={b.id}
                              className={`group flex items-center transition-all ${isSelected ? 'bg-sky-500/5' : 'hover:bg-slate-50'}`}
                            >
                              <button
                                onClick={() => {
                                  handleBranchChange(String(b.id));
                                  setBranchDropdownOpen(false);
                                }}
                                className={`flex-1 min-w-0 flex items-center justify-between px-4 py-2.5 text-left cursor-pointer ${isSelected ? 'text-sky-600' : 'text-slate-700'}`}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className={`text-xs font-extrabold truncate flex items-center gap-1.5 ${isInactive ? 'text-slate-400' : ''}`}>
                                    {b.name}
                                    {isInactive && <span className="text-[8px] font-bold uppercase tracking-wide bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">Nonaktif</span>}
                                  </p>
                                </div>
                                {isSelected && <CheckCircle2 size={14} className="text-sky-600 shrink-0" />}
                              </button>
                              {isOwner && (
                                <div className="flex items-center gap-0.5 pr-2 shrink-0">
                                  <button
                                    onClick={() => handleToggleBranchActive(b)}
                                    title={isInactive ? 'Aktifkan cabang' : 'Nonaktifkan cabang'}
                                    className={`p-1.5 rounded-lg transition-colors ${isInactive ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                  >
                                    <Power size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBranch(b)}
                                    title="Hapus cabang"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {isOwner && (
                        <div className="border-t border-slate-200 mt-1 pt-1">
                          <button
                            onClick={openAddBranch}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sky-600 hover:bg-sky-50 transition-all cursor-pointer font-extrabold text-xs"
                          >
                            <Plus size={14} className="shrink-0" />
                            <span>Tambah Cabang</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {loading ? (
              <span className="text-xs text-slate-500 animate-pulse">Menghubungkan ke API...</span>
            ) : (
              <span className="text-xs text-slate-500">Status Database: <span className="text-emerald-600 font-bold">Terhubung</span></span>
            )}
            <div className={`w-2.5 h-2.5 rounded-full ${loading ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
          </div>
        </header>

        {/* Dashboard Tabs Routing Rendering */}
        <div className="p-8 flex-grow">
          {activeTab === 'dashboard' && (
            <DashboardPage 
              activeBranchId={activeBranchId} 
              branches={branches} 
              session={session} 
              handleBranchChange={handleBranchChange} 
              setActionError={setActionError}
            />
          )}
          {activeTab === 'products' && (
            <ProductsPage
              activeBranchId={activeBranchId}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
              confirmAction={confirmAction}
            />
          )}
          {activeTab === 'staff' && (
            <StaffPage
              activeBranchId={activeBranchId}
              session={session}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
              confirmAction={confirmAction}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsPage 
              activeBranchId={activeBranchId} 
              setActionError={setActionError}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryPage
              activeBranchId={activeBranchId}
              session={session}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
              confirmAction={confirmAction}
            />
          )}
          {activeTab === 'logs' && (
            <LogsPage 
              activeBranchId={activeBranchId} 
              setActionError={setActionError}
            />
          )}
          {activeTab === 'vouchers' && (
            <VouchersPage
              activeBranchId={activeBranchId}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
              confirmAction={confirmAction}
            />
          )}
          {activeTab === 'expenses' && (
            <ExpensesPage
              activeBranchId={activeBranchId}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
              confirmAction={confirmAction}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPage
              activeBranchId={activeBranchId}
              branches={branches}
              session={session}
              onRefreshBranches={reloadBranches}
              setActionError={setActionError}
              setSuccessMessage={setSuccessMessage}
            />
          )}
          {activeTab === 'wallet' && (
            <WalletPage setActionError={setActionError} setSuccessMessage={setSuccessMessage} confirmAction={confirmAction} />
          )}
        </div>
      </main>
    </div>
  );
}
