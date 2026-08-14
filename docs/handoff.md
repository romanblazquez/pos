# Handoff

## 2026-06-02

### Mercado Pago Point local OAuth integration (desktop-shell)
- Added `MercadoPagoSync` module in the Electron main process: local OAuth callback server, token exchange, token refresh, local token persistence, terminal discovery, and boot-time state restore.
- Wired `MercadoPagoSync` into `LocalStore` so it can use the active terminal tenant/store context.
- Added IPC handlers for Mercado Pago connect/dev-connect/disconnect/discover/state.
- Extended preload `retailIntegrations` bridge with `mercadopago*` methods.
- Updated renderer integration typings to include Mercado Pago state/method signatures.
- Replaced Mercado Pago stubs in payment provider settings with real IPC calls:
  - state hydration on mount
  - OAuth credentials form (Client ID + Client Secret)
  - development token connect flow
  - disconnect flow
  - terminal discovery + terminal list rendering
- Added styling for provider OAuth credential fields under `.provider-connect-options` and existing terminal/dev sections.

### Validation
- `pnpm typecheck`: pass
- `pnpm test`: fails due local native module mismatch (`better-sqlite3` compiled for NODE_MODULE_VERSION 125, runtime expects 127)

### Settings information architecture update
- Moved Integrations UI from standalone app routing into the Settings app's Integraciones section.
- Added `integrations` section mapping in `SettingsPanel` to render `IntegrationsPanel` directly within Settings.
- Removed standalone Integrations route rendering from `App.tsx`.
- Removed `integrations` app registration from `config/app-directory.json` so configuration lives under Settings.

### Validation (IA move)
- `pnpm typecheck`: pass

## 2026-06-28 continuation

### Validation on current `main`
- Rebuilt `better-sqlite3` locally for Node 22 / ABI 127 using the repository's
  `rebuild:node` workflow; this resolves the native-module mismatch recorded
  above.
- `pnpm test`: pass (9 files, 29 tests).
- `tsc --noEmit -p apps/desktop-shell/tsconfig.json`: pass.
- Root `pnpm typecheck`: fail. The failures are outside the desktop-shell
  handoff scope and include stale/missing Prisma client generation, missing
  Vite `ImportMeta.env` types, and `apps/web` path-alias resolution. Do not use
  the June 2 root type-check result as the current repository status.

### OAuth callback hardening
- Replaced the timestamp OAuth `state` with a cryptographically random value
  and reject callbacks whose state does not match.
- Authorization denials and callbacks without a code now fail immediately and
  close the local callback server instead of remaining in `connecting` until
  the two-minute timeout.

### Remaining Mercado Pago production hardening
- Encrypt the persisted token/credential blob. `MercadoPagoSync` currently
  serializes the access token, refresh token, client ID, and client secret as
  plaintext JSON in `provider_connections.encrypted_access_token`; the column
  name does not provide encryption.
- Add focused tests for OAuth callback validation, token refresh persistence,
  tenant-scoped disconnect/load queries, and legacy persisted-token migration.

### Juegospedia design-system migration
- Migrated both the public `apps/web` catalogue and the transactional
  `apps/marketplace` SPA from the earlier emerald/Inter theme to the Claude
  Design handoff's parchment, clay, forest, and brass system.
- Added the Bricolage Grotesque, Hanken Grotesk, and Space Mono type roles,
  self-hosted by `next/font`, plus the meeple brand mark.
- Reworked the header/footer, patterned home hero and search, value cards,
  category chips, product cards, faceted filters, product detail, offer table,
  pagination, responsive layouts, and empty catalogue states.
- Updated the transactional SPA's Juegospedia/meeple header, home discovery
  hero, 3:4 product cards, product gallery, metadata, price summary, seller
  comparison rows, badges, buttons, and dark theme.
- Updated shared UI tokens and button geometry so imported primitives use the
  same design language.
- Validation: `next build apps/web`, the `apps/web` TypeScript project, and the
  shared `ui-react` TypeScript project all pass. The `apps/marketplace`
  TypeScript project and production Vite build also pass.

### Shared catalogue filter/sidebar follow-up
- Fixed the `apps/web` search/catalogue sidebar so it matches the working retail
  app structure: constrained sticky scrolling, result count, reset action,
  compact availability control, grouped price/sort/category sections, and a
  bounded category list on desktop and mobile.
