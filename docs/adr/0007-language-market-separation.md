# ADR-0007 — Separate Language from Market, and name the new entity `CommerceMarket`

**Status:** Proposed · **Date:** 2026-07-26

## Context

Juegospedia's public site (`apps/web`) currently routes on language alone:
`apps/web/src/lib/segments.ts` defines `LOCALES = ['es','en']` with
`INDEXABLE_LOCALES = ['es']`. Everything commercial — which sellers are eligible,
which currency is canonical, which offers ship to the user — is implicitly Mexico,
inferred rather than declared.

We need explicit language × market combinations (`/es-mx`, `/en-mx`, `/es-es`,
`/en-us`, `/en-ie`, `/es-ar`) on one canonical domain, so that a market can be
added through configuration rather than code.

Three constraints shaped this decision, all established by the repository survey
in `docs/architecture/market-and-sourcing-assessment.md`:

1. **The name `Market` is already taken twice, with two different meanings.**
   `Marketplace` (schema line 1248) means an *external* marketplace — Amazon,
   MercadoLibre — carrying `marketplaceType`, `baseUrl`, `integrations` and
   `sourceProducts`. `TenantMarket` (2396) is retail-os *tenant* configuration on
   the POS/ERP side of the monorepo, keyed by `tenantId` and currently
   single-tenant. Neither is the public commercial market we need, and reusing
   either would collapse three distinct concepts into one word.

2. **The offer model already does the right thing with money.**
   `SellerOfferCurrent` stores `priceMinor` + `currencyCode` natively and never
   converts. Any market layer must preserve that and add conversion *alongside*,
   never in place.

3. **The site has never been indexed.** Every route currently carries
   `x-robots-tag: noindex, nofollow, …` at the Traefik layer. There is no ranking
   to protect.

## Decision

**Separate the three concepts explicitly**, and give each exactly one owner:

- **Language** — translated UI, editorial content, metadata, localized slugs,
  formatting, `hreflang`. Owned by the existing `Language` model and the segment
  resolver in `apps/web/src/lib/segments.ts`.
- **Market** — country, eligible sellers, shipping destination, availability,
  canonical currency, taxes, promotions, ranking, analytics dimension. Owned by a
  **new `CommerceMarket` model**.
- **Display currency** — presentation only. A user preference. Never appears in a
  URL, never changes a canonical, never creates an indexable page.

**Name the new entities `CommerceMarket` and `CommerceMarketLocale`**, not
`Market`/`MarketLocale`. The prefix is not decoration: it is the only thing
keeping the three existing meanings of "market" legible in a 147-model schema.
`TenantMarket` and `SellerMarket` keep their names and gain a nullable
`commerceMarketId` so the public market can be joined to tenant configuration and
seller eligibility without either being redefined.

**Introduce `ExchangeRateSnapshot` as an append-only table.** Rates are never
overwritten. Any displayed converted price records the rate and its
`effectiveAt`, so a historical price can always be explained.

**Do the URL restructure now, before go-live, as a design change rather than a
migration.** `/es/*` and `/en/*` currently mean the Mexican market, so they become
`/es-mx/*` and `/en-mx/*`. We still build the 301 layer for external links and
pasted URLs, but it is not on the critical path and does not gate the rollout.

**The URL is authoritative after resolution.** GeoIP may *recommend* a market on
first visit via a non-blocking prompt; it may never silently vary the content
served at a given URL. Crawlers therefore always receive deterministic,
URL-derived content.

## Consequences

- A new market is added by inserting `CommerceMarket` + `CommerceMarketLocale`
  rows and activating them in admin. No application code changes — this is the
  testable acceptance criterion for Phase 5.
- `SellerOfferCurrent` is untouched structurally; market eligibility is resolved
  through `SellerMarket.shippingCountries` joined to `CommerceMarket.countryCode`.
  Existing offer data stays valid.
- Every cache key, search query, analytics event and aggregate row gains a market
  dimension. Aggregates must never mix markets unless a global view is explicitly
  requested.
- The naming prefix costs some verbosity at every call site. Accepted: the
  alternative is three colliding `market` concepts and a schema nobody can read.
- Doing the URL change pre-launch means the `/es` → `/es-mx` redirect tests the
  spec demands become regression guards rather than launch blockers. If the site
  is indexed before this ships, that advantage is permanently lost — which makes
  this work time-sensitive in a way it will not be again.

## Alternatives rejected

- **Reuse `TenantMarket` for the public market.** Rejected: it would declare the
  public site a retail-os tenant, coupling the consumer SEO property to the
  multi-tenant POS model for no benefit.
- **Country subdomains or ccTLDs** (`mx.juegospedia.com`, `juegospedia.mx`).
  Rejected by the specification, and correctly: one canonical domain concentrates
  authority and avoids per-domain verification and certificate overhead.
- **Currency in the URL.** Rejected: it multiplies indexable URLs for what is a
  display preference, and creates duplicate-content clusters that disagree with
  their own JSON-LD.
