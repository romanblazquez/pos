import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { Prisma, type AnalyticsVisitor } from '@prisma/client';
import { PrismaService } from '@retail-os/db-postgres';
import {
  LIMITS, allows, byteSize, validateEvent, type AnalyticsBatch, type ConsentState,
} from '@retail-os/analytics-contracts';

const TENANT_ID = process.env.ANALYTICS_TENANT_ID ?? 'tenant-demo';
const RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 395);
const CONSENT_RETENTION_DAYS = Number(process.env.ANALYTICS_CONSENT_RETENTION_DAYS ?? 2190);

export interface RequestContext {
  countryCode?: string;
  regionCode?: string;
  userAgent?: string;
}

export function requestDimensions(context?: RequestContext) {
  const rawCountry = context?.countryCode ?? '';
  const countryCode = /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== 'XX'
    ? rawCountry
    : undefined;
  const regionCode = /^[A-Za-z0-9-]{1,16}$/.test(context?.regionCode ?? '')
    ? context?.regionCode?.toUpperCase()
    : undefined;
  const ua = (context?.userAgent ?? '').slice(0, 512);
  const deviceClass = /bot|crawler|spider/i.test(ua) ? 'bot'
    : /ipad|tablet|kindle|silk/i.test(ua) ? 'tablet'
      : /mobi|iphone|android/i.test(ua) ? 'mobile'
        : ua ? 'desktop' : 'unknown';
  const browserFamily = /edg\//i.test(ua) ? 'Edge'
    : /opr\/|opera/i.test(ua) ? 'Opera'
      : /firefox\/|fxios\//i.test(ua) ? 'Firefox'
        : /crios\/|chrome\//i.test(ua) ? 'Chrome'
          : /safari\//i.test(ua) ? 'Safari'
            : ua ? 'Other' : 'Unknown';
  const osFamily = /windows/i.test(ua) ? 'Windows'
    : /android/i.test(ua) ? 'Android'
      : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
        : /mac os|macintosh/i.test(ua) ? 'macOS'
          : /linux/i.test(ua) ? 'Linux'
            : ua ? 'Other' : 'Unknown';
  return { countryCode, regionCode, deviceClass, browserFamily, osFamily };
}

function analyticsSecret(): string {
  const secret = process.env.ANALYTICS_HMAC_SECRET
    ?? process.env.CREDENTIAL_ENCRYPTION_KEY
    ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ANALYTICS_HMAC_SECRET (32+ chars) is required in production');
    }
    return 'development-analytics-secret-change-me';
  }
  return secret;
}

function hashIdentifier(value: string): string {
  return createHmac('sha256', analyticsSecret()).update(value).digest('hex');
}

