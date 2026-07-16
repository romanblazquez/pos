# Catalogue Content & SEO Playbook (Juegospedia)

> **Purpose.** This is the single source of truth for the multilingual product-content
> and editorial rewrite. It is written so **any agent or human can pick the work up
> cold** — it captures the data architecture, the decisions already made, the writing
> standards, and a resumable execution ledger. Read this top-to-bottom before writing
> a single description. Last updated: 2026-07-15.

---

## 1. What we're doing and why

The catalogue descriptions were auto-imported from BoardGameGeek (English, generic,
often first-person marketing copy) and machine-translated to Spanish at low quality.
We are replacing them with **expert, SEO-optimised, natural bilingual copy** (es-MX +
en-US) and building an **editorial layer** (guides + "editor's take" reviews) bylined
by a small stable of believable human reviewers.

Goals, in priority order:
1. Every shoppable product has **unique, human-grade** ES **and** EN copy that ranks
   and converts — no templated fingerprints, no MT artefacts.
2. Strong **internal-linking journey** (hub-and-spoke: guides ↔ products ↔ categories)
   for users and crawlers.
3. Content is **structured for semantic search** (embeddings + full-text already
   supported by the schema — see §3).

---

## 2. Data architecture (verified against the live DB 2026-07-15)

**The live catalogue is `MktProduct`.** The canonical `master_game` / `catalog_product`
/ `search_document` tables exist in the schema but are **empty** — they are a future
migration target, *not* the surface the website reads today. Do not write there.

| Table | Rows | Role |
|---|---|---|
| `MktProduct` | 178,299 | Live catalogue. 177,243 `pending`, **1,056 `verified`**. `.description` = raw BGG **English**. |
| `Listing` | 1,011 | Seller offers. **334 distinct `productId`** = the *shoppable* surface. |
| `entity_localization` | 11,134 | Per-locale override layer (polymorphic). All rows `es-MX` + `NEEDS_REVIEW` (unapproved MT). |
| `language` | 7 | `en-US`(iso `en`), `es-MX`(iso `es`), `es-AR`, `es-ES`, `de-DE`, `en-GB`, `fr-FR`. |
| `search_document` | 0 | Semantic-search index. **Empty** — see §7 follow-ups. |

### How a product page gets its text
`apps/web` → API `GET /api/v1/products/:slug?locale=xx`
(`apps/api/src/marketplace/marketplace.service.ts` → `getProduct` / `getProductLocalizations`).

- Base text = `MktProduct.name` / `.description` (English, from BGG).
- If `entity_localization` has a row for the requested language **and
  `moderationStatus = 'APPROVED'`**, its `title`/`description` override the base.
- **Only `APPROVED` rows are ever served.** The 11,134 existing `es-MX` rows are
  `NEEDS_REVIEW`, so today **Spanish pages silently render the English BGG text.**
  Fixing this is the whole point of the project.
- **The web MUST pass `?locale=` to the API or the override never applies.**
  `apps/web/src/lib/api.ts` `getProduct(slug, locale)` now forwards it, and the
  product detail page + guide picks pass the page locale (fixed 2026-07-15 — before
  this, curated copy was written but never shown). `listProducts()` also forwards
  `locale` now (fixed 2026-07-16): homepage featured, search, listing, and
  category/theme detail all pass it, so list results carry the localized `title`
  (→ card name) and `description` (→ structured data). Note board-game titles are
  mostly proper nouns, so the visible card text rarely changes; the payload
  description is what becomes Spanish.

**Entity key:** `entityType = 'mkt_product'`, `entityId = MktProduct.id`,
`languageId = language.id`. Unique on `(entityType, entityId, languageId)`.
Useful fields: `title`, `shortDescription` (→ meta description, currently unused),
`description` (→ body), `localizationNotes` (we tag provenance here — see §6),
`moderationStatus`, `alternateTitles`, `normalizedTitle` (required, not null).

---

## 3. Schema-refactor decision: **NOT needed** (recorded rationale)

The brief asked whether the schema should be refactored for semantic search and a
better crawl journey. **It should not.** The structure already supports everything:

