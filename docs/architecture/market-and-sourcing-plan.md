# Implementation plan — international markets & global sourcing

Companion to `market-and-sourcing-assessment.md` (what exists) and
`../adr/0007-language-market-separation.md` (why it is shaped this way).

Two specifications are in scope. They are **not peers**: the sourcing spec opens
by extending "the previously implemented market-aware… architecture", and depends
on it for destination markets, currency conversion, market-scoped demand
aggregates and seller destination eligibility. Building sourcing first would mean
inventing a market abstraction inside the sourcing module — the parallel market
service both specs forbid.

**Order: Market M1–M2 → Sourcing S1–S2 → interleave the analytics phases**, which
share one aggregation pipeline and one set of privacy thresholds.

---

## Cross-cutting prerequisites (P0)

These block everything and are not in either spec's phase list. Do them first.

| # | Item | Why it blocks |
| --- | --- | --- |
| P0.1 | **Feature-flag mechanism** | Both specs require phased flags; none exists in the repo. |
| P0.2 | **Job queue with locking + idempotency** | Only four ad-hoc `@nestjs/schedule` services exist; no BullMQ, no locking. Sourcing's matching/expiry/reminder jobs need real queueing to satisfy "jobs must be idempotent". |
| P0.3 | **E2E harness** | Both specs demand e2e suites. 10 `.spec.ts` files exist across all apps and no e2e infrastructure. |
| P0.4 | **`ExchangeRateSnapshot` + FX service** | Zero FX handling exists. Blocks converted prices, landed cost, quote currency and cross-market analysis in *both* specs. |

P0.4 is the highest-value single item in this plan — it is a hard dependency of
six later phases and is currently a complete blank.

---

## Programme M — International markets

### M1 · Market domain & URL restructure
*Depends on: P0.1, P0.4*

- `CommerceMarket`, `CommerceMarketLocale` models + migration (naming per ADR-0007).
- Nullable `commerceMarketId` on `TenantMarket` and `SellerMarket`.
- Seed: Mexico — `MX` / `MXN` / `es-MX` default, `en-MX` secondary, prefixes
  `es-mx`, `en-mx`.
- Market-resolution service with the spec's precedence: URL → profile → cookie →
  GeoIP → browser → default. Returns the typed `MarketContext`; **the URL is
  authoritative after resolution.**
- Widen `apps/web/src/lib/segments.ts` from language-only to language×market.
  This is the highest-blast-radius change in the plan: `segments.ts` is imported
  by the middleware, the layout, every route resolver and the sitemap.
- Self-canonical + reciprocal `hreflang` + `x-default` from one helper
  (`lib/seo.ts` already centralises this — widen its locale axis, do not fork it).
- `/es/*` → `/es-mx/*`, `/en/*` → `/en-mx/*` 301 layer + redirect tests.

**Why now, not later:** the site is `noindex` at Traefik on every route and has
never been indexed. This restructure is currently near-free; after go-live it
becomes the risky migration the spec is written to defend against. Time-sensitive
in a way it will not be again.

**Exit:** `/es-mx/…` and `/en-mx/…` serve market-correct SSR content with correct
canonical/hreflang; legacy paths 301 with path preserved; sitemap emits only
indexable market URLs.

### M2 · Market-aware commerce
*Depends on: M1*

- Offer queries filtered by market: active, ships-to-market, freshness threshold,
  seller/market rules. `SellerOfferCurrent` needs **no structural change** — the
  join is `SellerMarket.shippingCountries` → `CommerceMarket.countryCode`.
- Total-cost ranking (item + shipping + tax) with explicit labels for
  *shipping unknown*, *tax estimated*, *price converted*, *offer stale*,
  *edition differs*.
- Add normalisation columns to `SellerOfferPriceHistory`: normalised market price,
  applied rate, rate `effectiveAt`, total comparable price — so a displayed price
  can be reconstructed.
- Market selector UI; equivalent-page navigation with graceful fallback
  (never 404 merely because a market has no offer).
- Sitemap index split by market × content type.
- `Product` / `AggregateOffer` / `BreadcrumbList` generated from the same
  server-side data that renders the visible page, with tests asserting JSON-LD
  price and currency match the visible offers. **No `AggregateOffer` when there
  are no valid visible offers.**

**Exit:** two markets can be served from one codebase with correct prices,
currencies and structured data; display-currency changes never alter canonical,
hreflang or sitemap.

### M3 · Admin & analytics foundation
*Depends on: M2, P0.2*

- Admin Markets module: full CRUD, locale config, URL prefixes, indexability, tax
  display, freshness thresholds, seller eligibility, SEO fields, canonical/hreflang
  validators, coverage and readiness views.
- `marketCode` + `displayCurrency` on `AnalyticsEvent`.
- Market-dimensioned daily aggregates (`MarketProductDailyMetric`,
  `MarketCategoryDailyMetric`, `SearchDemandDailyMetric`, `MarketPriceDailyMetric`, …).
