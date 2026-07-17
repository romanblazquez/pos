# Shopping SEO for a price-comparison catalogue

How the SEO site (`apps/web`) should present the catalogue to search engines so a
**price-comparison** product page — one game, many verified-store offers — earns
rich "product / merchant listing" results without misrepresenting itself as a
single merchant.

## 1. Entity model

- **One canonical page per product** (`/{locale}/juegos-de-mesa/{slug}`) that
  *aggregates* every seller's listing. This is the unit search engines rank; the
  offers are attributes of it, not separate pages.
- The transactional purchase lives on `app.juegospedia.com` — the SEO page links
  out ("Comprar ahora"), it does not transact. So the page is an informational +
  comparison surface, and its structured data must say "here are N offers for
  this product", not "we sell this product".
- **We are an aggregator, not the merchant.** Each `Offer.seller` is the real
  store. We never claim the offer is ours.

## 2. Structured data (`lib/jsonld.ts` → `productLd`)

Emitted per product page, mirrors on-page content only:

- `Product`: `name`, `url`, `description`, `image[]`, `category`,
  `brand` (= publisher), `additionalProperty` (BGG id).
- Offers:
  - **> 1 listing → `AggregateOffer`** with `priceCurrency`, `lowPrice`,
    `highPrice`, `offerCount`, and a nested `offers[]` of per-seller `Offer`s.
  - **1 listing → a single `Offer`** (same shape, uniform).
- Each `Offer`: `price`, `priceCurrency`, `priceValidUntil` (rolling ~30d — the
  page is ISR-revalidated well within it, clears Google's "no price validity"
  warning), `availability` (In/OutOfStock from live stock), `itemCondition`
  (New), `seller` (Organization).

**Deliberately NOT emitted:** `AggregateRating` / `Review`. The only rating we
have is BoardGameGeek's (`bggRating`) — not our first-party review corpus — so
claiming it as the product's rating would be misrepresentation and a policy risk.
Add it only when real, visible, first-party reviews exist.

## 3. Canonicalization & indexation

- Clean product/category URLs are canonical and indexable.
- Faceted / filtered / paginated variants (`?category=`, `?players=`, `?page=2`…)
  are navigational: self-canonical + `noindex` (see the listing page metadata),
  so only the clean hubs compete. Deeper products stay in the sitemap.

## 4. Social / OG

- Product OG/Twitter cards: product image + a price-anchored title
  (`{name} — {price range}`). Thin stubs (no offers, no copy) are `noindex`.
- On-page `ShareBar` (native share sheet / X / Facebook / WhatsApp / copy) makes
  the canonical URL shareable; the OG tags render the rich card.

## 5. Internal linking (topical authority + crawl surface)

- **Breadcrumbs** are built from product info: `Inicio › Categorías › <primary
  theme> › <product>`, with `BreadcrumbList` JSON-LD. Every crumb resolves.
- **Attribute anchors** on the product page turn facts into crawlable entry
  points into filtered listings: publisher/designer → search, players → the
  `players` facet. (Year / age / duration are intentionally plain text until the
  catalogue API exposes filters for them — linking to an unfiltered page would be
  thin-content SEO harm. See §7.)
- Hub-and-spoke with editorial **guides**: guide → product picks, product →
  guides that mention it.

## 6. Merchant Center / Google Shopping

- Organic rich results come from the structured data above; no feed required to
  qualify for the product snippet.
- If we later pursue Google Shopping free listings, submit a **product feed**
  representing the aggregate (lowest price + offer count) — do **not** submit as
  a single-seller feed. Keep `Offer.seller` truthful per listing.

## 7. Blocked on the catalogue API (separate service)

These need `api.juegospedia.com` schema/endpoints before the frontend can wire
them (tracked as backend tasks):

- **Multi-category products** — today `category` is only `board-game` /
  `expansion`; `themes.ts` is a stopgap browse layer over BGG tags. Real
  many-to-many product↔category (with a single editorial/publisher) unlocks
  honest category hubs and richer breadcrumbs.
- **year / recommended-age / duration filters** — once these exist, wire the
  remaining attribute anchors to real filtered landings.
