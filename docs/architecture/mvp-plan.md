# Juegospedia MVP — product plan

Owner decision record. Date: 2026-07-26.
Companion to `market-and-sourcing-assessment.md` and `market-and-sourcing-plan.md`.

## The strategic truth, stated plainly

The brief is "the best marketplace price comparison in the market, ASAP".
The data says that cannot be the launch promise, and pretending otherwise would
sink the product.

Measured against the production database on 2026-07-26:

| Fact | Value |
| --- | --- |
| Active listings, entire platform | **100** |
| Distinct sellers with active listings | **2** (`Blaz`, `Test Shop`) |
| Are they real merchants? | **No — test accounts** |
| Listings priced in ARS | **510 of 1,041 (49%)** |
| Products affected by ARS | **169** |
| Currency shown for all of them | **MXN** — wrong |
| Catalogue products exposed | 2,207 |
| Products with any active listing | ~100 (**~4.5% coverage**) |

Two conclusions follow, and both are non-negotiable inputs to the plan:

1. **There is nothing to compare yet.** A comparison platform with two test
   sellers is not a comparison platform. Building more comparison UI on top of
   this void is the single easiest way to waste the next month.
2. **Half the prices on the site are wrong.** ARS listings render as Mexican
   pesos because `ProductSummary` carries no currency and `formatMoney` defaults
   to `MXN`. For a product whose entire premise is price trust, this is
   disqualifying and must be fixed before anything is shown to anyone.

## What we actually have that is strong

This is not a weak position — it is a *differently shaped* one:

- **2,207 enriched catalogue products** with images and descriptions, out of
  ~176k catalogued.
- **17 editorial guides** across 2 locales with real authorship, 6 editor
  profiles, and `Article`/`Person`/`ProfilePage` structured data that validates.
- **A mature schema** — the full `MasterGame → Edition → Printing → Product →
  Offer` identity model, price history, analytics, SEO page entities.
- **Zero indexed URLs**, meaning every architectural decision is still free.

That is an *encyclopedia and editorial* asset, not a marketplace asset.

## MVP definition

**Position the MVP as the definitive Spanish-language board-game encyclopedia and
buying-guide network for Mexico — with honest, live availability where it
exists.** Price comparison is a feature that switches on per product as supply
arrives, not the headline promise.

This is the right call for three reasons:

- It is **true today**. Nothing has to be faked or padded.
- SEO on 2,207 product pages plus a guide network is a **real acquisition engine**
  that compounds while supply is built.
- Organic traffic is the **strongest possible seller-acquisition pitch**. Supply
  follows demand, never the reverse. Ranking first is how we earn sellers.

### Explicitly out of scope for MVP

Cut ruthlessly, revisit after launch:

- The global sourcing / product-request platform. It solves "no local offer" —
  a real problem, but one that presumes seller supply we do not have.
- Seller analytics dashboards and market trend reporting. No seller to read them,
  no volume to trend.
- Multi-market expansion beyond MX/AR. Architecture must *allow* it; the MVP
  ships one market.
- Marketplace checkout, escrow, merchant-of-record.

## Prioritised backlog

### P0 — Truth. Nothing ships before this.
**Currency correctness end-to-end.** Add currency to the `ProductSummary`
contract, thread it through Typesense indexing, search and cards, and render the
real currency everywhere. Where a product has listings in more than one currency,
never merge them into one price range.

Why first: it is a live falsehood on ~169 products, it is cheap, and every
subsequent decision assumes prices are trustworthy.

### P1 — Market architecture, while it is still free
`/es` → `/es-mx`, market-scoped offers, and the ARS supply correctly attributed
to an AR market rather than silently shown to Mexican shoppers.

The currency bug and the market architecture are **the same problem**: the site
claims Mexico while half its supply is Argentina. Fixing one without the other
just relabels the symptom.

Time-sensitive: free while unindexed, expensive after go-live. This window does
not reopen.

### P2 — Launch readiness
Availability states that tell the truth (`available`, `no local offer`,
`catalogue only`), `Product` JSON-LD without fabricated `AggregateOffer` when
there are no real offers, sitemap/canonical/hreflang verification, then pull the
Traefik `noindex` lever.

### P3 — Supply
Admin seller lifecycle (activate / suspend / delete — already requested),
seller onboarding, and real merchant acquisition. This is the actual business
bottleneck and the thing that converts the MVP into a comparison platform.

### P4 — Design system completion
Migrate `apps/marketplace` off ~160 hardcoded hex/emerald values onto the token
system. Real value, but it does not change what the product *is*, and the SEO
site (`apps/web`) — the one that ranks — is already token-clean.

## Execution order

1. P0 currency correctness (start immediately)
2. P1 market architecture + URL restructure
3. P2 SEO go-live
4. P3 seller lifecycle + acquisition
5. P4 design system

## What I am explicitly recommending against

**Do not launch claiming to be a price-comparison marketplace.** With two test
sellers it would be a promise the product cannot keep, and the credibility cost
with both users and prospective sellers is not recoverable. Launch as the best
board-game encyclopedia in Spanish — which is achievable now and genuinely
excellent — and let comparison earn its headline as supply arrives.
