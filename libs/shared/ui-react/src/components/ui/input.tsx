import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional inline label rendered above the field. */
  label?: string;
  /** Helper text rendered below the field when there's no error. */
  hint?: string;
  /** Error text; also flags the field invalid (red ring + aria-invalid). */
  error?: string;
}

const baseInput =
  'flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none ' +
  'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground ' +
  'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground ' +
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ' +
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, hint, error, id, ...props }, ref) => {
    const autoId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const field = (
      <input
        ref={ref}
        id={autoId}
        type={type}
        data-slot="input"
        aria-invalid={error ? true : props['aria-invalid']}
        className={cn(
          baseInput,
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          className,
        )}
        {...props}
      />
    );

    // Bare input is the canonical shadcn shape; the wrapper only appears when a
    // label/hint/error is supplied (kept for existing form consumers).
    if (!label && !hint && !error) return field;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={autoId} className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        {field}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
