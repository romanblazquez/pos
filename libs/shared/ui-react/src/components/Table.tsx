import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table {...props} className={cn('w-full caption-bottom text-sm', className)} />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn('border-b border-line', className)} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn('[&_tr:last-child]:border-0', className)} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...props}
      className={cn(
        'border-b border-line transition-colors hover:bg-panel-2/50',
        className,
      )}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        'h-9 px-3 text-left text-xs font-semibold text-muted first:pl-4 last:pr-4',
        className,
      )}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={cn('px-3 py-2 text-sm text-text first:pl-4 last:pr-4', className)}
    />
  );
}

export function TableEmpty({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={999} className="py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}
