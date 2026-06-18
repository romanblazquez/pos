import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-[--border] bg-[--bg-input] text-[--tx] ' +
  'placeholder:text-[--tx-faint] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
