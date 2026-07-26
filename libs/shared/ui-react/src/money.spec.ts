import { describe, expect, it } from 'vitest';
import { formatMoney } from './money.js';

// Assertions pin en-US so the separators are deterministic — Spanish locales
// disagree on whether "." groups thousands or marks decimals, which is a
// property of the locale under test, not of the scaling this suite is about.
const digits = (value: string) => value.replace(/[^\d.,]/g, '');

describe('formatMoney', () => {
  it('divides minor units by the currency scale, not the display precision', () => {
    // The regression this guards: fractionDigits used to double as the divisor,
    // so asking for whole pesos rendered a $5,100 game as $510,000.
    expect(digits(formatMoney({ minorUnits: 510_000, currency: 'MXN' }, 'en-US', 0))).toBe('5,100');
    expect(digits(formatMoney({ minorUnits: 510_000, currency: 'MXN' }, 'en-US', 2))).toBe('5,100.00');
  });

  it('shows the same amount whatever precision is requested', () => {
    const whole = formatMoney({ minorUnits: 59_900, currency: 'MXN' }, 'en-US', 0);
    const cents = formatMoney({ minorUnits: 59_900, currency: 'MXN' }, 'en-US', 2);
    expect(digits(whole)).toBe('599');
    expect(digits(cents)).toBe('599.00');
  });

  it('keeps the default two-decimal behaviour other apps rely on', () => {
    expect(digits(formatMoney({ minorUnits: 12_345, currency: 'MXN' }, 'en-US'))).toBe('123.45');
  });

  it('formats Argentine pesos on the same scale as Mexican ones', () => {
    expect(digits(formatMoney({ minorUnits: 4_500_000, currency: 'ARS' }, 'en-US', 0))).toBe('45,000');
  });

  it('respects currencies that are not hundredths', () => {
    // CLP has no minor unit: 45,000 minor units is 45,000 pesos, not 450.
    expect(digits(formatMoney({ minorUnits: 45_000, currency: 'CLP' }, 'en-US', 0))).toBe('45,000');
  });
});

describe('currency disambiguation', () => {
  // MXN, ARS and USD all render as a bare "$" in a Spanish locale, so a symbol
  // alone cannot tell a shopper which money a price is in. Any surface showing
  // more than one currency must use the code.
  it('distinguishes currencies that share the dollar sign', () => {
    const mxn = formatMoney({ minorUnits: 70_000, currency: 'MXN' }, 'es-MX', 0, 'code');
    const ars = formatMoney({ minorUnits: 70_000, currency: 'ARS' }, 'es-MX', 0, 'code');
    const usd = formatMoney({ minorUnits: 70_000, currency: 'USD' }, 'es-MX', 0, 'code');

    expect(mxn).toContain('MXN');
    expect(ars).toContain('ARS');
    expect(usd).toContain('USD');
    expect(new Set([mxn, ars, usd]).size).toBe(3);
  });

  it('still offers bare symbols for single-currency surfaces like the POS', () => {
    expect(formatMoney({ minorUnits: 70_000, currency: 'MXN' }, 'es-MX', 0)).toContain('$');
  });
});
