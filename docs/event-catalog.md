# RWP Event Catalog

Every RWP message uses the envelope below; this catalog lists the typed `event` payloads
(`libs/rwp/rwp-core/src/events.ts`), the domain events recorded by aggregates, and the
intents/commands. Keep this file and the code in sync.

## Envelope

```ts
interface RwpEnvelope<T> {
  eventId: string;        // unique per message
  correlationId: string;  // one logical flow (a checkout, a sync run)
  timestamp: string;      // ISO-8601
  source: string;         // 'app:pos' | 'shell' | …
  target: string | null;  // directed, or null = broadcast
  version: string;        // schema version for this `type`
  kind: 'event' | 'intent' | 'command' | 'request' | 'response';
  type: string;           // e.g. 'rwp.payment.completed'
  payload: T;
  replyTo?: string;       // set on responses
}
```

## RWP events (UI-facing, on the bus)

| `type` | Emitted by | Payload | Consumers |
|--------|-----------|---------|-----------|
| `rwp.payment.requested` | Payment Orchestrator | `{ saleId, provider, method, amount }` | telemetry, payment UI |
| `rwp.payment.statusChanged` | Payment Orchestrator | `{ saleId, paymentId, provider, status }` | payment UI |
| `rwp.payment.completed` | Payment Orchestrator | `{ saleId, provider, amount, paymentId, status }` | **CheckoutSaga**, POS |
| `rwp.checkout.started` | CheckoutSaga | `{ saleId, total }` | telemetry |
| `rwp.checkout.failed` | CheckoutSaga | `{ saleId, reason }` | POS, telemetry |
| `rwp.sale.committed` | CheckoutSaga | `{ saleId, total, lineCount }` | receipt, reporting |
| `rwp.sync.status` | Sync Engine | `{ online, pending, lastSyncedAt }` | POS status bar |

> **`rwp.payment.completed` is the single unified terminal event every provider produces.**
> The POS reacts only to it and never learns which provider moved the money.

## Intents & commands

| Kind | Name | Payload |
|------|------|---------|
| intent | `StartPayment` | `{ saleId, provider, method, amount }` |
| intent | `ViewCustomer` | `{ customerId }` |
| intent | `AddToCart` | `{ productId, quantity? }` |
| intent | `PrintReceipt` | `{ saleId }` |
| command | `pos.clearCart` / `pos.focusSearch` | `{}` |
| command | `shell.openApp` | `{ appId }` |

## Domain events (recorded by aggregates → outbox)

| Type | Aggregate | When |
|------|-----------|------|
| `sales.SaleStarted` | Sale | new sale created |
| `sales.TenderStarted` | Sale | tendering begins |
| `sales.SalePaid` | Sale | balance fully covered |
| `sales.SaleCommitted` | Sale | finalized (this is the outbox/sync message) |
| `sales.SaleVoided` | Sale | sale voided |
