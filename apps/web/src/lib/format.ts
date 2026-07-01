import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';
import type { Locale } from './segments';

/** Money from minor units (centavos). Locale-aware, no decimals for whole MXN/ARS. */
export function formatMoney(minor: number, currency = 'MXN', locale: Locale = 'es'): string {
  return sharedFormatMoney({ minorUnits: minor, currency }, locale === 'es' ? 'es-MX' : 'en-US', 0);
}

/** "$590" or "$590 – $1,200" from a min/max minor pair. */
export function formatRange(
  minMinor: number,
  maxMinor: number,
  currency = 'MXN',
  locale: Locale = 'es',
): string {
  return minMinor === maxMinor
    ? formatMoney(minMinor, currency, locale)
    : `${formatMoney(minMinor, currency, locale)} – ${formatMoney(maxMinor, currency, locale)}`;
}