- Extracted `CatalogFilterPanel` and `CatalogFilterSection` into `ui-react` and
  reused them in both `apps/web` and `apps/marketplace`.
- Kept each app's appropriate interaction model: crawlable native GET form
  controls in the Next.js site and immediate React state updates in the Vite
  retail app.
- Added a narrow `@retail-os/ui-react/catalog-filter` path mapping so the retail
  app does not import the full shared barrel. The final marketplace bundle stays
  at approximately 338 KB JS / 46 KB CSS and has no Tailwind selector warning.
- Validation: `apps/web`, `apps/marketplace`, and `ui-react` TypeScript projects
  pass; both Next.js and Vite production builds pass.

## 2026-06-27 continuation

### Apex SEO + App sidebar parity guardrail
- Enforced the same shared sidebar component contract for both user surfaces:
  - SEO/crawlable site (`apps/web`) now imports `CatalogFilterPanel` and
    `CatalogFilterSection` from `@retail-os/ui-react`.
  - Transactional app (`apps/marketplace`) now uses the same public import path
    and the same component name (`CatalogFilterPanel`) instead of a local alias.
- Architectural decision for the monorepo: sidebar shell and section structure
  live in `libs/shared/ui-react`, while each app supplies its own interaction
  mode (server GET form for editorial SEO and instant client state for app UX).
- Product rationale: keeps filtering semantics and merchandising hierarchy
  consistent across discovery channels, reducing cognitive load and preserving a
  stable retail comparison journey for board game shoppers.

### Validation
- `pnpm tsc --noEmit -p apps/web/tsconfig.json`: fails due existing workspace
  dependency/env gaps (`next` and several Radix packages not resolved in this
  shell), but no new `@retail-os/ui-react/catalog-filter` path error after
  unifying imports through `@retail-os/ui-react`.
- `pnpm tsc --noEmit -p apps/marketplace/tsconfig.json`: fails for the same
  existing shared-ui dependency gap (`@radix-ui/react-*` modules unresolved);
  no sidebar contract/import regression introduced by this continuation.

### Apex SEO sidebar parity with marketplace UX
- Updated `apps/web` filter sidebar interaction model to match the marketplace
  visual/interaction language while preserving crawlable server GET semantics.
- Replaced free-form price min/max fields with preset budget chips (sin tope,
  hasta $500, $1,000, $1,500) and added players chips (todos, 1..5+).
- Kept submit-based filtering for SEO stability and added hidden sort
  persistence (`rank_score` default) so ranking remains deterministic.
- Wired new `players` facet end-to-end in the apex listing/search route and
  API client (`minPlayers` query param) and removed the obsolete `min` field
  from this sidebar flow.
- Added marketplace-like card/chip styles in `apps/web/src/app/globals.css`
  (`market-*` classes) so Apex and app sidebars now look and behave consistently
  across desktop breakpoints.

### Dockerized local-dev hot reload stack
- Added `docker-compose.dev.yml` for containerized development with live reload
  against local source files (bind mount `.:/workspace`) across:
  - `api-dev` on host port `3002`
  - `web-dev` (Apex SEO Next.js) on host port `4500`
  - `marketplace-dev` (Vite SPA) on host port `4300`
- Configured polling-based file watching for Docker Desktop/macOS reliability:
  `CHOKIDAR_USEPOLLING`, `WATCHPACK_POLLING`, and interval tuning.
- Kept Postgres dependency external to the dev compose and pointed API to host
  Postgres (`host.docker.internal:5432`), matching the existing infra stack.
- Fixed startup race condition where `api-dev`, `web-dev`, and
  `marketplace-dev` ran `pnpm install` concurrently over the same bind-mounted
  workspace (causing intermittent `ERR_PNPM_ENOENT/ENOTEMPTY`).
- Added a single `deps-dev` bootstrap service that performs dependency install
  once; app services now depend on `deps-dev` completion and only start their
  dev servers.
- Fixed dependency visibility for app containers by switching to one shared
  `dev_node_modules` volume across `deps-dev`, `api-dev`, `web-dev`, and
  `marketplace-dev` (previous per-service node_modules volumes caused
  `marketplace-dev` to fail with `vite: not found`).
- Fixed marketplace container reachability from host by running Vite with
  `--host 0.0.0.0` in `docker-compose.dev.yml` (logs showed
  "Network: use --host to expose", and host requests were reset).
