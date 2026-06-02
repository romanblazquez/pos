/**
 * Money — immutable value object for monetary amounts.
 *
 * Amounts are stored as **integer minor units** (e.g. cents) to eliminate the
 * floating-point rounding errors that are unacceptable in a POS. All arithmetic
 * is integer arithmetic; only formatting converts to a decimal representation.
 *
 * A `Money` is always paired with an ISO-4217 `currency`; operations across
 * mismatched currencies throw, never silently coerce.
 */
export type CurrencyCode = string; // ISO-4217, e.g. 'MXN', 'USD'

export class Money {
  /** @param minorUnits integer amount in the currency's smallest unit (cents) */
  private constructor(
    public readonly minorUnits: number,
    public readonly currency: CurrencyCode,
  ) {
    if (!Number.isInteger(minorUnits)) {
      throw new Error(`Money.minorUnits must be an integer, got ${minorUnits}`);
    }
  }

  static of(minorUnits: number, currency: CurrencyCode): Money {
    return new Money(Math.round(minorUnits), currency);
  }

  /** Build from a major-unit decimal (e.g. 19.99) using 2 decimal places. */
  static fromDecimal(amount: number, currency: CurrencyCode, fractionDigits = 2): Money {
    const factor = 10 ** fractionDigits;
    return new Money(Math.round(amount * factor), currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  /** Multiply by a quantity/scalar, rounding half-up to the nearest minor unit. */
  multiply(factor: number): Money {
    return new Money(Math.round(this.minorUnits * factor), this.currency);
  }

  /** Apply a percentage (e.g. 16 for 16%) returning the percentage portion. */
  percentage(percent: number): Money {
    return new Money(Math.round((this.minorUnits * percent) / 100), this.currency);
  }

  negate(): Money {
    return new Money(-this.minorUnits, this.currency);
  }

  /** Clamp to zero — discounts must never push a line below zero. */
  clampToZero(): Money {
    return this.minorUnits < 0 ? Money.zero(this.currency) : this;
  }

  isZero(): boolean {
    return this.minorUnits === 0;
  }

  isNegative(): boolean {
    return this.minorUnits < 0;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.minorUnits > other.minorUnits;
  }

  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.minorUnits >= other.minorUnits;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  toDecimal(fractionDigits = 2): number {
    return this.minorUnits / 10 ** fractionDigits;
  }

  format(locale = 'es-MX', fractionDigits = 2): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: fractionDigits,
    }).format(this.toDecimal(fractionDigits));
  }

  toJSON(): { minorUnits: number; currency: CurrencyCode } {
    return { minorUnits: this.minorUnits, currency: this.currency };
  }

  static sum(items: readonly Money[], currency: CurrencyCode): Money {
    return items.reduce((acc, m) => acc.add(m), Money.zero(currency));
  }
}
