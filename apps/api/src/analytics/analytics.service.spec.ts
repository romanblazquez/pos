import { describe, expect, it } from 'vitest';
import { AnalyticsService, requestDimensions } from './analytics.service.js';
import { defaultConsentState } from '@retail-os/analytics-contracts';

describe('AnalyticsService consent enforcement', () => {
  it('derives bounded request dimensions without retaining the raw IP or user agent', () => {
    const dimensions = requestDimensions({
      countryCode: 'GB',
      regionCode: 'ENG',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    });
    expect(dimensions).toEqual({
      countryCode: 'GB',
      regionCode: 'ENG',
      deviceClass: 'mobile',
      browserFamily: 'Safari',
      osFamily: 'iOS',
    });
    expect(JSON.stringify(dimensions)).not.toContain('Mozilla');
  });

  it('rejects an event batch before touching storage when analytics is denied', async () => {
    const prisma = new Proxy({}, {
      get() { throw new Error('database must not be touched'); },
    });
    const service = new AnalyticsService(prisma as never);
    const result = await service.collect({
      schemaVersion: 1,
      sessionId: 'ses_1234567890123456',
      consent: defaultConsentState('gdpr', '2026-07'),
      events: [{
        eventId: 'evt_12345678', type: 'page_view',
        occurredAt: new Date().toISOString(), properties: {},
      }],
    });
    expect(result).toEqual({ accepted: 0, rejected: 1, reason: 'consent-required' });
  });
});
