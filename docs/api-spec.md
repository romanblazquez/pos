# API Specification (central NestJS monolith)

API-first surface for the central backend. Auth is JWT (Bearer); every request is tenant +
store scoped from the token. Money is integer minor units. The sync ingestion endpoint is
the contract the edge sync-engine targets (`libs/shared/shared-types`).

## Sync ingestion (implemented contract this pass)

### `POST /sync/sales`
Idempotent sale ingestion from a terminal's outbox.

Headers: `Authorization: Bearer <jwt>`, `Idempotency-Key: <outboxId>`

Request (`SaleIngestionRequest`):
```json
{
  "idempotencyKey": "ob_abc123",
  "sale": { "saleId": "…", "totals": { "grandTotal": { "minorUnits": 5800, "currency": "MXN" } }, "lines": [], "payments": [] },
  "outboxId": "ob_abc123",
  "deviceId": "POS-01",
  "occurredAt": "2026-06-02T17:00:00.000Z"
}
```
Response `200` (`SaleIngestionResponse`):
```json
{ "accepted": true, "saleId": "…", "serverReceivedAt": "2026-06-02T17:00:01.000Z" }
```
Replays of the same `idempotencyKey` return `200` with the original result (no duplicate).

## Planned surface (roadmap)

| Method & path | Purpose |
|---------------|---------|
| `POST /auth/login` · `POST /auth/refresh` | JWT issue/refresh |
| `POST /devices/register` · `POST /devices/{id}/trust` | device registration |
| `GET /catalog/products?updatedSince=` | master-data downlink (LWW) |
| `GET /reports/daily-sales?store=&date=` | daily sales, payment breakdown |
| `GET /reports/cash-reconciliation` | cash cut / reconciliation |
| `POST /payments/webhooks/{provider}` | provider webhook receiver → RWP `onStatus` |
| `GET /health` · `GET /health/ready` | liveness / readiness |

OpenAPI is generated from the NestJS decorators (`@nestjs/swagger`) when the API module
set lands.
