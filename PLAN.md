# Retail OS — Implementation Plan

Last updated: 2026-06-16

## What's shipped

### Infrastructure
- [x] Nx 22 + pnpm monorepo, TypeScript 5.7
- [x] PostgreSQL via Docker (`infra/docker-compose.yml`) + automated backups
- [x] Prisma v6 schema — Seller, Listing, MktProduct, MarketplaceOrder, ConnectorSyncLog, etc.
- [x] NestJS modular monolith (`apps/api`) running with `tsx` (no emitDecoratorMetadata — all constructors use `@Inject`)
- [x] BullMQ for background jobs (ranking scheduler + connector sync scheduler)
- [x] Typesense search index with automatic collection management

### Auth & Sellers
- [x] Seller register / login (JWT Bearer)
- [x] Customer register / login
- [x] `GET /api/v1/auth/me`
- [x] `POST /api/v1/sellers` — create seller
- [x] `GET /api/v1/sellers/:id` — seller profile
- [x] `GET /api/v1/sellers/:id/listings/stats` — listing KPIs
- [x] `GET /api/v1/sellers/:id/listings` — paginated listings
- [x] `PATCH /api/v1/sellers/:id/listings/:listingId` — update price/stock/active
- [x] `GET /api/v1/sellers/:id/orders/stats` — order KPIs + 7-day daily buckets
- [x] `GET /api/v1/sellers/:id/orders` — paginated orders with line items
- [x] `GET /api/v1/sellers/:id/analytics/top-products` — top revenue products
- [x] `GET /api/v1/sellers/:id/sync/status` — connector sync last-run info

### Connectors (Tiendanube)
- [x] Tiendanube OAuth flow (start + callback)
- [x] AES-256-GCM credential encryption at rest
- [x] Full catalog sync (`POST .../sync/catalog`)
- [x] Incremental catalog sync via `updated_at_min` cursor (last successful run timestamp)
- [x] `?force=true` to bypass cursor and do a full pull
- [x] Inventory sync (`POST .../sync/inventory`)
- [x] Price sync (`POST .../sync/prices`)
- [x] Sync status endpoint (`GET .../sync/status`)
- [x] Webhook register / unregister (`POST .../webhook/register|unregister`)
- [x] BullMQ scheduler — catalog 4h, inventory 5min, prices 15min (dispatcher pattern)
- [x] Inbound Tiendanube webhook receiver (`POST /api/v1/webhooks/tiendanube/:sellerId`)
  - product/updated → direct stock+price patch, fallback to incremental sync
  - product/deleted → deactivates listing

### Marketplace & Checkout
- [x] `GET /api/v1/products` — Typesense-powered search with filters
- [x] `GET /api/v1/products/:slug` — product detail with all seller listings
- [x] `POST /api/v1/checkout` — cart validation + MercadoPago Checkout Pro
- [x] `GET /api/v1/checkout/orders/:id` — order status polling
- [x] `POST /api/v1/checkout/orders/:id/reconcile` — manual reconcile
- [x] `POST /api/v1/checkout/webhooks/mercadopago` — payment webhook (HMAC verified)
- [x] MercadoPago split payments — per-seller OAuth tokens + marketplace fee

### Admin / Catalog
- [x] BGG import (single + bulk) — fetches metadata from BGG XML API2
- [x] BGG search
- [x] `POST /api/v1/admin/catalog/products/:id/reindex` — Typesense reindex
- [x] Rankings engine (`POST /api/v1/admin/rankings/trigger`) + hourly BullMQ job
- [x] Admin order list (`GET /api/v1/checkout/admin/orders`)

### Swagger
- [x] Full Swagger docs at `/api/docs` — all endpoints documented with descriptions, examples, DTOs
- [x] Bearer auth (`seller-jwt`) wired up
- [x] All `@ApiProperty` decorators carry explicit `type:` to work without `emitDecoratorMetadata`

