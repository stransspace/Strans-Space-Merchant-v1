import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({
  className = '',
  type = 'text',
  error = false,
  ...props
}, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-[var(--color-hairline)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--color-ink)] transition-all placeholder:text-[var(--color-slate-muted)] focus:border-[var(--color-brand-500)] focus:bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]/20 disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
