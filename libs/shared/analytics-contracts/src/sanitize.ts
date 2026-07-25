// Sanitation — the layer that makes "we accidentally logged passwords" a
// structural impossibility rather than a code-review responsibility.
//
// Two rules drive everything here:
//
//  1. Allowlist, never blocklist. A property that no schema declares is dropped.
//     Blocklists fail the moment someone invents a new field name.
//  2. The server re-runs it. The browser sanitizes so bad data never leaves the
//     device; the collector sanitizes again because a client is not trustworthy.
//
// Rejection is loud (the reason is returned) but never throws into a user's
// path — instrumentation must not be able to break navigation.

/** Keys that must never appear in an event payload, whatever a schema says. */
const FORBIDDEN_KEY_PATTERN =
  /(pass(word|wd|phrase)|secret|token|jwt|bearer|auth|credential|session[_-]?id$|api[_-]?key|private[_-]?key|signature|otp|mfa|cvv|cvc|card[_-]?number|pan\b|iban|ssn|curp|rfc|tax[_-]?id|dob|birth|email|e[_-]?mail|phone|mobile|tel\b|address|street|postcode|zip|lat(itude)?$|lon(gitude)?$|geo|ip[_-]?addr)/i;

/** Values that look like credentials or contact details regardless of key. */
const SENSITIVE_VALUE_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'email', pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./ },
  { name: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}/i },
  // 13–19 digits, optionally spaced/hyphened — card-shaped.
  { name: 'card', pattern: /\b(?:\d[ -]?){13,19}\b/ },
  { name: 'privateKey', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // Long random-looking strings are far more often a token than a legitimate
  // analytics value, so they are refused rather than guessed at.
  { name: 'highEntropy', pattern: /\b[A-Za-z0-9_-]{40,}\b/ },
];

export interface SanitizeIssue {
  key: string;
  reason: string;
}

export interface SanitizeResult<T> {
  value: T;
  issues: SanitizeIssue[];
}

/** Caps that bound payload size without needing a byte-counter everywhere. */
export const LIMITS = {
  maxStringLength: 512,
  maxArrayLength: 50,
  maxProperties: 60,
  maxPayloadBytes: 64 * 1024,
  maxBatchEvents: 50,
} as const;

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key);
}

/** Returns the name of the first sensitive pattern a string matches, if any. */
export function detectSensitiveValue(value: string): string | null {
  for (const { name, pattern } of SENSITIVE_VALUE_PATTERNS) {
    if (pattern.test(value)) return name;
  }
  return null;
}

type Primitive = string | number | boolean | null;
export type SanitizedValue = Primitive | Primitive[];
export type SanitizedProperties = Record<string, SanitizedValue>;

/**
 * Reduce one value to something safe to store, or reject it.
 *
 * Objects are rejected outright rather than flattened: nested structures are how
 * a whole user profile ends up in an event by accident. Callers that need
 * structure declare explicit scalar keys instead.
 */
function sanitizeValue(input: unknown): { value?: SanitizedValue; reason?: string } {
  if (input === undefined || input === null) return {};

  if (typeof input === 'number') {
    return Number.isFinite(input) ? { value: input } : { reason: 'non-finite-number' };
  }
  if (typeof input === 'boolean') return { value: input };

  if (typeof input === 'string') {
    const sensitive = detectSensitiveValue(input);
    if (sensitive) return { reason: `sensitive-value:${sensitive}` };
    return { value: input.slice(0, LIMITS.maxStringLength) };
  }

  if (Array.isArray(input)) {
    const out: Primitive[] = [];
    for (const item of input.slice(0, LIMITS.maxArrayLength)) {
      if (item === null) continue;
      const t = typeof item;
      if (t !== 'string' && t !== 'number' && t !== 'boolean') return { reason: 'nested-array-value' };
      if (t === 'string') {
        const sensitive = detectSensitiveValue(item as string);
        if (sensitive) return { reason: `sensitive-value:${sensitive}` };
        out.push((item as string).slice(0, LIMITS.maxStringLength));
      } else {
        out.push(item as Primitive);
      }
    }
    return { value: out };
  }

  return { reason: `unsupported-type:${typeof input}` };
}

/**
 * Sanitize a property bag against an allowlist of permitted keys.
 *
 * `allowed` is the event's declared schema. Anything outside it is dropped with
 * an issue recorded, which is what turns "developer typo" into a visible signal
 * instead of silent data loss.
 */
