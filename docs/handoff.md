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
