# ADR-0006 — React for POS, Angular for Backoffice

**Status:** Accepted · **Date:** 2026-06-02

## Context
Two very different frontends: a latency-critical cashier surface, and a broad, form- and
grid-heavy ERP backoffice maintained over years by a larger team.

## Decision
A **hybrid** frontend, both inside the same Nx workspace and Electron shell:

- **POS → React 18 + Vite + Zustand + TanStack Query.** Minimal runtime, instant rendering,
  fast cart updates, low memory. Performance budgets: search < 50ms, cart < 16ms, payment
  UI < 100ms, startup < 2s.
- **Backoffice → Angular (standalone, Signals, NgRx Signal Store, AG Grid).** Enterprise
  maintainability, batteries-included DI/forms/router for large modular teams.

Both consume the same `@retail-os/*` domain/platform libraries and the RWP bus, so business
logic is never duplicated per framework.

## Consequences
- Right tool per surface; shared domain core.
- Two UI toolchains to maintain — acceptable given the divergent requirements.
- Shared UI primitives are framework-specific (`ui-react`; an `ui-angular` follows on the roadmap).