- Corrected the command wiring to avoid passing a literal `--` to Vite via pnpm
  script forwarding. `marketplace-dev` now runs
  `pnpm exec vite --config apps/marketplace/vite.config.mts --host 0.0.0.0`,
  which binds beyond loopback inside the container.
- Added Prisma client generation (`pnpm db:generate`) to `deps-dev` bootstrap
  so `api-dev` does not fail with `Cannot find module '.prisma/client/default'`
  when starting inside Docker.
- Updated admin-console dev proxy target to `http://localhost:3002` in
  `apps/admin-console/vite.config.mts` so local admin actions (including BGG
  import endpoints) work with the Dockerized API port instead of requiring a
  separate host API instance on `3000`.
- Fixed `api-dev` startup command in `docker-compose.dev.yml` to run `tsx`
  directly instead of `pnpm dev:api`. The package script hardcodes
  `DATABASE_URL=...localhost:5432`, which is invalid from inside Docker and
  caused Prisma `P1001` DB connection failures.
- Added explicit `api-dev` environment overrides for cross-compose infra access:
  `REDIS_HOST=host.docker.internal`, `TYPESENSE_HOST=host.docker.internal`, and
  companion port/API key values. This resolves container-local defaults to
  `localhost` that previously caused Redis connection errors.

### Analytics policy update (dev)
- Disabled GA4 emission in development mode for both discovery surfaces:
  - `apps/web/src/components/Analytics.tsx` now gates script/pageview logic to
    `NODE_ENV === 'production'`.
  - `apps/marketplace/src/analytics.ts` now gates init/events with
    `!import.meta.env.DEV`.
- Result: local/dev sessions no longer send GA4 traffic; production behavior is
  unchanged.

### Docker dev compose update (Apex)
- Renamed storefront service from `web-dev` to `apex-dev` in
  `docker-compose.dev.yml` for explicit Apex naming.
- Moved Apex dev server to dedicated port `4600` and updated container command
  to `next dev -p 4600 -H 0.0.0.0` so it can run independently from other local
  frontends.

### Docker dev compose update (Admin)
- Added `admin-dev` service in `docker-compose.dev.yml`.
- Service runs Vite admin console with host binding (`--host 0.0.0.0`) and
  exposes `4500:4500` for local access.
- Kept `deps-dev` and `api-dev` dependencies so admin starts with shared
  dependencies and API availability.

### Docker dev compose update (Seller portal)
- Added `seller-portal-dev` service in `docker-compose.dev.yml`.
- Service runs the seller portal Vite dev server on `4400:4400` with host
  binding and points `VITE_API_URL` at `http://localhost:3002` so it can reach
  the host-mapped API from the browser.

## 2026-08-14 — Marketplace SEO surface + seller fulfillment

Four related pieces of work, all deployed to production and verified live.

### 1. Publisher and mechanic landing pages (`apps/web`)

Shipped `/editoriales` (es) / `/publishers` (en) and `/mecanicas` /
`/mechanics`: a hub per taxonomy plus a landing page per entity, reusing the
`EntityKind`/`SEGMENTS` routing that already existed but was never
implemented. Each carries breadcrumbs, `BreadcrumbList` + `ItemList` JSON-LD,
canonical + hreflang, pagination-aware noindex, and sibling cross-links.
Added to `sitemap.xml`, the footer, and the mobile nav.

**Bug found while shipping it.** `getMechanics()` and `getFacets()` were
scoped to `verified` products with an active seller listing — a few dozen
rows — while the sitemap, detail pages and search all treat the full ~178k
product encyclopedia as indexable. The hub pages were therefore listing 28
publishers and 113 mechanics out of hundreds. Both now read Typesense facet
counts first (the pattern `getCategories()` already used), falling back to
the old query only when the index is empty. Publisher faceting required
marking that field facetable, migrated in place. Result: 28 → 995
publishers. BGG's bracketed non-publishers (`(Self-Published)`,
`(Web published)`, `(Unknown)`) are filtered — they are not entities that
deserve a landing page.

### 2. Real mechanics, split from categories

`MktProduct.tags` blended BGG categories and mechanics into one 12-item
array, so "mechanics" pages ranked `Card Game`, `Wargame` and
`Expansion for Base-game` as top mechanics, and longer games lost real
mechanics to the cap.

Added a dedicated `MktProduct.mechanics` column
(migration `20260814180000_mkt_product_mechanics`), written at ingestion by
both `mkt-catalog.service.ts` and the `bgg-enricher` worker, with a matching
Typesense facet field. `getMechanics()` and the mechanics search filter read
it instead of `tags`; the legacy column is untouched for compatibility.

