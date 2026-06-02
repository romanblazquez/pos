# ADR-0005 — Payment Orchestrator with Provider Ports

**Status:** Accepted · **Date:** 2026-06-02

## Context
Retail OS must support many payment rails (Mercado Pago Point, CoDi, SPEI, later Clip,
OpenPay, Stripe Terminal, Adyen, banks) across regions, without the POS knowing any
provider's details, and must present a single, uniform completion signal.

## Decision
Introduce a **Payment Orchestrator** in front of a hexagonal port, `IPaymentProvider`
(`createPaymentIntent`, `cancelPayment`, `refundPayment`, `getPaymentStatus`, `onStatus`).
Every integration — adapter or simulator — implements this port. The orchestrator selects a
provider from a registry, creates the intent, and translates provider status transitions
into the **unified RWP events** `rwp.payment.requested` / `statusChanged` / `completed`.

```
POS → Payment Orchestrator → Provider Adapter (MP Point / CoDi / …)
```

Each provider ships a real-API **adapter** (credentials + webhook) and an offline
**simulator** (Approved/Rejected/Timeout/Cancelled, + CoDi Expired) for development, CI and
demos.

## Consequences
- The POS and CheckoutSaga depend only on the port and the completion event — swapping a
  simulator for a live adapter is a one-line registry change.
- New providers are additive; no caller changes.
- Phased rollout (Phase 1 MP Point/CoDi/SPEI → Phase 2 Clip/OpenPay/Stripe → Phase 3 Adyen/banks).
