# Juegospedia first-party analytics

Juegospedia's PostgreSQL database is the source of truth for visitor
intelligence. GA4, Google Ads and future providers are optional downstream
adapters. A provider outage or analytics exception must never block navigation,
search, authentication, cart actions or affiliate redirection.

## Data flow

1. `BrowserAnalytics` starts with every optional consent purpose denied.
2. The consent component records an append-only decision at
   `POST /api/v1/analytics/consent`.
3. Only after analytics consent, the SDK creates random visitor and session
   identifiers. The API stores HMAC-SHA-256 values, never those raw IDs.
4. Events are allowlisted and sanitized in the browser, then independently
   sanitized by the collector.
5. The NestJS analytics service writes the event stream, visitor/session
   lifecycle, consent evidence, attribution and explicit preferences.
6. Admin endpoints aggregate the first-party data. Admin JWT role checks protect
   individual journeys and exports.
7. Google receives only events allowed by the current Consent Mode v2 state. Its
   script is not inserted before analytics or advertising storage is granted.

## Adding instrumentation

Import the existing app wrapper, not Google directly:

```ts
import { trackEvent } from './analytics.js';

trackEvent('affiliate_click', {
  entityType: 'game',
  entityId: game.id,
  offerId: offer.id,
  sellerId: offer.sellerId,
  partner: offer.network,
  destinationHost: new URL(offer.url).hostname,
});
```

Use an event from `ANALYTICS_EVENT_TYPES`, then add only non-sensitive scalar
properties to `EVENT_PROPERTIES` in
`libs/shared/analytics-contracts/src/events.ts`. Unknown properties are dropped.
Nested objects are rejected. Never add email, phone, address, full referrer,
access/refresh tokens, free-form error text, checkout contents, payment values,
or exact location.

Search terms pass through `sanitizeSearchQuery`. It redacts contact details,
credential-shaped values, long digit sequences and unusually long text while
retaining length and word count for aggregate reporting.

Explicit preference events require personalization consent:

```ts
firstPartyAnalytics.track('preference_provided', {
  preference: 'preferred_player_count',
  value: '2',
  explicit: true,
});
```

Do not infer protected or sensitive traits. Preferences must describe board-game
product choices, be visible to the user, and be removable.

## Consent and advertising

Purposes are independent: functional, analytics, UX diagnostics,
personalization, advertising storage, advertising user data and advertising
personalization. Session replay is separate and is never enabled by “accept
optional”.

Ad modes:

- `limited`: no advertising storage; contextual ads only.
- `non-personalized`: advertising storage allowed, personalization refused.
- `personalized`: storage and personalization explicitly granted.

`updateGoogleAdapter` is the only Google initialization boundary. Add another
provider by implementing `DownstreamAnalyticsAdapter`; do not call it from
product code.

## Configuration

API:

- `ANALYTICS_HMAC_SECRET`: at least 32 random characters. In existing
  deployments, `CREDENTIAL_ENCRYPTION_KEY` is a safe fallback. Set a dedicated
  secret before rotating attribution independently.
- `ANALYTICS_TENANT_ID`: defaults to `tenant-demo`.
- `ANALYTICS_RETENTION_DAYS`: behavioral events and sessions, default 395.
- `ANALYTICS_CONSENT_RETENTION_DAYS`: consent evidence, default 2190.
- `ANALYTICS_JOBS_ENABLED`: set `false` only for a process that must not run
  BullMQ workers.

Marketplace:

- `VITE_API_URL`
- `VITE_PRIVACY_POLICY_VERSION`
- `VITE_GA_MEASUREMENT_ID` (optional)
- `VITE_GOOGLE_ADS_ID` (optional)

Next public site:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PRIVACY_POLICY_VERSION`
- existing GA measurement configuration
- `NEXT_PUBLIC_GOOGLE_ADS_ID` (optional)

No provider ID is required for first-party collection.

## Privacy operations

Authenticated customers call `POST /api/v1/analytics/privacy` with
`{"type":"export"}` or `{"type":"delete"}`. Export returns data owned by the
authenticated principal. Deletion removes event rows and cascades visitor
sessions, preferences, attribution and experiment assignments. The request and
outcome remain in `analytics_privacy_request` as operational evidence.

Identity merge does not rewrite historical events. Login calls
`POST /api/v1/analytics/identity/link`; an audited edge links the pseudonymous
visitor to the authenticated principal. A visitor already linked to another
principal is rejected.

The daily BullMQ jobs aggregate the prior UTC day at 02:42 and enforce retention
at 03:17. Both also have admin/service manual endpoints for recovery.

## Operational checks

After deployment:

1. Choose “necessary only”; confirm no `jp_visitor_v1` and no Google script.
2. Grant analytics; confirm consent and a page event reach PostgreSQL.
3. Open `/analytics` in admin; confirm the session and journey appear.
4. Search, view a game and select an offer; confirm the sequence.
5. Withdraw consent; confirm new events stop immediately.
6. Run an export and deletion against a test account.
7. Check the `analytics-operations` BullMQ worker and failed-job logs.

The collector is intentionally lossy under failure. Clients retry their in-memory
batch, but telemetry is never allowed to become a product-path dependency.