Historical rows were backfilled by intersecting existing `tags` against
BGG's official mechanic vocabulary — precision over recall, since the
original per-product split was never stored and cannot be perfectly
reconstructed. `apps/api/scripts/backfill-mechanics.ts`, run once against
production: **154,890 Postgres rows, 133,748 Typesense documents**.
Mechanics went 274 (polluted) → 178 (real); `/mecanicas/card-game` now 404s
instead of rendering a category as a mechanic.

### 3. Public seller storefronts

Shipped `/tiendas` (es) / `/stores` (en): a hub of active sellers and a
landing page each, listing their real catalogue. Typesense gained a
`sellerSlugs` facet per product (populated from visible active listings,
same rule `ProductIndexerService` already applies to pricing), plus a
`seller` search filter and two public endpoints
(`GET /products/sellers`, `GET /products/sellers/:slug`). Only `active`
sellers are ever public — pending/suspended/churned are not storefronts.
Backfill for pre-existing indexed docs:
`apps/api/scripts/backfill-seller-slugs.ts`.

JSON-LD is `Organization`, deliberately **not** `Store` with an
`aggregateRating`: the only seller quality signal available (`SellerScore`)
is an internal operational metric, not a first-party review corpus, and
`jsonld.ts` already forbids asserting fabricated ratings.

**Build fragility fixed.** Adding one more fetch to `sitemap.xml` tipped a
pre-existing problem into a hard build failure: the route was still being
statically pre-rendered at `next build` while fetching the entire indexable
catalogue, routinely brushing Next's 60s static-worker timeout. Switched
from `revalidate = 3600` to `dynamic = 'force-dynamic'`. It already sets its
own `Cache-Control`, so runtime caching is unchanged — the build simply
stops trying to render tens of thousands of URLs.

### 4. Seller order fulfillment and refunds

`OrdersPage` was read-only and the API had no mutation endpoint at all:
sellers could see orders but could not ship, track or cancel them.

Added `PATCH /api/v1/sellers/:id/orders/:orderId` with a transition table
(`confirmed→shipped|cancelled`, `shipped→delivered`,
`pending|reserved→cancelled`), carrier/tracking on shipment and reason on
cancellation, both recorded on the existing `OrderEvent` trail rather than
new columns. The portal mirrors the same table so it never offers a move the
API would reject.

Cancelling a gateway-paid order performs a **real MercadoPago refund**
(`checkout.refundOrder`), issued against the account that *collected* the
money — a connected seller's payment was taken with their own OAuth token,
so refunding it with the platform token would 404 against an account the
payment does not exist under. Such orders end as `refunded`, not
`cancelled`. A refund failure propagates rather than being swallowed: the
order keeps its previous status instead of reading cancelled while the buyer
is still charged.

**Money bug this surfaced.** `awardCashback` fires on confirmation and
nothing reversed it, so buy-then-refund returned the buyer's money *and*
left them the credits the purchase earned — free credits, repeatable. Added
`loyalty.clawbackCashback`, clamped to the balance actually present in both
pots (the buyer may already have spent it). Credits are not a debt we can
chase, so it recovers what is there and records the real figure on the order
event rather than driving a wallet negative.

### 5. Manual listing creation

Every listing previously arrived through connector sync, so a seller without
a connector — or with a game the connector never carried — could not sell
anything. Added `POST /api/v1/sellers/:id/listings` plus a catalogue-picker
modal in the portal.

Restricted to products already in the master catalogue: letting sellers
invent catalogue entries is how a marketplace ends up with six spellings of
Catan competing for one page. Currency defaults to the seller's configured
market rather than the schema's `MXN`, so an ARS seller cannot silently
publish MXN-labelled prices. Both create and update now reindex the product
— cards are served from the search index, so without it a new listing or a
price edit stayed invisible until the hourly ranking pass.

### Validation

- `api`, `web`, `seller-portal` typecheck: pass.
- `apps/api` vitest: 98 tests pass, including new
  `sellers.service.spec.ts` (13) and `loyalty.service.spec.ts` (5) —
  neither module had tests before.
- Deployed and verified live: `retail-os-api`, `retail-os-seo-web`,
  `retail-os-web`, `retail-os-bgg-enricher`.

### 6. Bulk listing edits reindex via a queued job

