# ADR-0004 — Checkout/Payment as an Orchestration Saga

**Status:** Accepted · **Date:** 2026-06-02

## Context
Checkout coordinates several contexts — tendering (sales), stock (inventory), money
(payments) and durability (sync). Some steps are remote and slow (a card terminal, a CoDi
QR). A partial failure (declined card, timeout, crash after charge) must never leave money
taken without a sale, or a sale without money. Two-phase commit across a payment terminal is
impossible.

## Decision
Model checkout as an **orchestration-based Saga** (`libs/platform/saga`). A central
`SagaOrchestrator` runs steps in order, each with a **compensation**:

| Step | Forward | Compensation |
|------|---------|--------------|
| begin-tender | freeze totals, enter tendering | reopen to draft (cart preserved) |
| reserve-stock | reserve quantities | release reservation |
| collect-payment | orchestrator starts payment, await `rwp.payment.completed`; apply if approved | refund (only runs if a later step failed after approval) |
| finalize | commit sale + persist (SQLite + outbox) | — terminal |

On any forward failure, completed steps' compensations run in reverse. Every transition is
checkpointed to a `SagaStore` (SQLite `saga_log`), so an interrupted checkout is recoverable
on boot.

## Consequences
- Consistency without 2PC; declined payments are clean and the cart survives.
- The POS stays ignorant of providers — it reacts only to the unified completion event.
- A failed compensation is recorded for operator/automated follow-up (dead-letter, roadmap).