- Privacy thresholds — configurable minimum seller and event counts.

### M4 · Seller & admin intelligence
*Depends on: M3*

Seller KPI dashboards, market trends with documented weighted trend score and
minimum-volume thresholds, opportunity insights, admin market-health views.

**Attribution honesty is a hard requirement:** the platform knows impressions and
outbound clicks. Conversions and revenue exist only where a seller integration
reports them. Every metric must be labelled with its attribution level, and
conversion/revenue must never be inferred from a click.

### M5 · Second market
Add Spain or the US **through admin configuration only**. The acceptance test is
that no Mexico-specific code change is required. Then complete legacy redirects
and monitor.

---

## Programme S — Product requests & global sourcing

Entirely greenfield: no `ProductRequest`, `SellerQuote`, `SourcingRoute` or
`SellerSourcingCapability` model exists. `Wishlist`, `WishlistItem` and
`UserAlert` already exist and are two of the spec's named entry points.

### S1 · User requests
*Depends on: M1 (destination market), P0.1*

- `ProductRequest`, `ProductRequestPreference`, `ProductRequestStatusHistory`,
  `ProductRequestCatalogCandidate`.
- **Status is a validated state machine, never a boolean.** All transitions go
  through one validator; every transition writes history with actor and reason.
- Product identity resolution against the existing
  `MasterGame → GameEdition → GamePrinting → CatalogProduct` hierarchy — which
  already exists exactly as the spec describes, so this is query work, not
  modelling work. Ambiguous matches are disambiguated by the user before any
  seller sees the request.
- Unknown products create an *unverified candidate* routed to catalog review.
  Never auto-promote user free text to a verified catalog entity.
- Request pages `noindex,nofollow` and owner-only.
- Request deduplication: one active equivalent request per user × product ×
  destination × preference set.

### S2 · Seller responses
*Depends on: S1, M2*

- `SellerSourcingCapability`, `SellerRequestInvitation`, `SellerRequestResponse`,
  `SellerQuote`.
- **Targeted** distribution with eligibility rules, per-seller volume caps and
  fatigue protection. Never broadcast to all sellers.
- Quote lifecycle with expiry. A quote is **not** an order and must never be
  presented as a reservation unless the seller explicitly confirms one.
- Seller portal module; user comparison screen.

### S3 · Global sourcing
*Depends on: S2, P0.4*

- Cross-market offer discovery preserving source market, native price/currency,
  freshness, language, edition, printing, condition.
- 8-tier matching engine with **explainable** `SellerMatchReason` codes — no
  black-box scoring.
- `SourcingRoute` + landed-cost estimates (item, shipping, insurance, tax,
  customs, service fee, FX impact), each value labelled seller-provided /
  calculated / unknown.
- `FulfillmentConfidence` surfaced everywhere. "In stock in another country" is
  never presented as "deliverable to you".
- Valid options are ranked, not hidden, when expensive — hiding is only permitted
  by an explicit user constraint or a legal restriction.

### S4 · Demand intelligence
*Depends on: S3, M3*

Unmet-demand aggregates, seller opportunities, admin demand dashboards, catalog
acquisition signals — reusing the M3 aggregation pipeline and privacy thresholds
rather than building a parallel one.

### S5 · Fulfilment integration
Tracked outbound links with quote references and click attribution.
**No payment custody, escrow or merchant-of-record behaviour** — extension points
only, left disabled. Outbound clicks are never recorded as purchases.

---

## Sequenced delivery

| Stage | Contents |
| --- | --- |
| 1 | P0.1, P0.4, M1 |
| 2 | M2, P0.3 |
| 3 | M3, S1 |
| 4 | P0.2, S2 |
| 5 | M4, S3 |
| 6 | S4, M5, S5 |

Stages 1–2 are the ones with a genuine deadline attached, because the URL
restructure is only cheap while the site remains unindexed.

---

## Scope reality

Combined, these specifications describe roughly 30 new Prisma models, ~50
endpoints across three API surfaces, a routing restructure of the entire public
site, an 8-tier matching engine, a quote state machine, three new front-end
modules, ~16 aggregate entities, and unit + integration + e2e suites with the e2e
harness built from scratch.

That is a multi-month programme for a team. The phase boundaries above are
deliverable incrementally and each stage leaves the system in a working, shippable
state — but no single pass produces all 47 deliverables, and any claim otherwise
would be false.

## Open decisions for the user

1. **`CommerceMarket` naming** (ADR-0007) — accept, or formally declare the public
   site a retail-os tenant and extend `TenantMarket` instead.
2. **GeoIP provider** — none exists in the repo. Cloudflare already fronts the
   site and can supply `CF-IPCountry` free; the alternative is a MaxMind
   dependency. Cloudflare is the cheaper path and is the recommendation.
3. **Go-live vs. restructure ordering** — this plan assumes the URL restructure
   lands *before* the SEO go-live lever is pulled. If launch is imminent and must
   not slip, that trade needs an explicit call.
