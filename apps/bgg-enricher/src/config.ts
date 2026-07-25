export type TranslationModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';

export interface EnricherConfig {
  batchSize: number;
  batchDelayMinMs: number;
  batchDelayMaxMs: number;
  itemDelayMs: number;
  emptyPollMs: number;
  requestTimeoutMs: number;
  maxConsecutiveFailures: number;
  maxProductAttempts: number;
  retryDelayMs: number;
  staleRunningMs: number;
  scraperUrl: string;
  stateDir: string;
  healthPort: number;
  resetCircuit: boolean;
  circuitCooldownMs: number;
  translateEnabled: boolean;
  translateTargetIso: string;
  translateTargetLocale: string;
  translateMinDelayMs: number;
  translateJitterMs: number;
  translationModerationStatus: TranslationModerationStatus;
  typesenseUrl: string | null;
  typesenseApiKey: string | null;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}; received ${JSON.stringify(raw)}`);
  }
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be true or false; received ${JSON.stringify(raw)}`);
}

export function loadConfig(): EnricherConfig {
  const batchDelayMinMs = integer('BGG_BATCH_DELAY_MIN_SECONDS', 20, 1, 3600) * 1000;
  const batchDelayMaxMs = integer('BGG_BATCH_DELAY_MAX_SECONDS', 40, 1, 3600) * 1000;
  if (batchDelayMaxMs < batchDelayMinMs) {
    throw new Error('BGG_BATCH_DELAY_MAX_SECONDS must be greater than or equal to BGG_BATCH_DELAY_MIN_SECONDS');
  }

  const moderation = (process.env.TRANSLATION_MODERATION_STATUS ?? 'NEEDS_REVIEW').toUpperCase();
  const allowedModeration = new Set<TranslationModerationStatus>(['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW']);
  if (!allowedModeration.has(moderation as TranslationModerationStatus)) {
    throw new Error('TRANSLATION_MODERATION_STATUS must be PENDING, APPROVED, REJECTED, or NEEDS_REVIEW');
  }

  const typesenseHost = process.env.TYPESENSE_HOST;
  const typesensePort = process.env.TYPESENSE_PORT ?? '8108';

  return {
    // Intentionally capped at 50: increasing concurrency or batch size is the
    // easiest way to turn this polite crawler into an accidental denial of service.
    batchSize: integer('BGG_ENRICH_BATCH_SIZE', 50, 1, 50),
    batchDelayMinMs,
    batchDelayMaxMs,
    itemDelayMs: integer('BGG_ITEM_DELAY_MS', 1500, 500, 60_000),
    emptyPollMs: integer('BGG_EMPTY_POLL_SECONDS', 300, 30, 86_400) * 1000,
    requestTimeoutMs: integer('BGG_REQUEST_TIMEOUT_MS', 45_000, 5000, 120_000),
    maxConsecutiveFailures: integer('BGG_MAX_CONSECUTIVE_FAILURES', 5, 2, 20),
    maxProductAttempts: integer('BGG_MAX_PRODUCT_ATTEMPTS', 3, 1, 10),
    retryDelayMs: integer('BGG_RETRY_DELAY_SECONDS', 21_600, 60, 604_800) * 1000,
    staleRunningMs: integer('BGG_STALE_RUNNING_MINUTES', 30, 5, 1440) * 60_000,
    scraperUrl: (process.env.BGG_SCRAPER_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
    stateDir: process.env.BGG_ENRICHER_STATE_DIR ?? './data/bgg-enricher',
    healthPort: integer('BGG_ENRICHER_HEALTH_PORT', 3002, 1, 65_535),
    resetCircuit: boolean('BGG_ENRICHER_RESET_CIRCUIT', false),
    // BGG's 403s are transient rate-limiting, but the breaker persists to disk and
    // used to latch until someone deleted the file by hand — four times it silently
    // halted enrichment for days. After this cooldown the worker retries on its own.
    circuitCooldownMs: integer('BGG_CIRCUIT_COOLDOWN_MINUTES', 120, 5, 10_080) * 60_000,
    translateEnabled: boolean('GOOGLE_TRANSLATE_ENABLED', true),
    translateTargetIso: process.env.GOOGLE_TRANSLATE_TARGET_ISO ?? 'es',
    translateTargetLocale: process.env.GOOGLE_TRANSLATE_TARGET_LOCALE ?? 'es-MX',
    // One batch-endpoint call translates title + description together. Twenty
    // calls/minute is deliberately conservative for an undocumented endpoint.
    translateMinDelayMs: integer('GOOGLE_TRANSLATE_MIN_DELAY_MS', 3000, 1000, 60_000),
    translateJitterMs: integer('GOOGLE_TRANSLATE_JITTER_MS', 1000, 0, 30_000),
    translationModerationStatus: moderation as TranslationModerationStatus,
    typesenseUrl: typesenseHost ? `http://${typesenseHost}:${typesensePort}` : null,
    typesenseApiKey: process.env.TYPESENSE_API_KEY ?? null,
  };
}
