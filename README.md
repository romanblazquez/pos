# Retail OS

A world-class, modular, **offline-first Retail Operating System** — POS-first, ERP-ready,
designed to grow into a multi-tenant SaaS platform processing millions of transactions.

Built as an **Nx + pnpm modular monolith** following Domain-Driven Design, Clean &
Hexagonal Architecture, Event-Driven design, and the **Saga pattern** for distributed
checkout/payment transactions.

> Structural lineage: this workspace adapts the proven desktop-shell + interop-bus
> architecture of the sibling `fdc3-desktop-poc`, replacing FDC3 with our own
> **Retail Workspace Protocol (RWP)**.

---

## Quick start

```bash
pnpm install
pnpm test          # unit tests (domain, payments, saga, rwp)
pnpm dev           # launch Electron shell + React POS (offline demo)
```

The demo: open the launcher → POS → search products → build a cart → **Charge** →
pick **Mercado Pago Point** or **CoDi** → a simulator resolves the payment → the
`CheckoutSaga` finalizes the sale and persists it to local SQLite, fully offline,
reacting only to the `rwp.payment.completed` event. Pull your network cable and it
still works; reconnect and the outbox drains to the server.

---

## Architecture at a glance

| Layer | Tech |
|-------|------|
| Monorepo | Nx 22 + pnpm workspaces, TypeScript 5.7 |
| Desktop host | Electron 31 + electron-vite (contextIsolation, secure preload bridge) |
| POS UI | React 18 + Vite + Zustand + TanStack Query |
| Backoffice UI | Angular 21 (standalone, Signals, NgRx Signal Store) |
| Backend | NestJS modular monolith + Prisma + PostgreSQL |
| Local store | SQLite (better-sqlite3) — offline sales, outbox, saga log |
| Interop bus | RWP over RxJS, bridged across windows via IPC |
| Payments | Payment Orchestrator + provider adapters (Mercado Pago Point, CoDi) |
| Workflow | Saga orchestration for checkout/payment with compensations |
| Observability | OpenTelemetry, structured logging, correlation IDs |

```
apps/        desktop-shell (Electron) · pos (React) · backoffice (Angular) · api (NestJS)
libs/rwp/    rwp-core · rwp-bus · rwp-electron-adapter
libs/domain/ shared-kernel · catalog · inventory · sales · customers · promotions · payments
libs/platform/ saga · app-registry · workspace-engine · security
libs/payments/ payment-orchestrator · provider-mercadopago · provider-codi
libs/sync/   sync-engine          libs/data/ local-db · db-postgres
libs/shared/ shared-types · observability · ui-react
```

**Dependency rule:** `apps → payments/sync/data/platform → domain → shared-kernel`.
Domain libraries depend on nothing but `shared-kernel`; no business logic is shared
across bounded contexts.

See [`docs/architecture.md`](docs/architecture.md) for the full design, the
[ADRs](docs/adr), the [event catalog](docs/event-catalog.md), and the
[implementation roadmap](docs/roadmap.md).

---

## Workspace scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Boot POS (Vite) + Electron shell |
| `pnpm test` | Run Vitest unit suites |
| `pnpm typecheck` | Project-wide `tsc --noEmit` |
| `pnpm lint` | ESLint across `.ts/.tsx` |
| `pnpm graph` | Nx project dependency graph |
| `pnpm build` | Build POS + Electron shell |
