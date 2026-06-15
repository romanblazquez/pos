import type { InputHTMLAttributes } from 'react';
import { cn } from '../cn.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={cn(
          'h-8 w-full rounded-lg border border-line bg-surface px-3 text-sm text-text',
          'placeholder:text-muted outline-none transition',
          'focus:border-accent focus:ring-2 focus:ring-accent/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
