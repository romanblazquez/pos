import type { ReactElement } from 'react';

export interface MoneyDTO {
  minorUnits: number;
  currency: string;
}

/** Default display locale used across apps until per-market locale resolution lands. */
export const DEFAULT_LOCALE = 'es-MX';

/** Format an integer-minor-units amount as a localized currency string. */
export function formatMoney(money: MoneyDTO, locale = DEFAULT_LOCALE, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(money.minorUnits / 10 ** fractionDigits);
}

/** Inline currency display primitive used throughout the POS. */
export function Currency({ value, locale }: { value: MoneyDTO; locale?: string }): ReactElement {
  return <span className="rt-currency">{formatMoney(value, locale)}</span>;
}