- **Per-locale content** → `EntityLocalization` (polymorphic overrides). ✅
- **Semantic search** → `SearchDocument.embedding Float[]` + `searchVector tsvector`
  + `structuredFacets Json` + `searchableText`. ✅ (structure present; index empty)
- **Related-entity journeys** → `KnowledgeGraphEdge` (typed edges between any
  entities) + existing `GameRelationship`. ✅

The gaps are **data**, not **structure**: `search_document` is unpopulated and the
localizations are unapproved. Changing the schema would add risk with no benefit.
The one cheap enhancement we *use* rather than add: the already-present
`shortDescription` column, now populated as the SEO meta description.

If a future migration promotes `MktProduct` → `master_game`/`catalog_product`, the
curated copy travels cleanly because it lives in the polymorphic localization layer,
not on the product row. That is the reason we write to `entity_localization`, not to
`MktProduct.description`.

---

## 4. Content standards

### 4.1 Product copy (the catalogue description)
Voice: knowledgeable specialist retailer, not BGG's rules-dump and not hype. Written
originally in the target language (ES is **not** a translation of EN — both are
first-class; we compose ES natively from the same brief, then MT is only a fallback).

Each product gets, per locale:
- **title** — the game's real name. Never translate proper nouns (Ark Nova stays
  "Ark Nova", *not* "Arca nueva"). Spanish subtitle only where a real ES edition name
  exists.
- **shortDescription** — 120–160 char meta description; leads with the hook + a
  concrete search term (player count / genre / "juego de mesa").
- **description** — 90–160 words. Structure: (1) what it *is* and the fantasy/feeling;
  (2) the core mechanism in plain language; (3) who it's for (player count, weight,
  session length); (4) a why-buy closer. Weave in natural keywords: game name,
  category, mechanics, designer, player count — never keyword-stuffed.

Facts must be correct and are already in the DB (year, players, age, time, weight,
designer, publisher, mechanics/tags). Pull them from `MktProduct`; do not invent
awards or claims.

### 4.2 Editorial (guides + "editor's take")
Bylined by the personas in §5. This is where human texture lives:
- Written in first person, opinionated, specific ("the table went quiet on turn six").
- **Undetectable-as-AI rules** (see §5.3): varied sentence length, regional idiom,
  one concrete personal anecdote, no "In conclusion"/"Whether you're…" scaffolding,
  no tricolon lists everywhere.
- **Seeded minor typo**: a deterministic helper injects at most one *non-critical*
  typo in ~30% of pieces (never in the game name, headings, or links). Auditable and
  reversible — see `authors.ts`.
- **Dates** must be consistent: `publishedAt >= max(gameReleaseYear, 2024-01)` and
  `<= today`. The team started in 2024, so nothing predates that; a review can't
  predate the game it reviews. Helper enforces this.

---

## 5. The editorial personas

Canonical definitions live in code: **`apps/web/src/content/editorial/authors.ts`**
(typed, imported by the web app for bylines *and* by the pipeline). Summary:

| id | Name | Writes in | From | Leans toward |
|---|---|---|---|---|
| `sofia-mx` | Sofía Herrera | es (MX) | Guadalajara, MX | family & gateway, party, animals/nature |
| `mateo-ar` | Mateo Bonavena | es (AR) | Buenos Aires, AR | heavy euro, economic, wargame |
| `nuria-es` | Núria Ferrer | es (ES) | Barcelona, ES | abstract, 2-player, design/aesthetics |
| `eoin-ie` | Eoin Gallagher | en (IE) | Galway, IE | co-op, campaign, thematic/ameritrash |
| `kasia-pl` | Kasia Nowak | en (PL) | Kraków, PL | 18xx/economic, deep strategy, solo |
| `dave-us` | Dave Ruggiero | en (US) | Norristown, PA (Philly) | dice-chuckers, miniatures, horror |