### Seller Portal (http://localhost:4400)
- [x] Dashboard — 4 KPI cards (total/active/outOfStock/lowStock), sync health progress bars, connector status
- [x] Listings page — paginated table, inline stock/price/active editing, modal
- [x] Orders page — status filter pills, expandable accordion cards, pagination
- [x] Analytics page — KPI row, 7-day CSS bar chart, status breakdown, top products
- [x] Connector settings — OAuth flow, manual credentials, webhook register card
- [x] Sync page — per-type last-run time, "Ejecutar" + "Completa (force)" buttons
- [x] shadcn/UI components: Button (CVA), Card, Badge, Progress, Separator
- [x] No external icon libraries — text/unicode only, professional minimal design

---

## Backlog — next priorities

### P0 — Core hardening
- [x] Input validation (`class-validator` + `ValidationPipe` on all DTOs)
- [x] Rate limiting (`@nestjs/throttler` — 120 req/min global)
- [x] Global exception filter — consistent `{ statusCode, error, message, path, timestamp }`
- [x] Pagination response envelope `{ data[], total, page, limit, pages }` on all list endpoints

### P1 — Seller Portal UX
- [x] Settings page — edit seller profile (name, email, phone, timezone)
- [x] Rewards card — seller cashback slider with live commission/payout preview
- [x] Toast notifications — sync complete/error, webhook register feedback
- [ ] MercadoPago connect flow in portal (OAuth redirect + status indicator)
- [ ] Real-time sync progress (SSE or WebSocket) instead of polling
- [ ] Dark mode toggle

### P1 — Multi-connector support
- [ ] Shopify connector — OAuth + catalog/inventory/prices sync
- [ ] WooCommerce connector — REST API + webhook receiver
- [ ] CSV import connector — parse + bulk upsert
- [ ] Connector selection UI in portal settings

### Loyalty system (shipped)
- [x] PlatformConfig — commission 5%, floor 2%, platform cashback 1%
- [x] SellerRewardConfig — per-seller store cashback (reduces commission 1:1)
- [x] CustomerWallet + StoreCredit + WalletTransaction — two-wallet ledger
- [x] LoyaltyService.computeOrderFees / awardCashback / redeemCredits
- [x] Cashback wired into checkout: awarded on payment_confirmed webhook + reconcile
- [x] Cashback badge on marketplace product cards
- [x] Cashback "+X%" shown on each seller listing row in ProductPage

### P2 — Marketplace front-end (http://localhost:4300)
- [x] Product search page — Typesense-powered
- [x] Product detail page — ranked seller listings, add to cart
- [x] Cart drawer + MercadoPago checkout flow
- [x] Order confirmation + status polling page
- [ ] Customer register/login UI (wallet balance, order history)
- [x] Category filter sidebar on search/home
- [x] Shared filter/sidebar shell contract between SEO (`apps/web`) and app (`apps/marketplace`) via `@retail-os/ui-react`
- [ ] Wallet balance in header for logged-in customers

### P2 — Admin Console (http://localhost:4500)
- [x] BGG import UI — search by name, import single/bulk
- [ ] Product moderation — approve/reject pending products
- [ ] Order management — full list with status updates
- [ ] Ranking dashboard — trigger recompute, view scores

### P3 — Platform
- [ ] Multi-tenancy — seller isolation at DB level (row-level security or schema-per-tenant)
- [ ] Email notifications — order confirmation, payment received (Resend or SES)
- [ ] Shipping integration — Envialo Simple / MercadoEnvíos
- [ ] SPEI payment provider (CoDi via BBVA or Banxico API)
- [ ] Electron POS app — full offline checkout with sync engine
- [ ] Angular backoffice — reporting, inventory management, staff management

---

## Known constraints (never violate)
- `.env` must never be committed — credentials local only
- All NestJS constructors must use `@Inject(ServiceClass)` — tsx/esbuild strips type metadata
- All `@ApiProperty` must carry explicit `type:` field — same reason
- Spanish UI for all user-facing text in POS and seller portal
- Prices always in minor currency units (centavos); divide by 100 for display
- All IDs are CUIDs (Prisma default)
