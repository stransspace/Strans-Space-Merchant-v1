import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Dialog content */}
      <div
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] shadow-2xl transition-all duration-200 animate-in zoom-in-95',
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = '', children, onClose }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-[var(--color-hairline)] px-6 py-4.5', className)}>
      <div>{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--color-slate-muted)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ className = '', children }) {
  return (
    <h3 className={cn('text-lg font-bold text-[var(--color-ink)]', className)}>
      {children}
    </h3>
  );
}

export function DialogDescription({ className = '', children }) {
  return (
    <p className={cn('text-xs text-[var(--color-slate-muted)] mt-0.5', className)}>
      {children}
    </p>
  );
}

export function DialogContent({ className = '', children }) {
  return (
    <div className={cn('max-h-[75vh] overflow-y-auto px-6 py-5', className)}>
      {children}
    </div>
  );
}

export function DialogFooter({ className = '', children }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--color-hairline)] bg-[var(--color-snow)] px-6 py-4', className)}>
      {children}
    </div>
  );
}