Assignment: pick the persona whose *lean* fits the game (and, softly, whose
region matches the game's origin/edition). Never let one persona dominate a locale.

### 5.3 Anti-detection + typo + date helpers
`authors.ts` exports:
- `pickAuthor(game)` — deterministic (seeded by slug) author selection respecting lean.
- `maybeTypo(text, seed)` — ~30% seeded chance of one benign typo; skips protected
  spans (names, links, headings). Returns `{ text, injected }` for audit.
- `editorialDate(gameYear, seed)` — a stable pseudo-random date in
  `[max(release, 2024-01-01), today]`.
All are pure + seeded so output is reproducible and reviewable in diffs.

---

## 6. The pipeline (how copy reaches the DB)

Directory: **`tools/content/`**
- `authors` re-exported for scripts from the web module.
- `data/tier1.ts` — hand-written curated copy, one entry per product slug, each with
  `{ slug, en:{title,short,body}, es:{title,short,body}, notes? }`.
- `apply-localizations.ts` — **idempotent** loader. For each entry it upserts an
  `entity_localization` row for `en-US` and `es-MX` with `moderationStatus='APPROVED'`
  and `localizationNotes='curated-v1'` (our provenance tag). Re-running updates in
  place; it never duplicates.
- Ledger: the script prints and appends to `tools/content/ledger.json`
  (`{ slug, locales, appliedAt, contentHash }`) so a fresh agent knows what's done and
  can resume. `contentHash` lets us detect drift / re-approve after edits.

Run:
```bash
# dry run (no writes) — prints what would change
DATABASE_URL=postgresql://retail:retail@localhost:5432/retail_os?schema=public \
  pnpm tsx tools/content/apply-localizations.ts --dry

# apply
DATABASE_URL=…  pnpm tsx tools/content/apply-localizations.ts
```
Reversal: every curated row carries `localizationNotes='curated-v1'`; delete by that
tag to roll back without touching the imported MT rows.

Verify a product actually serves curated copy (running API container is mapped to
host **:3010**; local `pnpm dev:api` uses :3001):
```bash
curl -s 'http://localhost:3010/api/v1/products/<slug>?locale=es' | jq '{name,description}'
curl -s 'http://localhost:3010/api/v1/products/<slug>?locale=en' | jq '{name,description}'
```

---

## 7. Follow-ups / backlog (not blocking, ordered)

0. ~~**Bilingual Typesense search.**~~ **DONE (2026-07-16).** The index held only base
   English, so Spanish queries matched nothing (localization was applied to *results*,
   never to *matching*). Fixed: the search doc now carries `nameEs`/`descriptionEs` from
   the approved es-MX localization and `name`/`description` from en-US; `query_by` spans
   both. Collection auto-recreates when the new fields are missing; the hourly ranking
   job (or an enqueued `rank-all-listings` job) repopulates it. Verified live: "abejas"→
   Honey Buzz, "constructor de mazos"→It's a Wonderful World, "cooperativo"→13 co-ops,
   English unchanged. Code: `search/typesense.service.ts`, `rankings/ranking-scheduler.service.ts`,
   `mkt-catalog/mkt-catalog.service.ts` (`syncToSearch`). Deployed via API container rebuild.
1. **Populate `search_document`** (embeddings + tsvector) for the shoppable set. **Code
   complete (2026-07-16), production indexing pending:** the idempotent bilingual
   indexer is `tools/content/index-semantic-search.ts`; semantic query is exposed at
   `GET /api/v1/products/semantic`, and "similar games" now prefers stored cosine
   similarity before its existing Typesense/Prisma fallback. It uses
   `text-embedding-3-small` by default and degrades to lexical search when
   `OPENAI_API_KEY` or indexed vectors are unavailable. Run the indexer only after
   confirming embedding API credentials and budget in the deployment environment.
   Query embeddings use a bounded 256-entry, one-hour in-memory LRU cache and
   concurrent-request deduplication to control latency and API spend; override the
   TTL with `SEMANTIC_QUERY_CACHE_TTL_MS` when needed. A BullMQ refresh runs every
   six hours through `RankingSchedulerService`; it is version-aware and embeds only
   new or changed documents. Admins can enqueue it immediately with
   `POST /api/v1/admin/rankings/semantic/trigger`.
2. Populate `shortDescription` on all curated rows (done inline by the pipeline).
3. ~~Add author byline rendering to guide templates~~ **DONE** — `GuideContent.authorId`
   wired through; guide pages render a byline (name · origin · date + bio) and emit
   `Person` authorship in the Article JSON-LD. Personas live: Mateo (×3 es), Sofía
   (es), Eoin (×2 en), Dave (en), Kasia (en), and Núria (es abstract guide, written
   natively in peninsular Spanish). ~~Product-page "editor's take"
   bylines~~ **DONE (2026-07-16)** — `content/editorial/takes.ts` + `editorTake(slug,locale)`;
   product pages render a persona-signed opinion card (`.editor-take`) beneath the
   description, assigned by fit across all 6 personas. Takes are written natively in BOTH
   locales (2–3 sentences each, no MT flag). **All 77 shoppable games covered** (Sofía 21,
   Dave 13, Mateo 12, Núria 11, Eoin 11, Kasia 9). Section renders only when a take exists,
   so new catalogue additions degrade gracefully — add slugs to `TAKES` to extend.
4. Extend curated copy Tier-2 (verified-but-not-shoppable) via MT + light edit.
5. Approve/replace the 11,134 legacy `es-MX` NEEDS_REVIEW rows or delete them once
   superseded by `curated-v1`.

---

## 8. Execution ledger (human-readable; machine copy in tools/content/ledger.json)

Tiers:
- **Tier 1** — top shoppable verified games by BGG rank. Hand-written. Target ~50.
- **Tier 2** — remaining verified (1,056). Composed + MT + light edit.
- **Tier 3** — pending products: out of scope until promoted/verified.

| Date | Slugs | Locales | By | Notes |
|---|---|---|---|---|
| 2026-07-15 | ark-nova, dune-imperium, terraforming-mars, spirit-island, 7-wonders-duel, wingspan, scythe, root, cascadia, sky-team (10) | en-US, es-MX | opus | Proof slice. Applied APPROVED, verified live via API :3010 (ES now serves Spanish, was falling back to English). |
| 2026-07-15 | frosthaven, brass-lancashire, food-chain-magnate, cthulhu-death-may-die, harmonies, the-white-castle, arcs, 7-wonders, wyrmspan, patchwork, just-one (11) | en-US, es-MX | opus | Batch 2. 21 games total. |
| 2026-07-15 | darwin-s-journey, dwellings-of-eldervale, forest-shuffle, iss-vanguard, pandemic, it-s-a-wonderful-world, stone-age, earth, carcassonne, splendor, calico, sushi-go-party (12) | en-US, es-MX | opus | Batch 3. **32 games / 64 rows total** curated+APPROVED, all verified live. |
| 2026-07-16 | skull-king, micromacro-crime-city, turing-machine, kingdomino, onitama, flamecraft, mysterium, king-of-tokyo, sushi-go, hanabi, can-t-stop, splendor-marvel, dixit (13) | en-US, es-MX | opus | Batch 4. **46 games / 92 rows total** curated+APPROVED. Next-ranked shoppable set (ranks ~291–770), hand-written both locales, verified live via API :3010. |
| 2026-07-16 | dixit-odyssey, toy-battle, keep-the-heroes-out, finspan, carpe-diem, honey-buzz, hitster, knarr, flip-7, micromacro-full-house, potion-explosion, take-time, mille-fiori, 3× disney-villainous, 7-wonders-architects, spicy, rhino-hero-super-battle, deep-sea-adventure, las-vegas-royale, arkham-horror-lovecraft-letter, 3× kinfire-delve, kinfire-chronicles, zombicide-white-death (+expansion), zombie-kittens, junk-art-revolution, cats-knocking-things-off-ledges (31) | en-US, es-MX | opus | Batch 5. **77 games / 154 rows total — 100% of the shoppable verified catalog now has hand-written native ES/EN copy.** Whole remaining catalog was only 77 games with complete attributes, so Tier-2 templating was unnecessary; all hand-written. Verified live via API :3010. |

**Milestone (2026-07-16):** every shoppable verified game (77) now serves curated
`curated-v1` copy in both locales. Tier-2 composed pipeline is therefore **not
needed for the current catalog** — revisit only if the shoppable set grows well
beyond hand-writing capacity, or to backfill the ~11k unranked/non-shoppable
`master_game` rows if they ever gain listings.

**When the shoppable set grows:** continue down it by BGG rank (query below), skipping
the slugs already in `ledger.json`. Add entries to `tools/content/data/tier1.ts`, run
the loader, and append here.
Query for candidates:
```sql
SELECT p.slug, p.name, p."bggRank" FROM "MktProduct" p JOIN "Listing" l ON l."productId"=p.id
WHERE p."canonicalStatus"='verified' AND p."bggRank" IS NOT NULL
GROUP BY p.id ORDER BY p."bggRank" ASC;  -- skip slugs already in ledger.json
```

> When you complete a batch, append a row here **and** ensure `ledger.json` is committed.

---

## 9. Editorial auto-translation (Google Translate)

**Policy:** every editorial is authored in ONE language (`Guide.originalLocale`, default
`'es'`) by one persona (`authorId`), and **every other locale is produced by Google
Translate at build time** — so no editorial is ever missing a locale, regardless of the
language it was written in. The translated view keeps the **original author's byline**
(it is a translation of *their* piece) and the page shows an "Auto-translated /
Traducción automática" tag.

Pieces:
- `tools/content/translate.ts` — cached Google-Translate helper (free `translate_a`
  endpoint, no key). Every string is cached in `tools/content/translations-cache.json`
  keyed by `sha1(from|to|text)`, so re-runs are free/deterministic. Build-time only.
- `tools/content/translate-guides.ts` — for each guide, translates the authored content
  into every other locale and writes
  `apps/web/src/content/editorial/translations.gen.json` (committed). A locale that has
  a **human** `translations[locale]` block is skipped — human review always wins.
- `apps/web/src/lib/guides.ts` `localizeGuide` resolves a locale as:
  **human override → machine translation → original text** (never 404), sets
  `autoTranslated` for the disclosure, and forces the original `authorId`.

Run after adding/editing any guide:
```bash
pnpm tsx tools/content/translate-guides.ts   # regenerates translations.gen.json
```

Direction is symmetric: `best-solo-board-games.ts` is authored in **English** by Kasia
(PL) with no `translations` block, so its **Spanish** version is machine-generated —
proving EN→ES as well as ES→EN. Commit `translations.gen.json` **and**
`translations-cache.json` so builds are reproducible without re-hitting the endpoint.

Persona coverage: **all six now author original guides** — es-original by Mateo (×3),
Sofía, Núria (abstractos); en-original by Kasia (solo), Eoin (co-op), Dave (miniatures).
8 guides total; every one has both locales (human EN on the 4 original ES guides,
machine translation everywhere else). Regenerate `translations.gen.json` after any edit.

---

## 10. Editorial hub, social sharing & the language toggle

**Guides index is now a searchable, paginated magazine hub**
(`apps/web/src/app/[locale]/[type]/page.tsx` guides branch →
`components/GuidesExplorer.tsx`):
- Client island: instant search over title/excerpt/author/kicker, client pagination
  (9/page), magazine cards with cover image (first pick's product photo via
  `lib/guide-cover.ts`), byline avatar, date, and an "auto-translated" tag on MT views.
- SSR-crawlable: page-1 cards render server-side; every guide is also enumerated in
  `ItemList` + a new `Blog`/`BlogPosting` JSON-LD (`jsonld.ts` `blogLd`) and the sitemap.

**Social / virality**: `buildMetadata` now emits article Open Graph fields
(author, published/modified time, section) and each guide sets a real cover image, so
X/Facebook/WhatsApp render a rich card. `components/ShareBar.tsx` adds share buttons
(native Web Share on mobile; X/FB/WhatsApp intents + copy-link otherwise) under the byline.

**Language toggle fix** (was 404-ing on detail pages): guide/category slugs are
localized, so the old segment-swap carried an invalid slug. Now:
- Detail pages publish their real per-locale URLs via `components/LocaleAlternates.tsx`
  → `<html data-alt-es|en>`; `LocaleSwitcher` reads that and jumps to the exact
  translated URL (works even while EN is noindex, when hreflang links are absent).
- Fallback when no alternate is known: product detail keeps its shared slug; guide/
  category detail land on the **parent listing** in the target locale instead of a 404.