export function sanitizeProperties(
  input: Record<string, unknown> | undefined,
  allowed: readonly string[],
): SanitizeResult<SanitizedProperties> {
  const issues: SanitizeIssue[] = [];
  const value: SanitizedProperties = {};
  if (!input) return { value, issues };

  const allowedSet = new Set(allowed);
  let count = 0;

  for (const [key, raw] of Object.entries(input)) {
    if (count >= LIMITS.maxProperties) {
      issues.push({ key, reason: 'too-many-properties' });
      break;
    }
    if (isForbiddenKey(key)) {
      issues.push({ key, reason: 'forbidden-key' });
      continue;
    }
    if (!allowedSet.has(key)) {
      issues.push({ key, reason: 'not-in-schema' });
      continue;
    }
    const { value: clean, reason } = sanitizeValue(raw);
    if (reason) {
      issues.push({ key, reason });
      continue;
    }
    if (clean === undefined) continue;
    value[key] = clean;
    count += 1;
  }

  return { value, issues };
}

// ── URLs ─────────────────────────────────────────────────────────────────────

/**
 * Query parameters worth keeping. Everything else is stripped, because URLs are
 * where password-reset tokens, invite codes and email addresses travel.
 */
export const ALLOWED_QUERY_PARAMS = [
  'q',
  'page',
  'sort',
  'category',
  'players',
  'complexity',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'dclid',
  'wbraid',
  'gbraid',
  'msclkid',
  'fbclid',
  'ref',
  'aff',
  'partner',
] as const;

export interface SanitizedUrl {
  /** Path only, with identifiers intact. */
  path: string;
  /** Allowlisted query parameters, in sorted order. */
  query: Record<string, string>;
  /** Names of parameters that were dropped — the count matters, not the values. */
  droppedParams: string[];
}

/**
 * Strip a URL to a path plus allowlisted parameters.
 *
 * Fragments are discarded entirely: they are client-only, frequently used to
 * carry tokens by OAuth implicit flows, and never needed for analytics.
 */
export function sanitizeUrl(input: string, base = 'https://juegospedia.com'): SanitizedUrl {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return { path: '/', query: {}, droppedParams: [] };
  }

  const allowed = new Set<string>(ALLOWED_QUERY_PARAMS);
  const query: Record<string, string> = {};
  const droppedParams: string[] = [];

  for (const key of [...url.searchParams.keys()].sort()) {
    const raw = url.searchParams.get(key) ?? '';
    if (!allowed.has(key) || isForbiddenKey(key) || detectSensitiveValue(raw)) {
      droppedParams.push(key);
      continue;
    }
    query[key] = raw.slice(0, LIMITS.maxStringLength);
  }

  return { path: url.pathname.slice(0, LIMITS.maxStringLength), query, droppedParams };
}

/**
 * Reduce a referrer to its registrable-ish domain.
 *
 * Full referrer URLs leak the previous page's own query string, which we have no
 * control over — so only the host survives. Same-origin referrers collapse to
 * `internal` so they cannot be used to reconstruct a browsing trail.
 */
export function sanitizeReferrer(referrer: string, selfHost?: string): string | null {
  if (!referrer) return null;
  try {
    const { hostname } = new URL(referrer);
    if (selfHost && hostname === selfHost) return 'internal';
    return hostname.replace(/^www\./, '').slice(0, 253);
  } catch {
    return null;
  }
}

// ── Search text ──────────────────────────────────────────────────────────────

export interface SanitizedQuery {
  /** Lowercased, collapsed query — only when it passes every check. */
  normalized: string | null;
  length: number;
  wordCount: number;
  /** Why the text was withheld, for the admin UI to surface honestly. */
  redactedReason?: string;
}

/**
 * Search text is the highest-risk free-text we collect: people paste order
 * numbers, emails and worse into search boxes. It is kept only when it looks
 * like an ordinary product query, and the shape (length, word count) is always
 * kept so search analytics still work when the text is withheld.
 */
export function sanitizeSearchQuery(raw: string): SanitizedQuery {
  const trimmed = raw.trim();
  const length = trimmed.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  if (!trimmed) return { normalized: null, length: 0, wordCount: 0 };

  const sensitive = detectSensitiveValue(trimmed);
  if (sensitive) return { normalized: null, length, wordCount, redactedReason: sensitive };
  if (length > 120) return { normalized: null, length, wordCount, redactedReason: 'too-long' };
  // Long digit runs are order numbers, phone numbers or card fragments.
  if (/\d{7,}/.test(trimmed)) return { normalized: null, length, wordCount, redactedReason: 'numeric-run' };

  return { normalized: trimmed.toLowerCase().replace(/\s+/g, ' '), length, wordCount };
}

/** Rough byte size, for payload limits without pulling in Buffer. */
export function byteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
