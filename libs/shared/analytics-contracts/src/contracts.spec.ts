import { describe, expect, it } from 'vitest';
import {
  defaultConsentState, grantAll, resolveAdMode, sanitizeProperties,
  sanitizeSearchQuery, sanitizeUrl, toGoogleConsent, validateEvent, createAdRequest,
  TestAdvertisingAdapter,
} from './index.js';

describe('analytics privacy contracts', () => {
  it('defaults every optional purpose to denied', () => {
    const state = defaultConsentState('gdpr', '2026-07');
    expect(state.decisions.necessary).toBe(true);
    expect(Object.values(state.decisions).filter(Boolean)).toHaveLength(1);
    expect(toGoogleConsent(state).analytics_storage).toBe('denied');
    expect(resolveAdMode(state)).toBe('limited');
  });

  it('does not bundle session replay into accept all', () => {
    expect(grantAll().sessionReplay).toBe(false);
  });

  it('keeps limited, non-personalized and personalized ad modes distinct', async () => {
    const adapter = new TestAdvertisingAdapter();
    const denied = defaultConsentState('gdpr', '2026-07');
    await adapter.request(createAdRequest(denied, { placement: 'hub', locale: 'es', pageType: 'home' }));
    const nonPersonalized = { ...denied, decisions: { ...grantAll(), advertisingPersonalization: false } };
    await adapter.request(createAdRequest(nonPersonalized, { placement: 'hub', locale: 'es', pageType: 'home' }));
    const personalized = { ...denied, decisions: grantAll() };
    await adapter.request(createAdRequest(personalized, { placement: 'hub', locale: 'es', pageType: 'home' }));
    expect(adapter.requests.map((request) => request.mode)).toEqual(['limited', 'non-personalized', 'personalized']);
  });

  it('drops unknown, forbidden and sensitive properties', () => {
    const result = sanitizeProperties(
      { gameId: 'g1', email: 'person@example.com', note: 'person@example.com', surprise: true },
      ['gameId', 'email', 'note'],
    );
    expect(result.value).toEqual({ gameId: 'g1' });
    expect(result.issues).toHaveLength(3);
  });

  it('removes unsafe URL parameters and fragments', () => {
    const result = sanitizeUrl('/games/catan?q=catan&token=secret#access_token=x');
    expect(result).toEqual({ path: '/games/catan', query: { q: 'catan' }, droppedParams: ['token'] });
  });

  it('redacts search-shaped PII but preserves aggregate shape', () => {
    expect(sanitizeSearchQuery('person@example.com')).toMatchObject({
      normalized: null, redactedReason: 'email', wordCount: 1,
    });
  });

  it('rejects malformed events and sanitizes accepted events', () => {
    const event = validateEvent({
      eventId: 'event_123456',
      type: 'search_submitted',
      occurredAt: new Date().toISOString(),
      url: '/search?q=catan&email=x@example.com',
      properties: { query: 'Catan', password: 'nope', surface: 'header' },
    });
    expect(event.accepted).toBe(true);
    expect(event.event?.query).toEqual({ q: 'catan' });
    expect(event.event?.properties).toMatchObject({ query: 'catan', surface: 'header' });
  });
});
