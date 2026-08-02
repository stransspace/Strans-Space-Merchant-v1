import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Send, Copy, CheckCircle2, KeyRound } from 'lucide-react';
import { getCashiers, createCashier, updateCashier, deleteCashier, generateTelegramLink, setNotifyLowStock } from '../lib/api';
import ToggleSwitch from '../components/ToggleSwitch';
import SpinnerButton from '../components/SpinnerButton';

export default function StaffPage({ activeBranchId, session, setActionError, setSuccessMessage, confirmAction }) {
  const [cashiers, setCashiers] = useState([]);
  const [showCashierModal, setShowCashierModal] = useState(false);
  const [editingCashier, setEditingCashier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cashierForm, setCashierForm] = useState({
    name: '',
    username: '',
    pin: '',
    role: 'kasir',
    email: ''
  });
  const [telegramLinkModal, setTelegramLinkModal] = useState(null); // { cashier, deepLink }
  const [copySuccess, setCopySuccess] = useState(false);
  const [resetPinTarget, setResetPinTarget] = useState(null); // cashier yang sedang direset PIN-nya
  const [resetPinForm, setResetPinForm] = useState({ pin: '', pin2: '' });
  const [resettingPin, setResettingPin] = useState(false);

  const loadCashiers = async () => {
    setLoading(true);
    try {
      const scope = activeBranchId === 'all' ? 'company' : null;
      const data = await getCashiers(scope);
      setCashiers(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionError('Gagal memuat staf: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashiers();
  }, [activeBranchId]);

  const openAddCashier = () => {
    setEditingCashier(null);
    setCashierForm({
      name: '',
      username: '',
      pin: '',
      role: 'kasir',
      email: ''
    });
    setShowCashierModal(true);
  };

  const openEditCashier = (cashier) => {
    setEditingCashier(cashier);
    setCashierForm({
      name: cashier.name,
      username: cashier.username,
      pin: '', // Kosongkan PIN, hanya diubah jika diisi
      role: cashier.role || 'kasir',
      email: cashier.email || ''
    });
    setShowCashierModal(true);
  };

  const saveCashier = async (e) => {
    e.preventDefault();
    setActionError('');
    setSaving(true);
    try {
      const payload = {
        name: cashierForm.name,
        username: cashierForm.username,
        role: cashierForm.role,
        email: cashierForm.email || null
      };
      if (cashierForm.pin) {
        payload.pin = cashierForm.pin;
      }

      if (editingCashier) {
        await updateCashier(editingCashier.id, payload);
        setSuccessMessage('Staf berhasil diperbarui.');
      } else {
        if (!cashierForm.pin) {
          throw new Error('PIN wajib diisi untuk akun kasir baru.');
        }
        await createCashier({ ...payload, pin: cashierForm.pin });
        setSuccessMessage('Akun staf baru berhasil dibuat.');
      }
      setShowCashierModal(false);
      loadCashiers();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCashier = async (id) => {
    if (!(await confirmAction('Hapus akun kasir/staf ini? Tindakan ini tidak dapat dibatalkan.', { title: 'Hapus Staf', confirmText: 'Ya, hapus' }))) return;
    setActionError('');
    try {
      await deleteCashier(id);
      setSuccessMessage('Akun staf dihapus.');
      loadCashiers();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openResetPin = (cashier) => {
    setResetPinTarget(cashier);
    setResetPinForm({ pin: '', pin2: '' });
  };

  const submitResetPin = async (e) => {
    e.preventDefault();
    if (!resetPinTarget) return;
    const p1 = String(resetPinForm.pin || '').trim();
    const p2 = String(resetPinForm.pin2 || '').trim();
    if (p1.length < 4) { setActionError('PIN baru minimal 4 digit.'); return; }
    if (p1 !== p2) { setActionError('Konfirmasi PIN tidak sama.'); return; }

    setActionError('');
    setResettingPin(true);
    try {
      // Sertakan email existing: backend akan menimpa kolom email (null bila tak dikirim).
      await updateCashier(resetPinTarget.id, {
        name: resetPinTarget.name,
        username: resetPinTarget.username,
        role: resetPinTarget.role || 'kasir',
        email: resetPinTarget.email || null,
        pin: p1,
      });
      setSuccessMessage(`PIN untuk "${resetPinTarget.name}" berhasil direset.`);
      setResetPinTarget(null);
      setResetPinForm({ pin: '', pin2: '' });
    } catch (err) {
      setActionError('Gagal reset PIN: ' + err.message);
    } finally {
      setResettingPin(false);
    }
  };

  const handleToggleNotify = async (cashier) => {
    const nextEnabled = !cashier.notify_low_stock;
    setCashiers((prev) => prev.map((c) => (c.id === cashier.id ? { ...c, notify_low_stock: nextEnabled ? 1 : 0 } : c)));
    try {
      await setNotifyLowStock(cashier.id, nextEnabled);
    } catch (err) {
      setActionError('Gagal mengubah notifikasi: ' + err.message);
      loadCashiers();
    }
  };

  const handleConnectTelegram = async (cashier) => {
    setActionError('');
    try {
      const result = await generateTelegramLink(cashier.id);
      setTelegramLinkModal({ cashier, deepLink: result.deepLink });
    } catch (err) {
      setActionError('Gagal membuat link Telegram: ' + err.message);
    }
  };

  const handleCopyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Clipboard API tidak tersedia — abaikan, link tetap terlihat untuk disalin manual
    }
  };

  const closeTelegramLinkModal = () => {
    setTelegramLinkModal(null);
    setCopySuccess(false);
    loadCashiers();
  };

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Manajemen Staf Kasir</h3>
          <p className="text-xs text-slate-600">Kelola akun kredensial kasir, pin kasir, dan peran tingkat akses staf di outlet.</p>
        </div>
        <button 
          onClick={() => {
            if (activeBranchId === 'all') {
              setActionError('Silakan pilih salah satu cabang spesifik terlebih dahulu untuk mendaftarkan staf baru.');
              return;
            }
            openAddCashier();
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
            activeBranchId === 'all'
              ? 'bg-slate-100 text-slate-500 border border-slate-200/60 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/10'
          }`}
        >
          <Plus size={14} />
          <span>Tambah Staf</span>
        </button>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold">
            <tr>
              <th className="p-4">Nama Lengkap</th>
              <th className="p-4">Username Login</th>
              <th className="p-4">Email Google</th>
              {activeBranchId === 'all' && <th className="p-4">Cabang</th>}
              <th className="p-4">Peran Akses</th>
              <th className="p-4">Notifikasi Stok</th>
              <th className="p-4">Terdaftar Sejak</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-slate-50/20">
            {cashiers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-100/30 text-slate-800">
                <td className="p-4 font-bold">{c.name}</td>
                <td className="p-4 font-mono text-slate-600">@{c.username}</td>
                <td className="p-4 text-slate-600">{c.email || '-'}</td>
                {activeBranchId === 'all' && (
                  <td className="p-4 font-semibold text-slate-600">
                    {c.tenantName || 'Cabang Utama'}
                  </td>
                )}
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    c.role === 'owner' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                    c.role === 'admin' ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400' :
                    c.role === 'manajer' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {c.role || 'kasir'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      checked={!!c.notify_low_stock}
                      onChange={() => handleToggleNotify(c)}
                      ariaLabel={`Notifikasi stok menipis untuk ${c.name}`}
                    />
                    {c.telegram_chat_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                        <CheckCircle2 size={11} />
                        Terhubung
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConnectTelegram(c)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 border border-slate-200 text-slate-600 hover:bg-sky-500/10 hover:border-sky-500/20 hover:text-sky-600 transition-colors cursor-pointer"
                      >
                        <Send size={11} />
                        Hubungkan
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-4 text-slate-600">
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => openEditCashier(c)}
                      className="text-slate-600 hover:text-sky-400 transition-colors cursor-pointer"
                      title="Ubah akun"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => openResetPin(c)}
                      disabled={c.role === 'owner' && session.cashier.role !== 'owner'}
                      className="text-slate-600 hover:text-amber-500 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Reset PIN akun ini"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCashier(c.id)}
                      disabled={c.role === 'owner' && session.cashier.role !== 'owner'}
                      className="text-slate-600 hover:text-rose-400 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr><td colSpan={activeBranchId === 'all' ? 8 : 7} className="p-8 text-center text-slate-400">Memuat data…</td></tr>
            ) : cashiers.length === 0 && (
              <tr>
                <td colSpan={activeBranchId === 'all' ? 8 : 7} className="p-8 text-center text-slate-500">
                  Belum ada akun kasir terdaftar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CASHIER MODAL (ADD / EDIT) */}
      {showCashierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingCashier ? 'Ubah Akun Staf' : 'Daftarkan Staf Baru'}
              </h3>
              <button 
                onClick={() => setShowCashierModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveCashier} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Nama Lengkap Staf</label>
                <input 
                  type="text" 
                  required
                  placeholder="Nama lengkap kasir"
                  value={cashierForm.name}
                  onChange={(e) => setCashierForm({ ...cashierForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Username Login</label>
                <input 
                  type="text" 
                  required
                  placeholder="Username tanpa spasi (e.g. satrio)"
                  value={cashierForm.username}
                  onChange={(e) => setCashierForm({ ...cashierForm, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">
                  PIN Keamanan / Sandi {editingCashier && '(Biarkan kosong jika tidak diubah)'}
                </label>
                <input 
                  type="password" 
                  required={!editingCashier}
                  placeholder="Angka PIN atau Sandi kasir"
                  value={cashierForm.pin}
                  onChange={(e) => setCashierForm({ ...cashierForm, pin: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Email Google (Untuk Login Google Owner)</label>
                <input 
                  type="email" 
                  placeholder="Contoh: owner.name@gmail.com"
                  value={cashierForm.email || ''}
                  onChange={(e) => setCashierForm({ ...cashierForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500 mb-4"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Hak Peran Akses</label>
                <select 
                  value={cashierForm.role}
                  onChange={(e) => setCashierForm({ ...cashierForm, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="kasir">Kasir (Staf Penjualan POS)</option>
                  <option value="manajer">Manajer (Staf Operasional & Gudang)</option>
                  <option value="admin">Administrator (Hak Penuh Menu & Staf)</option>
                  {session.cashier.role === 'owner' && (
                    <option value="owner">Pemilik Bisnis (Owner)</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowCashierModal(false)}
                  className="px-4 py-2 border border-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <SpinnerButton
                  type="submit"
                  loading={saving}
                  loadingText="Menyimpan…"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Simpan Perubahan
                </SpinnerButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PIN MODAL */}
      {resetPinTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <KeyRound size={16} className="text-amber-500" /> Reset PIN
              </h3>
              <button
                onClick={() => setResetPinTarget(null)}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Atur PIN baru untuk <span className="font-bold text-slate-900">{resetPinTarget.name}</span> <span className="font-mono text-slate-500">@{resetPinTarget.username}</span>. PIN lama akan langsung tergantikan.
            </p>

            <form onSubmit={submitResetPin} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">PIN Baru</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  required
                  placeholder="Minimal 4 digit"
                  value={resetPinForm.pin}
                  onChange={(e) => setResetPinForm({ ...resetPinForm, pin: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Ulangi PIN Baru</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  required
                  placeholder="Ketik ulang PIN baru"
                  value={resetPinForm.pin2}
                  onChange={(e) => setResetPinForm({ ...resetPinForm, pin2: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetPinTarget(null)}
                  className="px-4 py-2 border border-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <SpinnerButton
                  type="submit"
                  loading={resettingPin}
                  loadingText="Mereset…"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer"
                >
                  Reset PIN
                </SpinnerButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TELEGRAM LINK MODAL */}
      {telegramLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Hubungkan Telegram</h3>
              <button
                onClick={closeTelegramLinkModal}
                className="text-slate-500 hover:text-slate-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Kirim link ini ke <span className="font-bold text-slate-900">{telegramLinkModal.cashier.name}</span> agar dibuka dari HP mereka sendiri, lalu tekan <span className="font-semibold">Start</span> di Telegram. Jangan buka link ini dari akun Telegram Anda sendiri.
            </p>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <input
                readOnly
                value={telegramLinkModal.deepLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-transparent text-xs text-slate-700 font-mono focus:outline-none min-w-0"
              />
              <button
                onClick={() => handleCopyLink(telegramLinkModal.deepLink)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-sky-500 hover:bg-sky-600 text-white cursor-pointer transition-colors"
              >
                {copySuccess ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copySuccess ? 'Tersalin' : 'Salin Link'}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={closeTelegramLinkModal}
                className="px-4 py-2 border border-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-bold text-xs cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