Bulk activate/deactivate updated Postgres but never touched the search
index, so a seller who pulled stock kept seeing it offered on the storefront
until the hourly ranking pass — the site advertising something the seller had
withdrawn. Reindexing inline was not an option: a select-all edit can span
the seller's whole catalogue and would time out the request.

Added a `reindex-products` job to the existing BullMQ ranking queue
(`enqueueReindex`), chunked at 200 ids so one failure cannot lose the whole
batch and the single worker is never held for minutes. `bulkUpdateListings`
collects affected `productId`s **before** the update — a filter like
`status: active` stops matching the very rows it just deactivated, so
reading afterwards would silently reindex nothing. Enqueueing is
fire-and-forget: a queue failure must not fail the seller's edit, and the
hourly pass remains the backstop.

### 7. Sellers can change their own password

`SettingsPage` could edit a name, phone and timezone but not a password, and
there was no endpoint for it either. A seller who suspected their account was
compromised had no self-service way to lock anyone out.

`PATCH /api/v1/auth/seller/password` requires the **current** password even
though the caller already holds a valid session. That is the point: a live
session can be a borrowed laptop or a stolen refresh token, and proving
knowledge of the existing password is what makes this a lockout rather than
another use of the compromised session.

On success every *other* session family is revoked. Sessions rotate on
refresh, so the JWT's `sid` may already point at a replaced row — the
`familyId` is the stable identity of "this device's login", so the caller's
own family is preserved (changing your password in Settings should not log
you out of the tab you are standing in) and all others die. If the current
family cannot be resolved, it revokes everything rather than skipping
revocation: the safe default when identity is uncertain is to log everyone
out.

Two refusals worth knowing about: a Google-provisioned account has no
password to verify, so it is rejected rather than silently having one set
(that would create a second, unverified door into the account); and setting
the new password equal to the old one is rejected rather than reported as
success. Both success and failure are written to the audit log — a run of
failures is what a brute-force attempt looks like.

`apps/api/src/auth/change-password.spec.ts` covers the wrong-current-password
refusal, the same-password refusal, the Google-only refusal, that the hash
actually changes and verifies against the new value, and that other sessions
are revoked (including the unresolved-family fallback).

### 8. Taxonomy hubs: findable, and pagination you can navigate

The publisher hub rendered 995 chips as one flat wall — no search, no
ordering, no sense of which publishers carry a catalogue. Same shape for
mechanics (178) and stores.

`EntityFilter` (client component) adds an accent-insensitive search box, a
"most games / A–Z" sort toggle, and a live "showing N of M" count, reused by
all three hubs.

The important constraint is that these hubs exist for internal linking, so
**every chip stays in the server-rendered HTML** and the fold is CSS-only
(`.chip.is-folded { display: none }`). An earlier draft sliced the array to
120 before render, which would have deleted 875 crawlable publisher links
from the page — the opposite of the point. Verified in production HTML: 995
links present, 120 visible, 875 folded.

Pagination was a ±1 window with no context, on catalogues up to 622 pages.
It now shows the result range ("193–240 de 1,427"), widens the window to ±2,
and adds first/last shortcuts — on a 622-page listing, stepping is not a
navigation strategy.

### 9. Seller analytics: date ranges and CSV export

Analytics was hardcoded to the last 7 days with no way out and no export.

`GET :id/orders/stats?days=` and `.../analytics/top-products?days=` now take a
window (7 / 30 / 90 / 365 in the UI), clamped 1-365 server-side — the daily
series is assembled in memory from every order in the range, so an unbounded
window is a way to ask the endpoint to load a seller's whole history into a
Map. Empty days are seeded as zeros so the chart shows a gap as a gap rather
than closing it up.

`GET :id/orders/export.csv` returns **one row per order LINE**, because that
is what reconciles against an accounting sheet; an order row containing three
products cannot be matched to stock movements without re-deriving them.

Three details in that file are load-bearing:

- **Money is emitted in MAJOR units with the currency in its own column.**
  The API speaks minor units throughout, but a spreadsheet does not know that
  convention — pasting centavos into a `SUM()` produces a number 100x too
  large and nothing in the file would say so.
- **Formula injection is neutralised.** Excel executes a leading `=`, `+`,
  `-` or `@` on open, so a product named `=HYPERLINK(...)` would run. Such
  cells are prefixed with a quote to stay text.
- **UTF-8 BOM + CRLF.** Without the BOM Excel opens the file as latin-1 and
  every accented product name arrives mangled.

