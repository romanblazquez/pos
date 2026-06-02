# ADR-0002 — Retail Workspace Protocol (RWP) instead of FDC3

**Status:** Accepted · **Date:** 2026-06-02

## Context
The desktop shell needs a typed, in-app interop protocol for events, intents, commands,
request/response and shared context across windows. FDC3 (from the reference project) is
finance-domain shaped and carries semantics (channels, contexts like `fdc3.instrument`)
irrelevant to retail.

## Decision
Define our own **Retail Workspace Protocol (RWP)**, RxJS-based, with a retail-typed event
catalog (`rwp.payment.completed`, `rwp.sale.committed`, …). Every message uses one envelope
(`eventId, correlationId, timestamp, source, target, version, kind, type, payload`). A
pluggable `RwpTransport` runs the same `RwpBus` in-process or across Electron windows via a
main-process broker.

## Consequences
- Domain-appropriate, fully typed messages; correlation IDs enable end-to-end tracing.
- We own the spec and can evolve it (versioned per `type`).
- We forgo FDC3 ecosystem interop — a non-goal for a retail platform.
- Structural inspiration retained from the reference's `channel-engine`/`intent-engine`.
