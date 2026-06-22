import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — merge class names, resolving Tailwind conflicts.
 * clsx handles conditionals/arrays; tailwind-merge dedupes conflicting utilities
 * (e.g. `px-2 px-4` -> `px-4`) so caller overrides via `className` always win.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
