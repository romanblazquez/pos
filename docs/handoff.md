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
