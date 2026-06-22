import type { Locale } from './segments';

/** Money from minor units (centavos). Locale-aware, no decimals for whole MXN/ARS. */
export function formatMoney(minor: number, currency = 'MXN', locale: Locale = 'es'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
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
