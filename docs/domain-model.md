# Domain Model

DDD bounded contexts as isolated libraries (`libs/domain/*`), each depending only on
`shared-kernel`. Contexts integrate via events and the RWP bus, never by shared models.

## Shared Kernel (`@retail-os/shared-kernel`)
- **Money** — immutable value object in integer minor units; currency-checked arithmetic,
  percentage, allocation, formatting. The bedrock of POS correctness (no float drift).
- **Ids** — branded id types (`ProductId`, `SaleId`, …) so ids can't be cross-wired.
- **Result<T,E>** + `DomainError` — explicit success/failure for business-rule outcomes.
- **DomainEvent** + `AggregateRoot` — event recording and `pullDomainEvents()`.
- **Clock** — injectable time for deterministic tests.

## Bounded contexts

### Catalog (`@retail-os/catalog`)
`Product` (net `unitPrice`, `taxRatePercent`, `barcode`). `CatalogIndex` — in-memory search
(< 50ms) with O(1) barcode lookup for scanners.

### Sales (`@retail-os/sales`) — the heart of the POS
`Sale` aggregate root + `SaleLine`. Lifecycle:
`draft → tendering → paid → committed` (or `voided`; `reopen()` returns tendering→draft).
Computes net subtotal, per-line + cart discounts, IVA, grand total, amount paid, balance
due. Records `SaleStarted/TenderStarted/SalePaid/SaleCommitted/SaleVoided`. Tax with a
cart-level discount is distributed proportionally across lines for correct books.

### Inventory (`@retail-os/inventory`)
`StockItem` with `onHand`/`reserved`/`available` and `reserve` / `release` /
`consumeReserved` — the reservation semantics the CheckoutSaga compensates against
(no overselling, even with concurrent offline tenders).

### Payments (`@retail-os/payments-domain`)
Provider-agnostic value objects: `PaymentIntent`, `PaymentStatus`, `PaymentMethod`,
`Refund`, terminal-status helpers. No provider SDK type crosses this boundary.

### Customers (`@retail-os/customers`)
`Customer` + loyalty accrual. (Full CRM lives in the backoffice.)

### Promotions (`@retail-os/promotions`)
Pure rule evaluation (`percentage` / `fixed`, min-subtotal, best-of selection). The full
campaign/coupon engine is a backoffice roadmap item.

## Ubiquitous language (selected)
**Sale** (a transaction), **Line** (an item row), **Tender** (collecting payment),
**Commit** (finalize + persist), **Void** (abandon), **Outbox** (durable sync queue),
**Saga** (compensating checkout workflow), **Terminal** (a registered POS device).
