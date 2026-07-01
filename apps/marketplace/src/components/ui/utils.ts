import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-[--border] bg-[--bg-input] text-[--tx] ' +
  'placeholder:text-[--tx-faint] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

/**
 * Exact (2-decimal) money formatting — for credits, cashback, commission, and
 * "amount to pay" figures, where the displayed number must always match the
 * real minor-unit value with zero rounding drift (unlike product-price display,
 * which intentionally shows whole currency units for browsing).
 */
export function fmtExact(minor: number, currency = 'MXN', locale?: string) {
  return sharedFormatMoney({ minorUnits: minor, currency }, locale);
}
