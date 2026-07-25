import type { AnalyticsCapability, ConsentState } from './consent.js';
import {
  LIMITS,
  byteSize,
  sanitizeProperties,
  sanitizeReferrer,
  sanitizeSearchQuery,
  sanitizeUrl,
  type SanitizedProperties,
  type SanitizeIssue,
} from './sanitize.js';

export const ANALYTICS_EVENT_TYPES = [
  'page_view', 'navigation', 'search_submitted', 'search_results', 'filter_changed',
  'game_viewed', 'category_viewed', 'guide_viewed', 'comparison_changed',
  'wishlist_changed', 'offer_viewed', 'affiliate_click', 'account_started',
  'account_completed', 'login_completed', 'consent_updated', 'preference_provided',
  'web_vital', 'client_error', 'ad_impression', 'ad_click', 'experiment_exposure',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const EVENT_CAPABILITY: Record<AnalyticsEventType, AnalyticsCapability> = {
  page_view: 'events',
  navigation: 'events',
  search_submitted: 'events',
  search_results: 'events',
  filter_changed: 'events',
  game_viewed: 'events',
  category_viewed: 'events',
  guide_viewed: 'events',
  comparison_changed: 'events',
  wishlist_changed: 'events',
  offer_viewed: 'events',
  affiliate_click: 'attribution',
  account_started: 'events',
  account_completed: 'events',
  login_completed: 'events',
  consent_updated: 'events',
  preference_provided: 'personalization',
  web_vital: 'uxDiagnostics',
  client_error: 'uxDiagnostics',
  ad_impression: 'attribution',
  ad_click: 'attribution',
  experiment_exposure: 'experiments',
};

const COMMON = ['pageType', 'locale', 'countryCode', 'entityType', 'entityId'] as const;
export const EVENT_PROPERTIES: Record<AnalyticsEventType, readonly string[]> = {
  page_view: [...COMMON, 'title'],
  navigation: [...COMMON, 'navigationType'],
  search_submitted: [...COMMON, 'query', 'queryLength', 'queryWordCount', 'queryRedacted', 'surface'],
  search_results: [...COMMON, 'query', 'queryLength', 'resultCount', 'latencyMs', 'zeroResults'],
  filter_changed: [...COMMON, 'filter', 'value', 'activeCount'],
  game_viewed: [...COMMON, 'slug', 'position'],
  category_viewed: [...COMMON, 'slug', 'position'],
  guide_viewed: [...COMMON, 'slug', 'position'],
  comparison_changed: [...COMMON, 'action', 'itemCount'],
  wishlist_changed: [...COMMON, 'action'],
  offer_viewed: [...COMMON, 'offerId', 'sellerId', 'position', 'priceMinor', 'currency'],
  affiliate_click: [...COMMON, 'offerId', 'sellerId', 'partner', 'position', 'destinationHost'],
  account_started: [...COMMON, 'method'],
  account_completed: [...COMMON, 'method'],
  login_completed: [...COMMON, 'method'],
  consent_updated: ['policyVersion', 'consentVersion', 'source'],
  preference_provided: [...COMMON, 'preference', 'value', 'explicit'],
  web_vital: [...COMMON, 'name', 'value', 'rating', 'navigationType'],
  client_error: [...COMMON, 'errorType', 'component', 'messageCode', 'fatal'],
  ad_impression: [...COMMON, 'provider', 'placement', 'creativeId', 'campaignId', 'mode'],
  ad_click: [...COMMON, 'provider', 'placement', 'creativeId', 'campaignId', 'mode'],
  experiment_exposure: [...COMMON, 'experimentKey', 'variant'],
};

export interface AnalyticsEventInput {
  eventId: string;
  type: AnalyticsEventType;
  occurredAt: string;
  url?: string;
  referrer?: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsBatch {
  schemaVersion: 1;
  visitorId?: string;
  sessionId: string;
  consent: ConsentState;
  events: AnalyticsEventInput[];
  context?: {
    locale?: string;
    timezone?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    userAgentFamily?: string;
  };
}

export interface SanitizedEvent extends Omit<AnalyticsEventInput, 'url' | 'referrer' | 'properties'> {
  path: string;
  query: Record<string, string>;
  referrerHost: string | null;
  properties: SanitizedProperties;
}

export interface EventValidation {
  accepted: boolean;
  event?: SanitizedEvent;
  issues: SanitizeIssue[];
  reason?: string;
}

export function isAnalyticsEventType(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}

export function validateEvent(input: AnalyticsEventInput, selfHost?: string): EventValidation {
  if (!isAnalyticsEventType(input.type)) return { accepted: false, issues: [], reason: 'unknown-event' };
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.eventId)) {
    return { accepted: false, issues: [], reason: 'invalid-event-id' };
  }
  const occurredAt = Date.parse(input.occurredAt);
  if (!Number.isFinite(occurredAt) || Math.abs(Date.now() - occurredAt) > 7 * 86_400_000) {
    return { accepted: false, issues: [], reason: 'invalid-occurred-at' };
  }

  const url = sanitizeUrl(input.url ?? '/');
  const sanitized = sanitizeProperties(input.properties, EVENT_PROPERTIES[input.type]);
  if (input.type === 'search_submitted' || input.type === 'search_results') {
    const raw = typeof input.properties?.query === 'string' ? input.properties.query : '';
    const query = sanitizeSearchQuery(raw);
    sanitized.value.query = query.normalized;
    sanitized.value.queryLength = query.length;
    sanitized.value.queryWordCount = query.wordCount;
    sanitized.value.queryRedacted = Boolean(query.redactedReason);
  }
  const event: SanitizedEvent = {
    eventId: input.eventId,
    type: input.type,
    occurredAt: new Date(occurredAt).toISOString(),
    path: url.path,
    query: url.query,
    referrerHost: sanitizeReferrer(input.referrer ?? '', selfHost),
    properties: sanitized.value,
  };
  if (byteSize(event) > LIMITS.maxPayloadBytes) {
    return { accepted: false, issues: sanitized.issues, reason: 'payload-too-large' };
  }
  return { accepted: true, event, issues: sanitized.issues };
}

