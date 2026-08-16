import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Send, 
  Copy, 
  CheckCircle2, 
  KeyRound, 
  Users, 
  ShieldCheck, 
  Mail, 
  Check, 
  MessageSquare,
  Building2
} from 'lucide-react';
import { 
  getCashiers, 
  createCashier, 
  updateCashier, 
  deleteCashier, 
  generateTelegramLink, 
  setNotifyLowStock 
} from '../lib/api';
import { formatDate, cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';

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

  const [telegramLinkModal, setTelegramLinkModal] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [resetPinTarget, setResetPinTarget] = useState(null);
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
      pin: '',
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
        setSuccessMessage('Data staf berhasil diperbarui.');
      } else {
        if (!cashierForm.pin) {
          throw new Error('PIN wajib diisi untuk akun staf baru.');
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

  const handleDeleteCashier = async (id, name) => {
    if (!(await confirmAction(`Hapus akun staf "${name}"? Tindakan ini tidak dapat dibatalkan.`, { title: 'Hapus Staf', confirmText: 'Ya, hapus' }))) return;
    setActionError('');
    try {
      await deleteCashier(id);
      setSuccessMessage('Akun staf berhasil dihapus.');
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
    if (p1 !== p2) { setActionError('Konfirmasi PIN tidak cocok.'); return; }

    setActionError('');
    setResettingPin(true);
    try {
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
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
            Manajemen Staf & Hak Akses
          </h1>
          <p className="text-xs text-[var(--color-slate-muted)] mt-0.5">
            Kelola akun kasir, tingkat wewenang staf (Kasir / Manajer / Admin), dan notifikasi bot Telegram.
          </p>
        </div>

        <Button
          onClick={() => {
            if (activeBranchId === 'all') {
              setActionError('Silakan pilih salah satu cabang spesifik untuk mendaftarkan staf baru.');
              return;
            }
            openAddCashier();
          }}
          disabled={activeBranchId === 'all'}
          className="shadow-md"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Staf Baru</span>
        </Button>
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daftar Staf & Kasir Terdaftar</CardTitle>
              <CardDescription>
                {activeBranchId === 'all' ? 'Seluruh staf dari semua outlet.' : 'Staf yang bertugas di outlet aktif.'}
              </CardDescription>
            </div>
            <Badge variant="brand">{cashiers.length} Akun</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--color-slate-muted)] animate-pulse">
              Memuat data akun staf...
            </div>
          ) : cashiers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-slate-muted)]">
              Belum ada staf terdaftar di cabang ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-snow)] text-[var(--color-slate-muted)] font-semibold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-6 py-3.5">Nama Lengkap</th>
                    <th className="px-4 py-3.5">Username Login</th>
                    <th className="px-4 py-3.5">Email</th>
                    {activeBranchId === 'all' && <th className="px-4 py-3.5">Outlet Cabang</th>}
                    <th className="px-4 py-3.5">Peran Akses</th>
                    <th className="px-4 py-3.5">Notifikasi Telegram</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {cashiers.map((c) => {
                    const roleBadge = 
                      c.role === 'owner' ? 'coral' :
                      c.role === 'admin' ? 'brand' :
                      c.role === 'manajer' ? 'warning' : 'secondary';

                    return (
                      <tr key={c.id} className="hover:bg-[var(--color-brand-50)]/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-[var(--color-ink)] flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-brand-100)] text-[var(--color-brand-700)] font-bold shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <div>{c.name}</div>
                            <span className="text-[10px] text-[var(--color-slate-muted)] font-normal">ID: {c.id}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-[var(--color-slate-body)]">
                          @{c.username}
                        </td>

                        <td className="px-4 py-3.5 text-[var(--color-slate-muted)]">
                          {c.email || '-'}
                        </td>

                        {activeBranchId === 'all' && (
                          <td className="px-4 py-3.5 font-semibold text-[var(--color-ink)]">
                            {c.tenantName || 'Outlet Utama'}
                          </td>
                        )}

                        <td className="px-4 py-3.5">
                          <Badge variant={roleBadge} className="capitalize">
                            {c.role || 'kasir'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Switch
                              checked={!!c.notify_low_stock}
                              onChange={() => handleToggleNotify(c)}
                            />

                            {c.telegram_chat_id ? (
                              <Badge variant="success" className="text-[10px]">
                                <Check className="h-3 w-3" />
                                <span>Terhubung</span>
                              </Badge>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConnectTelegram(c)}
                                className="flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-colors"
                              >
                                <Send className="h-2.5 w-2.5" />
                                <span>Hubungkan Bot</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openResetPin(c)}
                              title="Reset PIN"
                              className="h-7 px-2 text-xs"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>PIN</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditCashier(c)}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>

                            {c.role !== 'owner' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCashier(c.id, c.name)}
                                className="p-1.5 text-[var(--color-slate-muted)] hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Tambah/Edit Staf */}
      <Dialog open={showCashierModal} onClose={() => setShowCashierModal(false)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setShowCashierModal(false)}>
          <DialogTitle>{editingCashier ? 'Sunting Akun Staf' : 'Tambah Staf Kasir Baru'}</DialogTitle>
          <DialogDescription>
            Kredensial ini digunakan kasir untuk login dan membuka shift di mesin POS.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={saveCashier}>
          <DialogContent className="space-y-3.5 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Nama Lengkap</label>
              <Input required placeholder="Contoh: Budi Santoso" value={cashierForm.name} onChange={(e) => setCashierForm({ ...cashierForm, name: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Username Login</label>
              <Input required placeholder="budi_kasir" value={cashierForm.username} onChange={(e) => setCashierForm({ ...cashierForm, username: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Peran Akses</label>
                <Select value={cashierForm.role} onChange={(e) => setCashierForm({ ...cashierForm, role: e.target.value })}>
                  <option value="kasir">Kasir</option>
                  <option value="manajer">Manajer</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                  {editingCashier ? 'PIN Baru (Opsional)' : 'PIN Kasir (min 4 digit)'}
                </label>
                <Input
                  type="password"
                  placeholder={editingCashier ? 'Biarkan kosong jika tetap' : 'Contoh: 123456'}
                  value={cashierForm.pin}
                  onChange={(e) => setCashierForm({ ...cashierForm, pin: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Email Google (Opsional)</label>
              <Input type="email" placeholder="email@gmail.com" value={cashierForm.email} onChange={(e) => setCashierForm({ ...cashierForm, email: e.target.value })} />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowCashierModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : editingCashier ? 'Simpan Perubahan' : 'Buat Akun Staf'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: Reset PIN */}
      <Dialog open={!!resetPinTarget} onClose={() => setResetPinTarget(null)} maxWidth="max-w-sm">
        <DialogHeader onClose={() => setResetPinTarget(null)}>
          <DialogTitle>Reset PIN: {resetPinTarget?.name}</DialogTitle>
          <DialogDescription>Masukkan PIN baru untuk akun staf ini.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submitResetPin}>
          <DialogContent className="space-y-3 pt-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">PIN Baru</label>
              <Input type="password" required minLength={4} placeholder="Minimal 4 digit" value={resetPinForm.pin} onChange={(e) => setResetPinForm({ ...resetPinForm, pin: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Ulangi PIN Baru</label>
              <Input type="password" required minLength={4} placeholder="Ketik ulang PIN" value={resetPinForm.pin2} onChange={(e) => setResetPinForm({ ...resetPinForm, pin2: e.target.value })} />
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setResetPinTarget(null)} disabled={resettingPin}>
              Batal
            </Button>
            <Button type="submit" disabled={resettingPin}>
              {resettingPin ? 'Mereset...' : 'Simpan PIN Baru'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: Telegram Bot Connect */}
      <Dialog open={!!telegramLinkModal} onClose={() => setTelegramLinkModal(null)} maxWidth="max-w-md">
        <DialogHeader onClose={() => setTelegramLinkModal(null)}>
          <DialogTitle>Hubungkan Bot Telegram</DialogTitle>
          <DialogDescription>
            Kirimkan tautan ini ke staf agar notifikasi stok bahan baku otomatis masuk ke Telegram pribadinya.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4 pt-4">
          <div className="rounded-xl border-2 border-dashed border-[var(--color-brand-300)] bg-[var(--color-brand-50)] p-4 text-center">
            <p className="text-xs text-[var(--color-slate-body)] break-all font-mono">
              {telegramLinkModal?.deepLink}
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => handleCopyLink(telegramLinkModal?.deepLink)}
            className="w-full h-9 text-xs"
          >
            {copySuccess ? 'Tautan Berhasil Disalin!' : 'Salin Tautan Telegram'}
          </Button>
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" onClick={() => setTelegramLinkModal(null)}>
            Tutup
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
