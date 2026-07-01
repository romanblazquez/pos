import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-slate-900 text-white hover:bg-slate-800',
        primary:     'bg-emerald-700 text-white hover:bg-emerald-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline:     'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
        secondary:   'bg-slate-100 text-slate-700 hover:bg-slate-200',
        ghost:       'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        link:        'text-slate-600 underline-offset-4 hover:underline',
      },
      size: {
        sm:      'h-9 px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg:      'h-11 px-6',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
