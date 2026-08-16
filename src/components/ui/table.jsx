import React from 'react';
import { cn } from '../../lib/utils';

export function Table({ className = '', children, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = '', children, ...props }) {
  return (
    <thead className={cn('[&_tr]:border-b border-[var(--color-hairline)]', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = '', children, ...props }) {
  return (
    <tr
      className={cn(
        'border-b border-[var(--color-hairline)] transition-colors hover:bg-[var(--color-brand-50)]/40 data-[state=selected]:bg-[var(--color-brand-50)]',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className = '', children, ...props }) {
  return (
    <th
      className={cn(
        'h-11 px-4 text-left align-middle font-semibold text-[var(--color-slate-muted)] [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className = '', children, ...props }) {
  return (
    <td
      className={cn(
        'p-4 align-middle text-[var(--color-ink)] [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
