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
