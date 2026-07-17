import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

export const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[--bg-subtle] text-[--tx-muted]',
        success:     'bg-[--success-bg] text-[--success]',
        warning:     'bg-[--warning-bg] text-[--warning]',
        error:       'bg-[--error-bg] text-[--error]',
        info:        'bg-[--info-bg] text-[--info]',
        purple:      'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200',
        outline:     'border border-[--border] text-[--tx-muted]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
