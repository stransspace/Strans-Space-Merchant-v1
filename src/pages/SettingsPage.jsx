import React, { useState } from 'react';
import { 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  Calendar, 
  Zap, 
  TrendingUp, 
  Loader2,
  Lock,
  Building,
  Check,
  ShieldCheck,
  Crown,
  Send
} from 'lucide-react';

export default function SettingsPage({ activeBranchId, branches, session, onRefreshBranches, setActionError, setSuccessMessage }) {
  const activeBranch = activeBranchId === 'all' ? null : (branches.find(b => String(b.id) === String(activeBranchId)) || (session ? session.tenant : null));

  // Billing states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [durationMonths, setDurationMonths] = useState(6);
  const [paymentMethod, setPaymentMethod] = useState('qris');
  
  // Payment simulation process states
  const [paymentStep, setPaymentStep] = useState(1); // 1: Choose details, 2: Waiting payment / QR, 3: Success
  const [processing, setProcessing] = useState(false);

  const planPrices = {
    standard: 150000,
    premium: 350000
  };

  const getDiscount = (months) => {
    if (months === 6) return 0.10; // 10%
    if (months === 12) return 0.20; // 20%
    return 0;
  };

  const calculateTotal = () => {
    const basePrice = planPrices[selectedPlan] * durationMonths;
    const discount = basePrice * getDiscount(durationMonths);
    return basePrice - discount;
  };

  const handleStartUpgrade = () => {
    // Default to upgrading to premium if current is standard/free
    if (activeBranch?.subscription_plan === 'premium') {
      setSelectedPlan('premium');
    } else if (activeBranch?.subscription_plan === 'standard') {
      setSelectedPlan('premium');
    } else {
      setSelectedPlan('standard');
    }
    setPaymentStep(1);
    setShowUpgradeModal(true);
  };

  const handleProcessPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setPaymentStep(2);
    }, 1200);
  };

  const handleSimulateSuccess = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          months: durationMonths
        })
      });
      const data = await response.json();
      if (data.success || response.ok) {
        setPaymentStep(3);
        setSuccessMessage?.('Simulasi upgrade langganan berhasil diproses.');
        if (onRefreshBranches) {
          onRefreshBranches();
        }
      } else {
        setActionError?.(data.error || 'Gagal memproses simulasi upgrade langganan.');
      }
    } catch (err) {
      setActionError?.('Gagal menghubungi server.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profil Cabang Card */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Informasi Profil Cabang</h3>
          <p className="text-xs text-slate-600">Rincian profil identitas toko dan kredensial integrasi sistem POS.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 border border-slate-100 p-5 rounded-xl bg-slate-50/20">
            <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Detail Outlet</h4>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Nama Toko / Outlet</span>
                <p className="text-sm text-slate-900 font-bold">{activeBranch?.name || session.tenant.name}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Paket Berlangganan</span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${
                  (activeBranch?.subscription_plan || session.tenant.subscription_plan) === 'premium'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : (activeBranch?.subscription_plan || session.tenant.subscription_plan) === 'standard'
                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                    : 'text-slate-600 bg-slate-500/10 border-slate-500/20'
                }`}>
                  {(activeBranch?.subscription_plan || session.tenant.subscription_plan) === 'premium' ? <Crown size={12} /> : <ShieldCheck size={12} />}
                  {(activeBranch?.subscription_plan || session.tenant.subscription_plan || 'free')} Plan
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 border border-slate-100 p-5 rounded-xl bg-slate-50/20">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Aktivasi Integrasi</h4>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Kode Aktivasi Perangkat POS</span>
                <p className="text-sm text-slate-900 font-mono font-bold tracking-widest bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-fit">
                  {activeBranch?.activation_code || session.tenant.activation_code || '-'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Status Koneksi API Merchant</span>
                <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>Siap Terhubung & Mensinkronkan Data</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifikasi Stok Card */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
            <Send size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Notifikasi Stok via Telegram</h3>
            <p className="text-xs text-slate-600 mt-1">
              Staf akan menerima pesan Telegram otomatis saat stok bahan baku turun ke batas minimum yang ditentukan.
              Aktifkan notifikasi dan hubungkan akun Telegram per staf di halaman <span className="font-bold text-slate-900">Kasir &amp; Staf</span>,
              lalu atur batas stok minimum tiap bahan di halaman <span className="font-bold text-slate-900">Inventori &amp; Stok</span> (tombol "Sesuaikan Stok").
            </p>
          </div>
        </div>
      </div>

      {/* SaaS Subscription Billing System */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Sistem Tagihan & Layanan Langganan</h3>
            <p className="text-xs text-slate-600">Paket langganan berlaku untuk <span className="font-bold text-slate-800">seluruh perusahaan (semua cabang)</span>. Upgrade sekali, aktif di semua outlet.</p>
          </div>
          {activeBranchId !== 'all' && (
            <button
              onClick={handleStartUpgrade}
              className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shadow-lg shadow-sky-500/10"
            >
              <Zap size={14} />
              Upgrade / Perpanjang Paket
            </button>
          )}
        </div>

        {activeBranchId === 'all' ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-100 rounded-xl bg-slate-50/20 text-center">
            <Building className="text-slate-400 mb-3" size={36} />
            <p className="text-sm font-bold text-slate-700">Pilih Salah Satu Cabang Dulu</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">Paket dikelola di level perusahaan — upgrade dari cabang mana pun otomatis berlaku untuk <span className="font-semibold text-slate-700">semua cabang</span>.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="border border-slate-100/80 p-5 rounded-xl bg-slate-50/40 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Metode Pembayaran Aktif</span>
                <h4 className="text-sm font-bold text-slate-900 mt-1">Simulasi Auto-Billing</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">Sistem penagihan otomatis terintegrasi dengan saldo merchant atau virtual account.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/30 text-xs text-sky-400 font-semibold">
                <CreditCard size={14} />
                <span>Default: QRIS / Bank Transfer</span>
              </div>
            </div>

            <div className="border border-slate-100/80 p-5 rounded-xl bg-slate-50/40 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Status Lisensi Perusahaan</span>
                <h4 className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 size={16} />
                  <span>Lisensi Aktif</span>
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">Akses modul POS, sync database offline, dan inventaris aktif sepenuhnya.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/30 text-xs text-slate-600">
                <Calendar size={14} />
                <span>Berlaku s/d: Perpanjangan Otomatis</span>
              </div>
            </div>

            <div className="border border-slate-100/80 p-5 rounded-xl bg-slate-50/40 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Keuntungan Upgrade Premium</span>
                <h4 className="text-sm font-bold text-amber-400 mt-1 flex items-center gap-1.5">
                  <Crown size={16} />
                  <span>Fitur Premium Aktif</span>
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">Mendukung modul QRIS Dinamis Otomatis, Self-Order Meja Pelanggan, dan Kustom UI.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/30 text-xs text-amber-400 font-semibold">
                <TrendingUp size={14} />
                <span>Upgrade instan kapan saja</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade / Billing Modal (Mock Payment Gateway integration) */}
      {showUpgradeModal && activeBranch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upgrade Paket Perusahaan</h3>
                <p className="text-xs text-slate-600">Berlaku untuk <span className="font-bold">semua cabang</span>. Pilih paket & selesaikan pembayaran simulasi.</p>
              </div>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {paymentStep === 1 && (
              <div className="p-6 space-y-5">
                {/* Select Plan */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pilih Paket Langganan</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedPlan('standard')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedPlan === 'standard' 
                          ? 'border-sky-500 bg-sky-500/5 text-slate-900' 
                          : 'border-slate-100 bg-slate-50/40 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">Standard</span>
                        {selectedPlan === 'standard' && <Check size={14} className="text-sky-400" />}
                      </div>
                      <span className="text-xs font-semibold block text-slate-700">Rp 150.000 / bln</span>
                      <span className="text-[10px] text-slate-500 mt-2 block font-normal">Manajemen bahan & laporan lengkap.</span>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('premium')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedPlan === 'premium' 
                          ? 'border-amber-500 bg-amber-500/5 text-slate-900' 
                          : 'border-slate-100 bg-slate-50/40 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">Premium</span>
                        {selectedPlan === 'premium' && <Check size={14} className="text-amber-400" />}
                      </div>
                      <span className="text-xs font-semibold block text-slate-700">Rp 350.000 / bln</span>
                      <span className="text-[10px] text-slate-500 mt-2 block font-normal">QRIS Dinamis, Self-Order, & Kustom UI.</span>
                    </button>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pilih Durasi Sewa</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 1, label: '1 Bulan', disc: 'Harga Normal' },
                      { key: 6, label: '6 Bulan', disc: 'Hemat 10%' },
                      { key: 12, label: '12 Bulan', disc: 'Hemat 20%' }
                    ].map((d) => (
                      <button
                        key={d.key}
                        onClick={() => setDurationMonths(d.key)}
                        className={`py-3 px-2 rounded-xl border transition-all text-center ${
                          durationMonths === d.key 
                            ? 'border-sky-500 bg-sky-500/5 text-slate-900' 
                            : 'border-slate-100 bg-slate-50/40 text-slate-600 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">{d.label}</span>
                        <span className="text-[9px] text-slate-500 mt-1 block font-semibold">{d.disc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('qris')}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        paymentMethod === 'qris' 
                          ? 'border-emerald-500 bg-emerald-500/5 text-slate-900' 
                          : 'border-slate-100 bg-slate-50/40 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <QrCode size={18} className="text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold block">QRIS (Bayar Instan)</span>
                        <span className="text-[9px] text-slate-500 font-normal">Gopay, OVO, ShopeePay</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('transfer')}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        paymentMethod === 'transfer' 
                          ? 'border-emerald-500 bg-emerald-500/5 text-slate-900' 
                          : 'border-slate-100 bg-slate-50/40 text-slate-600 hover:border-slate-200'
                      }`}
                    >
                      <CreditCard size={18} className="text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold block">Virtual Account</span>
                        <span className="text-[9px] text-slate-500 font-normal">Transfer Bank BCA/Mandiri</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Total Recap */}
                <div className="p-4 bg-slate-50/60 border border-slate-100/80 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">Total Pembayaran</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-slate-900">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                      {getDiscount(durationMonths) > 0 && (
                        <span className="text-[9px] text-slate-500 line-through">
                          Rp {(planPrices[selectedPlan] * durationMonths).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleProcessPayment}
                    disabled={processing}
                    className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow shadow-sky-500/10"
                  >
                    {processing && <Loader2 size={12} className="animate-spin" />}
                    Lanjut Ke Pembayaran
                  </button>
                </div>
              </div>
            )}

            {/* Waiting Payment Screen (Mock Midtrans Sandbox Checkout UI) */}
            {paymentStep === 2 && (
              <div className="p-6 text-center space-y-6">
                <div className="mx-auto max-w-sm border border-slate-100 bg-slate-50/60 rounded-3xl p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100/60 pb-3">
                    <span className="text-xs text-slate-600 font-bold">Midtrans Payment Gateway</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">Sandbox</span>
                  </div>

                  <div className="text-left space-y-1">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Pembayaran</span>
                    <span className="text-xl font-black text-emerald-400">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                  </div>

                  {paymentMethod === 'qris' ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('https://posandroid.stranspace.com/pay/' + activeBranch.id)}`}
                          alt="QRIS Payment Code" 
                          className="w-40 h-40"
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                        Silakan scan kode QRIS di atas memakai aplikasi E-Wallet atau M-Banking Anda untuk menyelesaikan pembayaran.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-left">
                      <div className="p-3 bg-white border border-slate-100 rounded-xl">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Nomor Virtual Account</span>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-mono font-bold text-slate-900 tracking-wider">88019 {activeBranch.id} 0123</span>
                          <span className="text-[9px] px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold uppercase cursor-pointer hover:bg-slate-200">Salin</span>
                        </div>
                        <span className="text-[9px] text-slate-600 block mt-1">Bank Mandiri / BNI Virtual Account</span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed font-semibold text-center">
                        Masukkan nomor virtual account di atas melalui ATM atau M-Banking Anda.
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100/60 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                    <span className="text-[10px] text-slate-600 font-bold">Menunggu Pembayaran Transfer...</span>
                  </div>
                </div>

                <div className="flex gap-4 max-w-sm mx-auto">
                  <button
                    onClick={() => setPaymentStep(1)}
                    className="flex-1 py-3 rounded-xl border border-slate-100 hover:border-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={handleSimulateSuccess}
                    disabled={processing}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow shadow-emerald-500/10"
                  >
                    {processing && <Loader2 size={12} className="animate-spin" />}
                    Simulasi Sukses (Mock)
                  </button>
                </div>
              </div>
            )}

            {/* Success Screen */}
            {paymentStep === 3 && (
              <div className="p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                  <Check size={36} />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-slate-900">Pembayaran Berhasil!</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Terima kasih! Pembayaran telah diverifikasi otomatis. Paket kini aktif untuk <span className="font-bold">seluruh cabang</span> perusahaan Anda.
                  </p>
                </div>

                <div className="p-4 bg-slate-50/60 border border-slate-100/80 rounded-2xl max-w-sm mx-auto text-left space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Berlaku untuk</span>
                    <span className="text-slate-900 font-bold">Semua Cabang</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Paket Baru</span>
                    <span className="text-amber-400 font-extrabold uppercase">{selectedPlan} Plan</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Tambahan Durasi</span>
                    <span className="text-slate-900 font-bold">{durationMonths} Bulan</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow shadow-slate-50/40"
                >
                  Selesai & Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
