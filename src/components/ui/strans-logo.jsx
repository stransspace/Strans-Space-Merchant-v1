import React from 'react';
import { cn } from '../../lib/utils';

const SIZES = {
  sm: { px: 28, text: 'text-base' },
  md: { px: 34, text: 'text-lg' },
  lg: { px: 44, text: 'text-2xl' },
};

export function StransLogo({
  className = '',
  iconOnly = false,
  size = 'md',
  tone = 'default',
}) {
  const currentSize = SIZES[size] || SIZES.md;

  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src="/strans-mark.png"
        alt="Strans Space Logo"
        width={currentSize.px}
        height={currentSize.px}
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ width: currentSize.px, height: currentSize.px }}
      />

      {!iconOnly && (
        <span
          className={cn(
            'font-bold tracking-tight leading-none whitespace-nowrap',
            currentSize.text,
            tone === 'white'
              ? 'text-white'
              : 'bg-gradient-to-r from-[var(--color-brand-600)] via-[var(--color-brand-700)] to-[var(--color-ink)] bg-clip-text text-transparent'
          )}
        >
          strans space
        </span>
      )}

      {iconOnly && <span className="sr-only">Strans Space</span>}
    </span>
  );
}
