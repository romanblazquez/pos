import type { ReactNode } from 'react';
import { cn } from '../cn.js';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted' | 'outline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-accent/15 text-accent border-accent/30',
  success: 'bg-ok/15 text-ok border-ok/30',
  warning: 'bg-warn/15 text-warn border-warn/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  muted: 'bg-panel-2 text-muted border-line',
  outline: 'bg-transparent text-text border-line',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