function validOpaqueId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{16,100}$/.test(value);
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private assertConsentShape(state: ConsentState): void {
    if (!state?.decisions || state.decisions.necessary !== true) {
      throw new BadRequestException('Invalid consent state');
    }
    if (!state.policyVersion || !state.consentVersion || !state.regime || !state.source) {
      throw new BadRequestException('Incomplete consent evidence');
    }
  }

  private async visitor(
    rawVisitorId: string,
    context?: AnalyticsBatch['context'],
    requestContext?: RequestContext,
  ): Promise<AnalyticsVisitor> {
    if (!validOpaqueId(rawVisitorId)) throw new BadRequestException('Invalid visitor id');
    const publicIdHash = hashIdentifier(rawVisitorId);
    const request = requestDimensions(requestContext);
    return this.prisma.analyticsVisitor.upsert({
      where: { tenantId_publicIdHash: { tenantId: TENANT_ID, publicIdHash } },
      create: {
        tenantId: TENANT_ID, publicIdHash, locale: context?.locale?.slice(0, 12),
        timezone: context?.timezone?.slice(0, 64),
        countryCode: request.countryCode, regionCode: request.regionCode,
      },
      update: {
        lastSeenAt: new Date(), locale: context?.locale?.slice(0, 12),
        timezone: context?.timezone?.slice(0, 64),
        countryCode: request.countryCode, regionCode: request.regionCode,
      },
    });
  }

  async recordConsent(rawVisitorId: string | undefined, state: ConsentState, accountPrincipalId?: string) {
    this.assertConsentShape(state);
    const visitor = rawVisitorId && validOpaqueId(rawVisitorId)
      ? await this.visitor(rawVisitorId)
      : undefined;
    const publicId = randomUUID();
    return this.prisma.analyticsConsent.create({
      data: {
        publicId, tenantId: TENANT_ID, visitorId: visitor?.id, accountPrincipalId,
        policyVersion: state.policyVersion, consentVersion: state.consentVersion,
        regime: state.regime, source: state.source,
        decisions: state.decisions as unknown as Prisma.InputJsonValue,
        tcfStringHash: state.tcfString ? hashIdentifier(state.tcfString) : undefined,
        cmpName: state.cmpName?.slice(0, 80), cmpVersion: state.cmpVersion?.slice(0, 40),
        withdrawnAt: state.source === 'withdrawn' ? new Date() : undefined,
      },
      select: { publicId: true, recordedAt: true },
    });
  }

  async collect(batch: AnalyticsBatch, requestContext?: RequestContext) {
    this.assertConsentShape(batch.consent);
    if (byteSize(batch) > LIMITS.maxPayloadBytes) throw new BadRequestException('Batch too large');
    if (!Array.isArray(batch.events) || batch.events.length > LIMITS.maxBatchEvents) {
      throw new BadRequestException('Invalid batch size');
    }
    if (!allows(batch.consent, 'events')) {
      return { accepted: 0, rejected: batch.events.length, reason: 'consent-required' };
    }
    if (!batch.visitorId || !validOpaqueId(batch.sessionId)) {
      throw new BadRequestException('Visitor and session identifiers are required');
    }

    const visitor = await this.visitor(batch.visitorId, batch.context, requestContext);
    const request = requestDimensions(requestContext);
    const sessionIdHash = hashIdentifier(batch.sessionId);
    const accepted = batch.events
      .map((event) => ({ input: event, validation: validateEvent(event) }))
      .filter(({ input, validation }) => validation.accepted
        && validation.event
        && allows(batch.consent, input.type === 'web_vital' || input.type === 'client_error'
          ? 'uxDiagnostics'
          : input.type === 'preference_provided'
            ? 'personalization'
            : input.type === 'affiliate_click' || input.type.startsWith('ad_')
              ? 'attribution'
              : 'events'));

    if (!accepted.length) return { accepted: 0, rejected: batch.events.length };

    const first = accepted[0].validation.event!;
    await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.analyticsEvent.createMany({
        skipDuplicates: true,
        data: accepted.map(({ validation }) => {
          const event = validation.event!;
          const properties = event.properties;
          const safeQuery = Object.fromEntries(Object.entries(event.query).filter(([key]) =>
            !['gclid', 'dclid', 'wbraid', 'gbraid', 'msclkid', 'fbclid'].includes(key)));
          return {
            tenantId: TENANT_ID, eventId: event.eventId, eventType: event.type,
            occurredAt: new Date(event.occurredAt), anonymousVisitorIdHash: visitor.publicIdHash,
            sessionIdHash, customerId: visitor.accountPrincipalId,
            entityType: typeof properties.entityType === 'string' ? properties.entityType : undefined,
            entityId: typeof properties.entityId === 'string' ? properties.entityId : undefined,
            sellerId: typeof properties.sellerId === 'string' ? properties.sellerId : undefined,
            offerId: typeof properties.offerId === 'string' ? properties.offerId : undefined,
            locale: batch.context?.locale,
            pageType: typeof properties.pageType === 'string' ? properties.pageType : undefined,
            position: typeof properties.position === 'number' ? properties.position : undefined,
            path: event.path, referrerHost: event.referrerHost,
            consentPublicId: batch.consent.consentPublicId,
            metadata: { ...properties, query: safeQuery } as Prisma.InputJsonValue,
          };
        }),
      });
      const insertedPageViews = inserted.count === accepted.length
        ? accepted.filter(({ input }) => input.type === 'page_view').length
        : 0;
      await tx.analyticsSession.upsert({
        where: { tenantId_sessionIdHash: { tenantId: TENANT_ID, sessionIdHash } },
        create: {
          tenantId: TENANT_ID, sessionIdHash, visitorId: visitor.id,
          entryPath: first.path, exitPath: accepted.at(-1)?.validation.event?.path,
          eventCount: inserted.count, pageViewCount: insertedPageViews,
          deviceClass: request.deviceClass, browserFamily: request.browserFamily,
          osFamily: request.osFamily,
        },
        update: {
          lastActivityAt: new Date(),
          exitPath: accepted.at(-1)?.validation.event?.path,
          eventCount: { increment: inserted.count },
          pageViewCount: { increment: insertedPageViews },
          deviceClass: request.deviceClass, browserFamily: request.browserFamily,
          osFamily: request.osFamily,
        },
      });
      if (inserted.count === 0) return;
      for (const { validation } of accepted) {
        const event = validation.event!;
        const properties = event.properties;
        if (event.type === 'preference_provided'
          && typeof properties.preference === 'string'
          && properties.value !== undefined) {
          await tx.analyticsPreference.upsert({
            where: {
              tenantId_visitorId_key: {
                tenantId: TENANT_ID, visitorId: visitor.id, key: properties.preference,
              },
            },
            create: {
              tenantId: TENANT_ID, visitorId: visitor.id, key: properties.preference,
              value: properties.value as Prisma.InputJsonValue,
              explicit: properties.explicit !== false, source: 'browser',
            },
            update: {
              value: properties.value as Prisma.InputJsonValue,
              explicit: properties.explicit !== false, source: 'browser',
            },
          });
        }
        if (event.type === 'experiment_exposure'
          && typeof properties.experimentKey === 'string'
          && typeof properties.variant === 'string') {
          await tx.analyticsExperimentAssignment.upsert({
            where: {
              tenantId_visitorId_experimentKey: {
                tenantId: TENANT_ID, visitorId: visitor.id,
                experimentKey: properties.experimentKey,
              },
            },
            create: {
              tenantId: TENANT_ID, visitorId: visitor.id,
              experimentKey: properties.experimentKey, variant: properties.variant,
            },
            update: {},
          });
        }
        if (event.type === 'affiliate_click') {
          await tx.analyticsAttribution.create({
            data: {
              tenantId: TENANT_ID, visitorId: visitor.id, sessionIdHash,
              touchType: 'affiliate_click',
              provider: typeof properties.partner === 'string' ? properties.partner : 'affiliate',
              affiliateId: typeof properties.offerId === 'string' ? properties.offerId : undefined,
              landingPath: event.path, occurredAt: new Date(event.occurredAt),
              expiresAt: new Date(Date.now() + 90 * 86_400_000),
            },
          });
        }
      }
      if (allows(batch.consent, 'attribution')) {
        const clickId = first.query.gclid ?? first.query.dclid ?? first.query.wbraid
          ?? first.query.gbraid ?? first.query.msclkid ?? first.query.fbclid;
        const source = first.query.utm_source ?? first.query.ref ?? first.query.partner;
        if (source || clickId || first.query.aff) {
          await tx.analyticsAttribution.create({
            data: {
              tenantId: TENANT_ID, visitorId: visitor.id, sessionIdHash,
              touchType: 'landing', provider: clickId ? 'advertising' : first.query.aff ? 'affiliate' : 'campaign',
              source: source?.slice(0, 120), medium: first.query.utm_medium?.slice(0, 120),
              campaign: first.query.utm_campaign?.slice(0, 160),
              term: first.query.utm_term?.slice(0, 160), content: first.query.utm_content?.slice(0, 160),
              clickIdHash: clickId ? hashIdentifier(clickId) : undefined,
              affiliateId: first.query.aff?.slice(0, 120), landingPath: first.path,
              expiresAt: new Date(Date.now() + 90 * 86_400_000),
            },
          });
        }
      }
    });
    return { accepted: accepted.length, rejected: batch.events.length - accepted.length };
  }

  async link(rawVisitorId: string, accountPrincipalId: string, method = 'login') {
    const visitor = await this.visitor(rawVisitorId);
    if (visitor.accountPrincipalId && visitor.accountPrincipalId !== accountPrincipalId) {
      throw new BadRequestException('Visitor is already linked to another account');
    }
    await this.prisma.$transaction([
      this.prisma.analyticsVisitor.update({
        where: { id: visitor.id }, data: { accountPrincipalId, linkedAt: new Date() },
      }),
      this.prisma.analyticsIdentityLink.upsert({
        where: {
          tenantId_visitorId_accountPrincipalId: {
            tenantId: TENANT_ID, visitorId: visitor.id, accountPrincipalId,
          },
        },
        create: { tenantId: TENANT_ID, visitorId: visitor.id, accountPrincipalId, method },
        update: { revokedAt: null, method, linkedAt: new Date() },
      }),
    ]);
    return { linked: true };
  }

  private range(from?: string, to?: string) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getTime() - 30 * 86_400_000);
    const end = to ? new Date(to) : now;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
      throw new BadRequestException('Invalid date range');
    }
    return { gte: start, lte: end };
  }

  async overview(from?: string, to?: string) {
    const occurredAt = this.range(from, to);
    const [events, sessions, visitors, consents, types, searches] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { tenantId: TENANT_ID, occurredAt } }),
      this.prisma.analyticsSession.count({ where: { tenantId: TENANT_ID, startedAt: occurredAt } }),
      this.prisma.analyticsVisitor.count({ where: { tenantId: TENANT_ID, firstSeenAt: occurredAt, deletedAt: null } }),
      this.prisma.analyticsConsent.count({ where: { tenantId: TENANT_ID, recordedAt: occurredAt } }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'], where: { tenantId: TENANT_ID, occurredAt },
        _count: { _all: true }, orderBy: { _count: { eventType: 'desc' } }, take: 12,
      }),
      this.prisma.analyticsEvent.findMany({
        where: { tenantId: TENANT_ID, occurredAt, eventType: 'search_results' },
        select: { metadata: true }, take: 5000,
      }),
    ]);
    const zeroResults = searches.filter((row) =>
      row.metadata && typeof row.metadata === 'object'
      && !Array.isArray(row.metadata)
      && (row.metadata as Record<string, unknown>).zeroResults === true).length;
    return {
      range: { from: occurredAt.gte, to: occurredAt.lte },
      totals: { events, sessions, newVisitors: visitors, consentDecisions: consents },
      eventTypes: types.map((row) => ({ type: row.eventType, count: row._count._all })),
      search: { total: searches.length, zeroResults, zeroResultRate: searches.length ? zeroResults / searches.length : 0 },
    };
  }

  async visitors(limit = 50, cursor?: string) {
    return this.prisma.analyticsVisitor.findMany({
      where: { tenantId: TENANT_ID, deletedAt: null },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, accountPrincipalId: true, firstSeenAt: true, lastSeenAt: true,
        linkedAt: true, countryCode: true, regionCode: true, locale: true,
        sessions: {
          orderBy: { lastActivityAt: 'desc' }, take: 1,
          select: { deviceClass: true, browserFamily: true, osFamily: true },
        },
        _count: { select: { sessions: true, consentRecords: true } },
      },
    });
  }

  async journey(visitorId: string, limit = 100) {
    const visitor = await this.prisma.analyticsVisitor.findFirst({
      where: { id: visitorId, tenantId: TENANT_ID, deletedAt: null },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    return this.prisma.analyticsEvent.findMany({
      where: { tenantId: TENANT_ID, anonymousVisitorIdHash: visitor.publicIdHash },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: Math.min(limit, 250),
      select: {
        eventId: true, eventType: true, occurredAt: true, tenantId: true,
        anonymousVisitorIdHash: true, sessionIdHash: true, customerId: true,
        entityType: true, entityId: true, sellerId: true, offerId: true,
        countryCode: true, locale: true, pageType: true, position: true,
        experiment: true, metrics: true, metadata: true, path: true,
        referrerHost: true, consentPublicId: true, source: true, createdAt: true,
      },
    });
  }

  async visitorDetail(visitorId: string) {
    const visitor = await this.prisma.analyticsVisitor.findFirst({
      where: { id: visitorId, tenantId: TENANT_ID, deletedAt: null },
      include: {
        sessions: { orderBy: { startedAt: 'desc' }, take: 100 },
        consentRecords: { orderBy: { recordedAt: 'desc' }, take: 100 },
        identityLinks: { orderBy: { linkedAt: 'desc' }, take: 100 },
        attributions: { orderBy: { occurredAt: 'desc' }, take: 100 },
        preferences: { orderBy: { updatedAt: 'desc' }, take: 100 },
        experimentAssignments: { orderBy: { assignedAt: 'desc' }, take: 100 },
      },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    return visitor;
  }

  async exportVisitor(visitorId: string) {
    const visitor = await this.prisma.analyticsVisitor.findFirst({
      where: { id: visitorId, tenantId: TENANT_ID, deletedAt: null },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    return this.exportData(visitor.accountPrincipalId ?? undefined, visitor.publicIdHash);
  }

  async searchIntelligence(from?: string, to?: string) {
    const rows = await this.prisma.analyticsEvent.findMany({
      where: { tenantId: TENANT_ID, occurredAt: this.range(from, to), eventType: { in: ['search_submitted', 'search_results'] } },
      select: { occurredAt: true, metadata: true }, orderBy: { occurredAt: 'desc' }, take: 5000,
    });
    const counts = new Map<string, {
      query: string | null;
      protected: boolean;
      protectedReason?: string;
      count: number;
      zeroResults: number;
    }>();
    for (const row of rows) {
      const m = row.metadata as Record<string, unknown> | null;
      const query = typeof m?.query === 'string' ? m.query : null;
      const protectedReason = typeof m?.queryRedactionReason === 'string'
        ? m.queryRedactionReason
        : 'sensitive-input';
      const key = query ?? `protected:${protectedReason}`;
      const current = counts.get(key) ?? {
        query,
        protected: query === null,
        ...(query === null ? { protectedReason } : {}),
        count: 0,
        zeroResults: 0,
      };
      current.count += 1;
      if (m?.zeroResults === true) current.zeroResults += 1;
      counts.set(key, current);
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count).slice(0, 100);
  }

  async consentOverview(from?: string, to?: string) {
    const records = await this.prisma.analyticsConsent.findMany({
      where: { tenantId: TENANT_ID, recordedAt: this.range(from, to) },
      select: { decisions: true, source: true, regime: true }, take: 20_000,
    });
    const categories: Record<string, { granted: number; denied: number }> = {};
    for (const row of records) {
      for (const [category, granted] of Object.entries(row.decisions as Record<string, boolean>)) {
        const counts = categories[category] ?? { granted: 0, denied: 0 };
        granted ? counts.granted++ : counts.denied++;
        categories[category] = counts;
      }
    }
    return { total: records.length, categories };
  }

  async catalogueOverview(from?: string, to?: string) {
    const occurredAt = this.range(from, to);
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType', 'entityType'], where: {
        tenantId: TENANT_ID, occurredAt,
        eventType: { in: ['game_viewed', 'category_viewed', 'guide_viewed', 'offer_viewed', 'wishlist_changed'] },
      },
      _count: { _all: true }, orderBy: { _count: { eventType: 'desc' } },
    });
    const topEntities = await this.prisma.analyticsEvent.groupBy({
      by: ['entityType', 'entityId'], where: {
        tenantId: TENANT_ID, occurredAt, entityId: { not: null },
      },
      _count: { _all: true }, orderBy: { _count: { entityId: 'desc' } }, take: 100,
    });
    return {
      totals: rows.map((row) => ({ eventType: row.eventType, entityType: row.entityType, count: row._count._all })),
      topEntities: topEntities.map((row) => ({ entityType: row.entityType, entityId: row.entityId, count: row._count._all })),
    };
  }

  async funnel(steps: string[], from?: string, to?: string) {
    const cleanSteps = steps.filter((step) => /^[a-z_]{2,50}$/.test(step)).slice(0, 10);
    if (cleanSteps.length < 2) throw new BadRequestException('At least two valid funnel steps are required');
    const events = await this.prisma.analyticsEvent.findMany({
      where: { tenantId: TENANT_ID, occurredAt: this.range(from, to), eventType: { in: cleanSteps }, sessionIdHash: { not: null } },
      select: { sessionIdHash: true, eventType: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' }, take: 100_000,
    });
    const progress = new Map<string, number>();
    const reached = cleanSteps.map(() => new Set<string>());
    for (const event of events) {
      const session = event.sessionIdHash!;
      const at = progress.get(session) ?? 0;
      if (event.eventType === cleanSteps[at]) {
        reached[at].add(session);
        progress.set(session, at + 1);
      }
    }
    return cleanSteps.map((step, index) => {
      const count = reached[index].size;
      return {
        step, count,
        rate: index === 0 ? 1 : count / Math.max(1, reached[index - 1].size),
      };
    });
  }

  async cohorts(from?: string, to?: string) {
    const range = this.range(from, to);
    const visitors = await this.prisma.analyticsVisitor.findMany({
      where: { tenantId: TENANT_ID, firstSeenAt: range, deletedAt: null },
      select: { id: true, firstSeenAt: true, sessions: { select: { startedAt: true } } },
      take: 50_000,
    });
    const buckets = new Map<string, { visitors: number; retained7d: number; retained30d: number }>();
    for (const visitor of visitors) {
      const week = new Date(visitor.firstSeenAt);
      week.setUTCDate(week.getUTCDate() - week.getUTCDay());
      const key = week.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? { visitors: 0, retained7d: 0, retained30d: 0 };
      bucket.visitors += 1;
      const ages = visitor.sessions.map((s) => s.startedAt.getTime() - visitor.firstSeenAt.getTime());
      if (ages.some((age) => age >= 7 * 86_400_000)) bucket.retained7d += 1;
      if (ages.some((age) => age >= 30 * 86_400_000)) bucket.retained30d += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].map(([cohort, values]) => ({ cohort, ...values })).sort((a, b) => a.cohort.localeCompare(b.cohort));
  }

  async aggregateDay(date = new Date()) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'], where: { tenantId: TENANT_ID, occurredAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    await Promise.all(rows.map((row) => this.prisma.analyticsDailyAggregate.upsert({
      where: {
        tenantId_date_dimension_dimensionKey: {
          tenantId: TENANT_ID, date: start, dimension: 'event_type', dimensionKey: row.eventType,
        },
      },
      create: {
        tenantId: TENANT_ID, date: start, dimension: 'event_type',
        dimensionKey: row.eventType, metrics: { count: row._count._all },
      },
      update: { metrics: { count: row._count._all } },
    })));
    return { date: start, rows: rows.length };
  }

  async requestPrivacy(type: 'export' | 'delete', accountPrincipalId?: string, rawVisitorId?: string) {
    if (!accountPrincipalId && !rawVisitorId) throw new BadRequestException('Identity required');
    const visitorHash = rawVisitorId ? hashIdentifier(rawVisitorId) : undefined;
    const request = await this.prisma.analyticsPrivacyRequest.create({
      data: { tenantId: TENANT_ID, accountPrincipalId, visitorHash, requestType: type, status: 'processing' },
    });
    try {
      const result = type === 'export'
        ? await this.exportData(accountPrincipalId, visitorHash)
        : await this.deleteData(accountPrincipalId, visitorHash);
      await this.prisma.analyticsPrivacyRequest.update({
        where: { id: request.id }, data: {
          status: 'completed', completedAt: new Date(),
          result: result as unknown as Prisma.InputJsonValue,
        },
      });
      return { requestId: request.id, status: 'completed', result };
    } catch (error) {
      this.logger.error(`Privacy request ${request.id} failed`, error);
      await this.prisma.analyticsPrivacyRequest.update({
        where: { id: request.id }, data: { status: 'failed', errorCode: 'processing_failed' },
      });
      throw error;
    }
  }

  private async matchingVisitors(accountPrincipalId?: string, visitorHash?: string) {
    return this.prisma.analyticsVisitor.findMany({
      where: {
        tenantId: TENANT_ID,
        OR: [
          ...(accountPrincipalId ? [{ accountPrincipalId }] : []),
          ...(visitorHash ? [{ publicIdHash: visitorHash }] : []),
        ],
      },
    });
  }

  private async exportData(accountPrincipalId?: string, visitorHash?: string) {
    const visitors = await this.matchingVisitors(accountPrincipalId, visitorHash);
    const hashes = visitors.map((v) => v.publicIdHash);
    const ids = visitors.map((v) => v.id);
    const [events, sessions, consents, preferences, attributions] = await Promise.all([
      this.prisma.analyticsEvent.findMany({ where: { tenantId: TENANT_ID, anonymousVisitorIdHash: { in: hashes } } }),
      this.prisma.analyticsSession.findMany({ where: { visitorId: { in: ids } } }),
      this.prisma.analyticsConsent.findMany({ where: { visitorId: { in: ids } } }),
      this.prisma.analyticsPreference.findMany({ where: { visitorId: { in: ids } } }),
      this.prisma.analyticsAttribution.findMany({ where: { visitorId: { in: ids } } }),
    ]);
    return { generatedAt: new Date().toISOString(), visitors, sessions, consents, preferences, attributions, events };
  }

  private async deleteData(accountPrincipalId?: string, visitorHash?: string) {
    const visitors = await this.matchingVisitors(accountPrincipalId, visitorHash);
    const hashes = visitors.map((v) => v.publicIdHash);
    const ids = visitors.map((v) => v.id);
    const deletedEvents = await this.prisma.analyticsEvent.deleteMany({
      where: { tenantId: TENANT_ID, anonymousVisitorIdHash: { in: hashes } },
    });
    await this.prisma.analyticsVisitor.deleteMany({ where: { id: { in: ids } } });
    return { deletedVisitors: ids.length, deletedEvents: deletedEvents.count };
  }

  async runRetention(now = new Date()) {
    const eventCutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
    const consentCutoff = new Date(now.getTime() - CONSENT_RETENTION_DAYS * 86_400_000);
    const [events, sessions, consents, attribution] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.deleteMany({ where: { tenantId: TENANT_ID, occurredAt: { lt: eventCutoff } } }),
      this.prisma.analyticsSession.deleteMany({ where: { tenantId: TENANT_ID, lastActivityAt: { lt: eventCutoff } } }),
      this.prisma.analyticsConsent.deleteMany({ where: { tenantId: TENANT_ID, recordedAt: { lt: consentCutoff } } }),
      this.prisma.analyticsAttribution.deleteMany({ where: { tenantId: TENANT_ID, expiresAt: { lt: now } } }),
    ]);
    return { events: events.count, sessions: sessions.count, consents: consents.count, attribution: attribution.count };
  }
}
