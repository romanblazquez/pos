import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn.js';

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  // Compatibility aliases for existing consumers.
  | 'primary'
  | 'danger';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  destructive:
    'border-transparent bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
  outline: 'border-border bg-background shadow-xs hover:bg-secondary hover:text-foreground',
  secondary: 'border-transparent bg-secondary text-foreground shadow-xs hover:bg-secondary/80',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-secondary',
  link: 'border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
  primary: 'border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  danger:
    'border-transparent bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
  lg: 'h-10 px-6 has-[>svg]:px-4',
  icon: 'h-9 w-9 rounded-md',
  md: 'h-9 px-4 py-2 has-[>svg]:px-3',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'default',
  size = 'default',
  children,
  loading,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors',
        'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
