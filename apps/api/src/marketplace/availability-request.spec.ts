import { describe, expect, it } from 'vitest';
import { MAX_EMAIL_LENGTH, normalizeAvailabilityRequest } from './availability-request.js';

const MARKETS = ['MX', 'AR'];
const ask = (input: { email?: string; market?: string; locale?: string }) =>
  normalizeAvailabilityRequest(input, MARKETS);

describe('availability request validation', () => {
  it('accepts a plain request and keeps the market it was made in', () => {
    const result = ask({ email: 'shopper@example.com', market: 'MX', locale: 'es' });
    expect(result).toEqual({
      ok: true,
      value: { email: 'shopper@example.com', marketCode: 'MX', locale: 'es' },
    });
  });

  it('collapses case and whitespace so one person cannot be mailed twice', () => {
    // Both of these must land on the same unique index row.
    const a = ask({ email: '  Shopper@Example.COM ', market: 'mx' });
    const b = ask({ email: 'shopper@example.com', market: 'MX' });
    expect(a.ok && b.ok && a.value.email).toBe(b.ok ? b.value.email : null);
    expect(a.ok && a.value.marketCode).toBe('MX');
  });

  it('rejects an unknown market instead of filing it against the default', () => {
    // Falling back to MX here would leave a shopper waiting on an answer about
    // a country they never asked about.
    expect(ask({ email: 'a@b.com', market: 'ZZ' })).toEqual({ ok: false, error: 'unknown_market' });
    expect(ask({ email: 'a@b.com' })).toEqual({ ok: false, error: 'unknown_market' });
  });

  it('rejects addresses that cannot be delivered to', () => {
    for (const email of ['', '   ', 'nope', 'a@b', 'a b@c.com', 'a@@b.com', '@b.com', 'a@.com']) {
      expect(ask({ email, market: 'MX' }), email).toEqual({ ok: false, error: 'invalid_email' });
    }
  });

  it('bounds the address length', () => {
    const long = `${'a'.repeat(MAX_EMAIL_LENGTH)}@example.com`;
    expect(ask({ email: long, market: 'MX' })).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('accepts the real shapes people actually have', () => {
    for (const email of [
      'first.last@example.co.uk',
      'user+tag@example.com',
      "o'brien@example.com",
      'user_name@sub.example.mx',
    ]) {
      expect(ask({ email, market: 'AR' }).ok, email).toBe(true);
    }
  });

  it('defaults an unrecognised language to Spanish rather than guessing', () => {
    expect(ask({ email: 'a@b.com', market: 'MX', locale: 'fr' })).toMatchObject({
      ok: true,
      value: { locale: 'es' },
    });
    expect(ask({ email: 'a@b.com', market: 'MX', locale: 'EN' })).toMatchObject({
      ok: true,
      value: { locale: 'en' },
    });
  });
});
