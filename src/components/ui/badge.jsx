import React from 'react';
import { cn } from '../../lib/utils';

export function Badge({
  children,
  className = '',
  variant = 'default',
  ...props
}) {
  const baseStyles = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-semibold leading-tight transition-colors';

  const variants = {
    default: 'border-transparent bg-[var(--color-brand-600)] text-white',
    brand: 'border-[var(--color-brand-200)] bg-[var(--color-brand-50)] text-[var(--color-brand-800)]',
    secondary: 'border-[var(--color-hairline)] bg-[var(--color-snow)] text-[var(--color-slate-body)]',
    outline: 'border-[var(--color-hairline)] bg-transparent text-[var(--color-slate-body)]',
    coral: 'border-transparent bg-[var(--color-coral-600)] text-white',
    success: 'border-emerald-200/60 bg-[var(--color-status-live-pale)] text-[var(--color-status-live)]',
    warning: 'border-amber-200/60 bg-[var(--color-status-beta-pale)] text-[var(--color-status-beta)]',
    danger: 'border-rose-200/60 bg-[var(--color-status-danger-pale)] text-[var(--color-status-danger)]',
  };

  return (
    <span className={cn(baseStyles, variants[variant] || variants.default, className)} {...props}>
      {children}
    </span>
  );
}
