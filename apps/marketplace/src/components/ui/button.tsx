import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:     'bg-[--primary] text-[--primary-foreground] shadow-sm hover:opacity-90',
        secondary:   'bg-[--bg-subtle] text-[--tx] hover:bg-[--bg-hover]',
        outline:     'border border-[--border] bg-[--bg-raised] text-[--tx] hover:bg-[--bg-hover]',
        ghost:       'bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
        destructive: 'bg-[--error-solid] text-[--error-fg] hover:opacity-90',
        link:        'bg-[--bg-subtle] text-[--accent] underline-offset-4 hover:bg-[--bg-hover] hover:underline',
      },
      size: {
        sm:   'h-8 px-3 text-xs',
        md:   'h-11 px-[18px] py-2.5',
        lg:   'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
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
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  },
);
Button.displayName = 'Button';
