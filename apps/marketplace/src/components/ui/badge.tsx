import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[--bg-subtle] text-[--tx-muted]',
        success:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
        warning:     'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
        error:       'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
        info:        'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
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
