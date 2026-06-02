# Implementation Roadmap

Maps the 20 platform deliverables to status. ✅ done this pass · 🟡 scaffolded/contract ·
⬜ roadmap.

| # | Deliverable | Status | Where |
|---|-------------|--------|-------|
| 1 | Nx architecture | ✅ | `nx.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| 2 | Folder structure | ✅ | `apps/`, `libs/` (rwp/domain/platform/payments/sync/data/shared) |
| 3 | Bounded contexts | ✅ | `libs/domain/*` |
| 4 | Domain model | ✅ | [domain-model.md](domain-model.md) + tested aggregates |
| 5 | Database model | ✅ | [database-model.md](database-model.md) |
| 6 | Prisma schemas | ✅ | `libs/data/db-postgres/prisma/schema.prisma` |
| 7 | Electron design | ✅ | `apps/desktop-shell` (secure preload, broker) |
| 8 | Angular architecture | 🟡 | [ADR-0006](adr/0006-react-pos-angular-backoffice.md); `apps/backoffice` scaffold |
| 9 | React POS architecture | ✅ | `apps/pos` (runnable) |
| 10 | Workspace system | 🟡 | `libs/platform/workspace-engine` (Dockview model); shell windows |
| 11 | Payment orchestrator | ✅ | `libs/payments/payment-orchestrator` |
| 12 | Mercado Pago integration | ✅ sim / 🟡 live | `provider-mercadopago` (simulator + adapter stub) |
| 13 | CoDi integration | ✅ sim / 🟡 live | `provider-codi` (simulator + provider stub) |
| 14 | Synchronization engine | ✅ | `libs/sync/sync-engine` + outbox |
| 15 | Security model | 🟡 | `libs/platform/security` + [security-model.md](security-model.md) |
| 16 | Event catalog | ✅ | [event-catalog.md](event-catalog.md) |
| 17 | API specifications | ✅ contract | [api-spec.md](api-spec.md) |
| 18 | Architecture diagrams | ✅ | [diagrams/diagrams.md](diagrams/diagrams.md) |
| 19 | ADRs | ✅ | [adr/](adr) (0001–0006) |
| 20 | Implementation roadmap | ✅ | this file |

## Phased plan

### Phase 1 — POS GA (now → next)
Finish: live MP Point Orders API + CoDi gateway + webhook receiver; NestJS API running with
Postgres migrations + `/sync/sales`; cloud downlink (products/prices/promotions, LWW);
device registration + JWT/RBAC guards; receipt printing; cash reconciliation report.

### Phase 2 — Omnichannel & backoffice
Angular backoffice modules (inventory, customers/CRM, reporting, admin) with AG Grid +
Signal Store; promotions/loyalty engines; ecommerce catalog sync; Phase-2 payment providers
(Clip, OpenPay, Stripe Terminal); OpenTelemetry traces end-to-end.

### Phase 3 — SaaS scale
Multi-tenant runtime isolation (RLS / schema-per-tenant), per-tenant encryption, auto-update,
dead-letter + reconciliation dashboards, accounting integration, Adyen + bank rails, extract
hot contexts into services behind existing ports.

## Known follow-ups from this pass
- Dual native ABI for `better-sqlite3`: `pnpm rebuild:electron` (app) vs `rebuild:node`
  (tests); `predev` switches automatically.
- `apps/backoffice` is a documented scaffold (Angular deps added when the module set starts).
- Saga `reserve-stock` is a symmetric no-op in the renderer; real reservation moves to the
  main-process inventory context.
