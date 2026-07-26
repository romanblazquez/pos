import type { ReactElement } from 'react';

export interface MoneyDTO {
  minorUnits: number;
  currency: string;
}

/** Default display locale used across apps until per-market locale resolution lands. */
export const DEFAULT_LOCALE = 'es-MX';

/** Minor units per major unit. Most currencies are 100; a few are not. */
const MINOR_UNITS_PER_MAJOR: Readonly<Record<string, number>> = {
  CLP: 1, JPY: 1, KRW: 1, ISK: 1, VND: 1,
  BHD: 1000, KWD: 1000, OMR: 1000, TND: 1000,
};

/**
 * Format an integer-minor-units amount as a localized currency string.
 *
 * `fractionDigits` controls DISPLAY precision only. It used to double as the
 * minor-unit divisor (`minorUnits / 10 ** fractionDigits`), so asking for whole
 * pesos — `fractionDigits: 0` — divided by 1 and multiplied every price on the
 * SEO site by 100: a $5,100 game advertised at $510,000. The scale of a currency
 * is a property of the currency, never of how many decimals you want to show.
 */
export function formatMoney(money: MoneyDTO, locale = DEFAULT_LOCALE, fractionDigits = 2): string {
  const scale = MINOR_UNITS_PER_MAJOR[money.currency?.toUpperCase()] ?? 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(money.minorUnits / scale);
}

/** Inline currency display primitive used throughout the POS. */
export function Currency({ value, locale }: { value: MoneyDTO; locale?: string }): ReactElement {
  return <span className="rt-currency">{formatMoney(value, locale)}</span>;
}
