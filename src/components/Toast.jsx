import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Satu kartu toast yang menghilang sendiri setelah `duration` ms. Ditumpuk oleh App.
export default function Toast({ id, type = 'success', message, duration = 4000, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);

  const isError = type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`${isError ? 'bg-rose-500 border-rose-400' : 'bg-emerald-500 border-emerald-400'} border text-white px-5 py-3 rounded-xl shadow-2xl flex items-start gap-2 text-xs font-semibold animate-[slideIn_0.25s_ease-out]`}
    >
      {isError ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
      <span className="flex-1">{message}</span>
      <button onClick={() => onDismiss(id)} className="shrink-0 opacity-80 hover:opacity-100" aria-label="Tutup notifikasi">✕</button>
    </div>
  );
}
