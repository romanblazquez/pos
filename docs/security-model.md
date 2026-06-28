# Security Model

## Identity & access
- **Google SSO + first-party JWT**: Google proves identity once; Retail OS issues short-lived, audience-bound access JWTs and rotating server-side refresh sessions. Browser refresh credentials are HttpOnly cookies and bearer tokens remain in memory.
- **Admin allowlist**: a verified Google account still requires an active `PlatformAdminMembership`; there is no admin self-registration.
- **RBAC** (`libs/platform/security` and Nest route guards): fine-grained permissions (`sales.refund`,
  `inventory.adjust`, …) bundled into roles (`cashier`, `supervisor`, `store_manager`,
  `admin`). Marketplace customer, seller, platform admin, and service audiences are isolated;
  controller guards also enforce customer/seller resource ownership.

## Auditing
Append-only **audit log** (`AuditEvent`) for authenticated mutations and security-sensitive actions
(logins, discounts, refunds, voids, device registration). Each entry carries a
`correlationId`, joinable with the RWP event stream and the saga log.

## Device trust
A terminal must be **registered and trusted** (`DeviceRegistration`: pending → trusted →
revoked, with a public-key fingerprint) before it can transact. Revocation is immediate.

## Desktop hardening (Electron)
- `contextIsolation: true`, `nodeIntegration: false`, no remote module.
- Renderers reach the main process only via the audited preload bridge (`window.rwp`,
  `window.retailData`) — never Node or SQLite directly.
- Strict **Content-Security-Policy**; permission requests denied by default.
- Each app runs in its own isolated `BrowserWindow`, identified to the RWP broker by an
  `--retail-source` argument.

## Multi-tenancy
Every record is tenant + store scoped. Current isolation is row-level (`tenantId` filters);
the hardening roadmap adds Postgres **row-level security** / schema-per-tenant and
per-tenant encryption keys. Local SQLite encryption (SQLCipher) is a roadmap item for
at-rest protection on shared terminals.

## Transport
TLS for all API traffic; provider webhooks verified by signature before mapping onto
`IPaymentProvider.onStatus`.
