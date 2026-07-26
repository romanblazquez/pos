/**
 * Validation for "tell me when this is available here" requests.
 *
 * Pure functions, kept apart from the service so the rules are testable without
 * a database: this endpoint is public and unauthenticated, so it is the one
 * place a stranger can write a row, and what it accepts is worth pinning down.
 */

/** Longest address RFC 5321 permits, and a sane upper bound for a text column. */
export const MAX_EMAIL_LENGTH = 254;

// Deliberately permissive within one obvious shape. Address syntax is famously
// baroque, and a regex that tries to be authoritative rejects real addresses;
// the only proof an address works is a delivered message.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type AvailabilityRequestError = 'invalid_email' | 'unknown_market';

export interface NormalizedAvailabilityRequest {
  email: string;
  marketCode: string;
  locale: string;
}

/**
 * Normalize and check a request, or say why it cannot be accepted.
 *
 * The email is lower-cased and trimmed so that `A@x.com` and `a@x.com ` collapse
 * onto the unique index instead of producing two rows that both get mailed.
 */
export function normalizeAvailabilityRequest(
  input: { email?: string; market?: string; locale?: string },
  knownMarkets: readonly string[],
): { ok: true; value: NormalizedAvailabilityRequest } | { ok: false; error: AvailabilityRequestError } {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) {
    return { ok: false, error: 'invalid_email' };
  }

  // The market decides who we are waiting on: an offer appearing in Argentina
  // is not an answer for a shopper in Mexico. An unrecognised market must fail
  // rather than fall back to the default, or the request is silently filed
  // against a country the shopper never asked about.
  const marketCode = (input.market ?? '').trim().toUpperCase();
  if (!marketCode || !knownMarkets.includes(marketCode)) {
    return { ok: false, error: 'unknown_market' };
  }

  const locale = (input.locale ?? '').trim().toLowerCase();
  return {
    ok: true,
    value: { email, marketCode, locale: locale === 'en' ? 'en' : 'es' },
  };
}
