# Marketplace discovery and filtering plan

## Objective

Make `juegospedia.com` the fastest way to answer:

1. Which game fits this group and occasion?
2. Who has it available now?
3. What is the best total-value offer?
4. Why should the buyer trust the recommendation?

The filter sidebar is only one surface. The system needs reliable product facets,
offer aggregates, search ranking, URL state, analytics, and catalog-quality tooling.

## Product principles

- Ask buyers questions they can answer: players, duration, age, budget, availability.
- Separate game identity from seller offer data.
- Show result counts before users commit to a filter.
- Preserve every filter in the URL for sharing, back navigation, and SEO landing pages.
- Rank by buyer value and confidence, not only text relevance or lowest price.
- Degrade cleanly when catalog metadata is incomplete.

## Target experience

### Discovery sidebar

- Availability: in stock, pickup available, free shipping, preorder.
- Budget: useful presets plus custom minimum/maximum.
- Players: exact table size, including solo and 5+.
- Duration: under 30, 30–60, 60–120, 120+ minutes.
- Complexity: casual, medium, expert.
- Age: children, family, teens, adults.
- Type: base game, expansion, accessory.
- Mechanics and themes: top facets with search and “show more”.
- Language and condition.
- Seller quality and delivery speed.
- Sort: recommended, total price, rating, popularity, newest.
- Active-filter chips, result count, clear-all, and mobile bottom sheet.

### Results

- Sticky result toolbar with count, sort, grid/list density, and mobile filter access.
- Product cards show why the result matches: “4 players”, “45 min”, “in stock at 3 stores”.
- Display best landed cost when shipping information is available.
- Explain recommendation and offer ranking.
- Empty states suggest the smallest useful relaxation instead of a generic reset.

## Data model

Keep `MktProduct` as the canonical game identity, but normalize multi-value taxonomy.

### Add to `MktProduct`

```prisma
model MktProduct {
  // Existing fields remain.
  productType       String   @default("base_game") // base_game | expansion | accessory
  minPlayTime       Int?
  maxPlayTime       Int?
  minRecommendedAge Int?
  complexityBand    String?  // light | medium | heavy
  primaryLanguage   String?
  languageNeutral   Boolean  @default(false)
  contentStatus     String   @default("partial") // partial | complete | verified
  popularityScore   Float    @default(0)
  trendingScore     Float    @default(0)
  releasedAt        DateTime?

  mechanics         MktProductMechanic[]
  themes            MktProductTheme[]

  @@index([productType, canonicalStatus])
  @@index([minPlayers, maxPlayers])
  @@index([minPlayTime, maxPlayTime])
  @@index([complexityBand])
  @@index([popularityScore])
}
```

Use normalized facet dictionaries rather than relying on free-form `tags`.

```prisma
model Mechanic {
  id       String @id @default(cuid())
  slug     String @unique
  name     String
  products MktProductMechanic[]
}

model MktProductMechanic {
  productId  String
  mechanicId String
  product    MktProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  mechanic   Mechanic   @relation(fields: [mechanicId], references: [id], onDelete: Cascade)

  @@id([productId, mechanicId])
  @@index([mechanicId])
}

model Theme {
  id       String @id @default(cuid())
  slug     String @unique
  name     String
  products MktProductTheme[]
}

model MktProductTheme {
  productId String
  themeId   String
  product   MktProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  theme     Theme      @relation(fields: [themeId], references: [id], onDelete: Cascade)

  @@id([productId, themeId])
  @@index([themeId])
}
```

### Add an offer projection

Do not calculate marketplace aggregates by loading every listing during each request.

```prisma
model ProductOfferSummary {
  productId             String   @id
  currency              String   @default("MXN")
  minPriceMinor         Int
  maxPriceMinor         Int
  minLandedPriceMinor   Int?
  activeListingCount    Int      @default(0)
  inStockListingCount   Int      @default(0)
  pickupListingCount    Int      @default(0)
  freeShippingCount     Int      @default(0)
  fastestDeliveryDays   Int?
  bestSellerScore       Float?
  bestRankScore         Float?
  updatedAt             DateTime @updatedAt
  product               MktProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([minPriceMinor])
  @@index([inStockListingCount])
  @@index([bestRankScore])
}
```

