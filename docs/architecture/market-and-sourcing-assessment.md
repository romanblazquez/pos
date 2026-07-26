# Repository assessment — international markets & global sourcing

Scope: the pre-implementation survey required by deliverable 1 of both the
*International Market Architecture* and the *Product Request & Global Sourcing
Platform* specifications.

Date: 2026-07-26. Branch: `feat/browse-taxonomy-full-coverage`.
Schema surveyed: `libs/data/db-postgres/prisma/schema.prisma` (3,577 lines, 147 models).

**Headline: far more of both specifications already exists than either assumes.**
Both specs say "extend the existing schema rather than creating parallel models".
Taken literally that instruction is the single most important constraint here,
because several of the entities they ask for are already present under different
names, and one name they propose (`Market`) collides with an existing model that
means something else entirely.

---

## 1. What already exists

### 1.1 Catalog identity — already exactly the requested model

The sourcing spec asks for `Master Game → Edition → Printing → Product → Seller Offer`.
That hierarchy is already implemented verbatim:

| Spec concept | Existing model | Line |
| --- | --- | --- |
| Master Game | `MasterGame` | 1506 |
| Edition | `GameEdition` | 1568 |
| Printing | `GamePrinting` | 1603 |
| Product | `CatalogProduct` | 1634 |
| (variant) | `ProductVariant` | 1684 |
| Seller Offer | `SellerOfferCurrent` | 2560 |

No new catalog entities are required by either spec. This is the strongest
existing asset in the repository.

### 1.2 Reference data

`Country` (1195), `Currency` (1217) and `Language` (1231) all exist, active-flagged,
with `defaultCurrency` / `defaultLanguage` / `timezone` already on `Country`.
`Currency` already carries `minorUnits` and `symbol` — the spec's `decimalPlaces`
is `minorUnits` under another name.

### 1.3 Offers already carry almost every field the comparison spec demands

`SellerOfferCurrent` (2560) already stores native price and currency
(`priceMinor` + `currencyCode`), `shippingPriceMinor`, `taxIncluded`,
`taxProfileId`, `condition`, `stockStatus`, `quantityAvailable`,
`deliveryMinDays` / `deliveryMaxDays`, `affiliateUrl`, `validFrom` / `validUntil`,
`lastSeenAt` (offer freshness), and `rankScore` + `rankingAlgorithmVersion`.

Critically, it **already stores the authoritative seller price natively and never
converts it** — the exact discipline the market spec demands.

Supporting models: `OfferShippingOption` (2669), `TaxProfile` (2700),
`SellerOfferPriceHistory` (2628) and `SellerOfferInventoryHistory` (2651), both
append-only and RANGE-partitioned by `observedAt` in SQL.

### 1.4 Seller and market configuration

- `SellerMarket` (2415) — per-seller country, settlement currency, `languageCodes`,
  `shipsFromCountryCode`, `shippingCountries[]`, `localPickup`.
- `TenantMarket` (2396) — tenant-scoped country/currency/language/timezone/tax.
- `AffiliateAccount` (2434), `AffiliateClickEvent` (2815),
  `AffiliateEventDeduplication` (2853), `ConversionEvent` (2864).

A working NestJS **`markets` module already exists** at `apps/api/src/markets/`
with `markets.controller.ts` (public reference-data + default market),
`tenant-markets.controller.ts` (admin CRUD) and `seller-markets.controller.ts`
(seller/admin CRUD), plus `default-market.constants.ts`.

### 1.5 SEO

`SeoPage` (3090) already provides the "explicit SEO landing-page entity for
combinations approved for indexing" that the market spec asks for — it has
`locale`, `countryCode`, `indexable`, `qualityScore`, `minimumDataMet`,
`canonicalUrl` and `structuredData`, with `SeoSlug` and `StructuredDataCache`
alongside.

The public site (`apps/web`, Next.js App Router) resolves all routing through a
single dynamic `[locale]/[type]/[slug]` resolver driven by `apps/web/src/lib/segments.ts`,
with centralised metadata in `apps/web/src/lib/seo.ts` and structured data in
`apps/web/src/lib/jsonld.ts`. Canonical/hreflang/sitemap already flow from one
place — the "centralized helper so they cannot drift apart" the spec requires is
already the established pattern, and just needs its locale axis widened.

### 1.6 Analytics

`AnalyticsEvent` (3252) is partitioned by `occurredAt`, privacy-conscious
(`anonymousVisitorIdHash`, `sessionIdHash`, consent linkage), and **already carries
`countryCode`, `locale`, `sellerId`, `offerId`, `entityType`/`entityId`, `pageType`
and `position`**. Supporting models cover visitors, sessions, consent, identity
links, attribution, experiment assignment, daily aggregates, privacy requests and
saved reports (3291–3475).

### 1.7 Sourcing-spec entry points that already exist

`Wishlist` (3005), `WishlistItem` (3022) and `UserAlert` (3041) exist — two of the
request entry points the sourcing spec names are already modelled.

---

## 2. Naming hazards — read before writing any migration

**`Marketplace` (1248) does NOT mean a Juegospedia market.** It means an *external*
marketplace (Amazon, MercadoLibre): it has `marketplaceType`, `baseUrl`,
`integrations` and `sourceProducts`. `MarketplaceCountry` (1268) is its
country coverage. Introducing a public-facing "market" concept under any name
built on `Marketplace*` would corrupt this.

