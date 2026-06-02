# ADR-0001 — Start as a Modular Monolith, not Microservices

**Status:** Accepted · **Date:** 2026-06-02

## Context
Retail OS must eventually serve thousands of merchants and millions of transactions, but
it starts as a focused POS. Microservices up front would impose network boundaries,
distributed-data complexity and operational overhead before we understand the seams.

## Decision
Build a **modular monolith**: one Nx workspace, one deployable backend (NestJS), with hard
internal boundaries — bounded-context libraries that depend only on `shared-kernel` and
integrate through events/ports, never by reaching into each other's models. Nx tags and
review enforce the dependency rule `apps → infra → domain → shared-kernel`.

## Consequences
- Fast local development, atomic refactors, one transaction boundary where it helps.
- Because contexts already talk through contracts (events, `IPaymentProvider`, `SyncTarget`),
  any context can later be extracted into a service **without changing callers**.
- We accept that scaling individual contexts independently is deferred until justified.