The export is fetched and downloaded via a Blob rather than a plain `<a
href>`: the endpoint needs an Authorization header, so a link would download
an HTML 401 page named `pedidos.csv` — which looks like a working export
until someone opens it.

### 10. Sellers can close their own store

`POST /api/v1/sellers/:id/deactivate` sets the store to `suspended` — the
existing reversible state — and deactivates every listing. It never deletes:
order history is a financial record and a buyer's purchase history, which is
why `deleteSeller` already refuses once orders exist.

Requires the current password, for the same reason the password change does:
a live session can be a borrowed laptop, and closing a shop is not something
a borrowed tab should do.

**Refuses with 409 while any order is pending/reserved/confirmed/shipped.** A
seller vanishing mid-fulfilment strands buyers who have already paid, and no
UI copy repairs that afterwards — those orders have to be shipped, delivered
or cancelled first.

On success: listings deactivated, affected products reindexed (cards come
from the search index, so without it a closed store's offers linger until the
hourly pass), and every session revoked including the caller's. Audited as
`seller.self_deactivated`, deliberately distinct from `seller.suspended` — in
the status column they look identical but they mean opposite things when
someone later audits why a store went dark.

The UI is behind a typed `CERRAR` confirmation and states plainly that
nothing is deleted and the store can reopen.

### 11. Email change — BLOCKED, and why

Not built, deliberately. Changing the address an account recovers through is
only safe behind a verify-the-new-address round trip, and **this platform
cannot send email**: no mail dependency in any `package.json`, no SMTP or
provider credentials in the deployed env, and no mailer service anywhere in
`apps/api`. `Seller.emailVerified` exists but is only ever written by the
Google OAuth path, where Google did the verifying.

So there are exactly two honest options, and both need a decision that is not
a coding one:

1. **Add an email provider** (Resend/SES/Postmark/SMTP) — needs an account,
   credentials, and SPF/DKIM DNS on juegospedia.com. Once that exists, the
   change-email flow is small: pending address + single-use token + confirm
   endpoint, and notify the OLD address too.
2. **Google-only re-auth** for accounts that signed in with Google, which
   sidesteps mail entirely but covers only those accounts.

What must NOT happen is shipping a change-email endpoint without
verification. That silently moves account recovery to an address the owner
may not control — a typo locks them out permanently, and a hijacked session
takes the account for good.

### Correction to an earlier assessment

An earlier survey reported that `seller-portal` had no router and no
deep-linking. That was wrong, and verifying before "fixing" it avoided
rewriting working code: `Dashboard.tsx` already implements
`parseNavFromPath` + `pushState` + `popstate`, and the nginx config already
has `try_files $uri $uri/ /index.html` for all three SPAs. Deep links to
`/orders`, `/listings`, `/markets`, `/settings` all return 200 in
production.

### Incidental fix

`retail-os-typesense` had been reporting unhealthy for 7,561 consecutive
checks. The healthcheck fix was committed in July but the running container
was never recreated to pick it up. Recreated; data volume untouched.

### Known gaps (not started)

- `apps/backoffice` is still a README with no source. Note that
  `apps/admin-console` (React, deployed) already covers sellers, catalog,
  orders, markets, ranking, BGG import and analytics across 9 views with
  real URL routing — a greenfield Angular backoffice would duplicate a
  working surface, so ADR-0006 is worth revisiting before building it.
- Analytics has no date-range picker or CSV export (hardcoded to the last 7
  days).
- Settings still has no **email** change or self-deactivation. Both are
  deliberately harder than the password change that landed: an email change
  needs a verify-new-address round trip before it takes effect (otherwise a
  typo or a hijacked session silently moves account recovery to an address
  the owner does not control), and deactivation has to decide what happens
  to live listings and in-flight orders first.
- `bgg-enricher` throughput is the thing to watch, not its health flag. It
  runs ~250-560 products/hour when BGG is not blocking, and there are
  ~22,900 products still unenriched. BGG returns HTTP 403 periodically
  (circuit-open records exist for Jul 11, Jul 25 and Aug 14); the breaker
  then reports 503 by design and half-opens every 120 minutes. An
  `unhealthy` container is therefore normal and self-healing — the real
  signal is the hourly enrichment count going to ~0 and staying there,
  which means the block is persistent rather than a rate-limit window and
  pacing or the scraper fingerprint needs attention.