**`TenantMarket` is not the public market either.** It is retail-os tenant
configuration (multi-tenant POS/ERP side of the monorepo), keyed by `tenantId`,
currently single-tenant via `DEFAULT_TENANT_ID`. It has no `urlPrefix`, no
`indexable` flag and no locale-routing role.

Therefore the market spec's `Market` / `MarketLocale` entities are **genuinely new**
and need a distinct, unambiguous name to avoid three colliding meanings of
"market" in one schema. Recommend `CommerceMarket` / `CommerceMarketLocale`, or
reusing `TenantMarket` only if the public site is formally declared a tenant.
This is an ADR-level decision, not an implementation detail.

---

## 3. Genuine gaps

### Market spec
1. **No `Market` / `MarketLocale` public entity** — no `urlPrefix`, no per-locale
   `indexable`, no market-scoped SEO config. (See §2 on naming.)
2. **No `ExchangeRateSnapshot` and no FX handling anywhere** — confirmed by grep:
   zero occurrences of `exchangeRate`/`fx` in the schema. This is the largest
   single gap, and it blocks converted-price display, landed-cost estimates and
   cross-market monetary analysis in *both* specs.
3. **Locale is language-only.** `apps/web/src/lib/segments.ts` defines
   `LOCALES = ['es','en']` with `INDEXABLE_LOCALES = ['es']`. There is no country
   axis in the URL, no market resolution service, no market cookie, no GeoIP.
4. **Price history lacks normalisation columns** — `SellerOfferPriceHistory` has no
   normalised market price, applied exchange rate or total comparable price, so it
   cannot yet "explain exactly how a displayed price was calculated".
5. **`AnalyticsEvent` lacks `marketCode` and `displayCurrency`.**
6. **No market-scoped aggregate tables** (`MarketProductDailyMetric` et al.);
   `AnalyticsDailyAggregate` exists but is not market-dimensioned.
7. **No sitemap index** — `apps/web/src/app/sitemap.xml/route.ts` emits a single
   flat sitemap.

### Sourcing spec
8. **Entirely greenfield.** No `ProductRequest`, `SellerQuote`, `SourcingRoute`,
   `SellerSourcingCapability`, `SellerRequestInvitation` or any demand-aggregation
   model exists. Grep for `request|quote|sourc|demand` returns only unrelated
   models (`ImportJob`, `SellerSourceProduct`, `AnalyticsPrivacyRequest`).
9. **No notification infrastructure** for the user-facing request lifecycle.
10. **No feature-flag mechanism** was found; both specs require phased flags.

### Both
11. **Test coverage is thin for the scope demanded.** 10 `.spec.ts` files across all
    of `apps/`, and no e2e harness was found. Both specs require unit + integration
    + e2e suites; the e2e infrastructure itself would have to be built first.
12. **Background jobs are ad-hoc** — four `@nestjs/schedule`-style services
    (`ranking-scheduler`, `bgg-discovery`, `analytics-retention`, `sync-scheduler`).
    No queue (BullMQ absent), no locking primitive, no idempotency helper. The
    sourcing spec's job list (matching, expiry, reminders, aggregation) needs a
    real queue with locking.

---

## 4. One strategic finding that changes the URL migration calculus

**The public site is currently closed to all bots and has never been indexed.**
Verified live: `https://juegospedia.com/es/guias` returns
`x-robots-tag: noindex, nofollow, noarchive, nosnippet, noai, noimageai`, applied
at the Traefik layer across every route.

The market spec treats `/es/* → /es-mx/*` as a risky migration requiring redirects,
reciprocal hreflang and redirect tests before activation. **Right now there is no
index to protect and no ranking to lose.** Restructuring the URL space to
`{language}-{country}` before go-live is close to free; doing it after launch is
the expensive, risky version the spec is written to defend against.

This argues strongly for doing the market URL work **first and immediately**, and
for treating it as a pre-launch design change rather than a migration. The
redirect layer is still worth building (external links, pasted URLs), but it stops
being the critical path.

---

## 5. Sequencing assessment

The two specifications are not peers. The sourcing spec's own opening line —
"Extend the previously implemented market-aware catalog, price-comparison, seller
analytics and SEO architecture" — states the dependency. Concretely, sourcing
depends on market work for: `destinationMarketCode` (needs `Market`), landed-cost
and quote currency (needs `ExchangeRateSnapshot`), market-scoped demand aggregates
(needs the market dimension on analytics), and seller destination eligibility
(needs market-linked `SellerMarket`).

Building sourcing first would mean inventing a market abstraction inside the
sourcing module and then either duplicating or unpicking it — precisely the
"parallel market service" both specs forbid.

**Recommended order:** market Phase 1–2 → sourcing Phase 1–2 → then interleave the
analytics phases of both, which share the aggregation pipeline and privacy-threshold
machinery.

---

## 6. Honest scope estimate

Combined, these two specifications describe roughly:

- ~30 new Prisma models and their migrations
- 3 new API module groups (public, seller, admin) across ~50 endpoints
- A market-resolution service with GeoIP, cookie and profile precedence
- A URL/routing restructure of the entire public site
- A sitemap-index generator
- A seller-matching engine with 8 tiers and explainable scoring
- A quote lifecycle with a validated state machine
- Three new front-end modules (public request flow, seller portal, admin)
- An aggregation pipeline with ~16 aggregate entities
- Unit + integration + e2e suites, with the e2e harness built from scratch

This is a multi-month programme for a team, not a single session's work. It can be
delivered incrementally and the phase boundaries in both specs are sensible, but
any claim to have completed all 25 + 22 deliverables in one pass would be false.
