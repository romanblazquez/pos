import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-xl border border-line bg-panel', className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('flex items-center gap-3 px-4 py-3 border-b border-line', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('text-sm font-semibold text-text', className)}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('p-4', className)}>
      {children}
    </div>
  );
}

export function CardDescription({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} className={cn('text-xs text-muted', className)}>
      {children}
    </span>
  );
}
