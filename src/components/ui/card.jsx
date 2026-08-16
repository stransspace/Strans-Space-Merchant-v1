import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-ink)] shadow-[0_4px_20px_-4px_rgba(7,38,54,0.05)] transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3
      className={cn(
        'text-base font-bold leading-tight tracking-tight text-[var(--color-ink)]',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('text-xs text-[var(--color-slate-muted)]', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-t border-[var(--color-hairline)] p-4 sm:px-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