Refresh this projection when listings, delivery options, promos, or seller scores change.

### Add discovery analytics

```prisma
model DiscoveryEvent {
  id          String   @id @default(cuid())
  sessionId   String
  customerId  String?
  eventType   String   // search | filter_apply | product_view | offer_click | add_to_cart
  query       String?
  productId   String?
  filters     Json?
  position    Int?
  resultCount Int?
  createdAt   DateTime @default(now())

  @@index([eventType, createdAt])
  @@index([sessionId, createdAt])
  @@index([productId, eventType])
}
```

Store no sensitive free-form customer data in this table.

## Search projection

Typesense remains the read model. Extend `ProductDocument` with:

- `productType`
- `minPlayTime`, `maxPlayTime`
- `complexityBand`
- normalized `mechanicSlugs`, `themeSlugs`
- `language`
- offer-summary fields
- `popularityScore`, `trendingScore`
- `contentCompleteness`

Return facet counts from Typesense in the API response:

```ts
{
  results,
  total,
  facets: {
    category: [{ value, count }],
    mechanics: [{ value, count }],
    players: [{ value, count }],
    duration: [{ value, count }],
    price: { min, max }
  }
}
```

## API contract

Expand `GET /api/v1/products`:

- `players`
- `minDuration`, `maxDuration`
- `complexity`
- `productType`
- repeated `mechanic`
- repeated `theme`
- `language`
- `condition`
- `pickup`
- `freeShipping`
- `maxDeliveryDays`
- `minSellerScore`
- `sortBy=recommended|price_asc|price_desc|rating|popular|newest`

Return normalized applied filters and facet counts. Validate all values through a DTO
instead of parsing query strings directly in the controller.

## Ranking

Recommended ranking should combine:

- text relevance
- in-stock confidence
- total landed price competitiveness
- seller composite score
- delivery speed
- product popularity and BGG rating
- catalog completeness
- personalization only after enough consented behavior exists

Every result should retain a machine-readable explanation such as:
`["in_stock", "best_price", "fits_4_players"]`.

## Delivery phases

### Phase 0 — Stabilize existing filters

- Wire current category, stock, players, price, and sort parameters end-to-end.
- Fix Prisma fallback so it applies the same filters and sorting as Typesense.
- Keep filter state in URL query parameters.
- Add mobile filter sheet, active chips, reset, and accessible controls.

Exit criteria: identical filter behavior with Typesense available or unavailable.

### Phase 1 — Offer summary and high-value facets

- Add `ProductOfferSummary`.
- Add duration, product type, complexity band, language, pickup, and free-shipping filters.
- Backfill from existing BGG and listing data.
- Reindex Typesense.

Exit criteria: p95 filtered search under 250 ms and no request-time listing aggregation.

### Phase 2 — Normalized taxonomy

- Add mechanics and themes tables.
- Import and normalize BGG mechanics/categories.
- Add admin merge/rename tooling for taxonomy values.
- Expose top facet counts and searchable long-tail facets.

Exit criteria: at least 90% of verified products have players, duration, type, and one
normalized mechanic.

### Phase 3 — Ranking and learning

- Add discovery events.
- Create popularity/trending jobs.
- Introduce explainable recommended ranking.
- A/B test filter ordering, card information hierarchy, and sort defaults.

Exit criteria: improved product-view rate and offer-click rate without reducing checkout
conversion or increasing zero-result searches.

## Measurement

Track:

- search-to-product-view rate
- product-view-to-offer-click rate
- offer-click-to-checkout rate
- zero-result rate
- filter usage and filter abandonment
- time to first product view
- result-position click distribution
- percentage of products with complete discovery metadata

## Rollout safeguards

- Feature flag the new discovery API and UI.
- Dual-write and compare old/new search responses during backfill.
- Rebuild the search index into a versioned collection, then switch aliases atomically.
- Keep URL parameters backward compatible.
- Do not deploy schema-dependent UI until migrations, backfill, and index verification pass.
