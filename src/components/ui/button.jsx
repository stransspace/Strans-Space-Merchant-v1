import React from 'react';
import { cn } from '../../lib/utils';

export function Button({
  children,
  className = '',
  variant = 'default',
  size = 'default',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer';

  const variants = {
    default: 'bg-gradient-to-b from-[var(--color-brand-500)] to-[var(--color-brand-700)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] shadow-[0_10px_20px_-8px_rgba(31,169,229,0.5)] hover:from-[var(--color-brand-600)] hover:to-[var(--color-brand-800)] hover:-translate-y-px active:translate-y-0',
    coral: 'bg-gradient-to-b from-[var(--color-coral-500)] to-[var(--color-coral-700)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] shadow-[0_10px_20px_-8px_rgba(255,122,102,0.5)] hover:from-[var(--color-coral-600)] hover:to-[var(--color-coral-800)] hover:-translate-y-px active:translate-y-0',
    secondary: 'bg-[var(--color-brand-50)] text-[var(--color-brand-800)] border border-[var(--color-brand-100)] hover:bg-[var(--color-brand-100)]',
    outline: 'border border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-slate-body)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)]',
    ghost: 'text-[var(--color-slate-body)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)]',
    destructive: 'bg-[var(--color-status-danger)] text-white hover:brightness-95 shadow-sm',
    dangerLight: 'bg-[var(--color-status-danger-pale)] text-[var(--color-status-danger)] border border-red-100 hover:bg-red-100/80',
  };

  const sizes = {
    default: 'h-10 px-4',
    sm: 'h-8 rounded-lg px-3 text-xs',
    lg: 'h-12 rounded-2xl px-6 text-base',
    touch: 'h-11 px-5',
    icon: 'h-10 w-10 p-0',
    'icon-sm': 'h-8 w-8 rounded-lg p-0',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(baseStyles, variants[variant] || variants.default, sizes[size] || sizes.default, className)}
      {...props}
    >
      {children}
    </button>
  );
}
