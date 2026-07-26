import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';
import type { Locale } from './segments';

/**
 * Money from minor units (centavos). Locale-aware, no decimals for whole MXN/ARS.
 *
 * `currency` is deliberately required and has no default. It previously
 * defaulted to MXN, which silently rendered the ~49% of listings priced in ARS
 * as Mexican pesos — the same number, the wrong country, on a site whose entire
 * premise is price trust. Making it required turns that class of mistake into a
 * compile error instead of a plausible-looking wrong price.
 */
export function formatMoney(minor: number, currency: string, locale: Locale = 'es'): string {
  return sharedFormatMoney({ minorUnits: minor, currency }, locale === 'es' ? 'es-MX' : 'en-US', 0);
}

/** "$590" or "$590 – $1,200" from a min/max minor pair. */
export function formatRange(
  minMinor: number,
  maxMinor: number,
  currency: string,
  locale: Locale = 'es',
): string {
  return minMinor === maxMinor
    ? formatMoney(minMinor, currency, locale)
    : `${formatMoney(minMinor, currency, locale)} – ${formatMoney(maxMinor, currency, locale)}`;
}
