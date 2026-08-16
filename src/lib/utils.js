import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatRupiahShort(amount) {
  const num = Number(amount) || 0;
  if (num >= 1000000000) {
    return `Rp${(num / 1000000000).toFixed(1).replace(/\.0$/, '')} M`;
  }
  if (num >= 1000000) {
    return `Rp${(num / 1000000).toFixed(1).replace(/\.0$/, '')} jt`;
  }
  if (num >= 1000) {
    return `Rp${Math.round(num / 1000)}rb`;
  }
  return formatRupiah(num);
}

export function formatNumber(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
