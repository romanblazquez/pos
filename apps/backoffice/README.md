# Retail OS — Backoffice (Angular)

The ERP/admin surface: inventory, customers/CRM, reporting, accounting, configuration.
Per [ADR-0006](../../docs/adr/0006-react-pos-angular-backoffice.md) this is built with
**Angular (standalone components, Signals, NgRx Signal Store, AG Grid)** for long-term
enterprise maintainability, consuming the same `@retail-os/*` domain/platform libraries and
the RWP bus as the POS — so business logic is never duplicated per framework.

## Status: documented scaffold
Angular dependencies are intentionally **not** installed in this foundation pass to keep the
workspace install lean and focused on the runnable POS slice. They are added when the
backoffice module set begins (Phase 2 of the [roadmap](../../docs/roadmap.md)).

## Planned structure
```
apps/backoffice/
  src/app/
    shell/            # launcher-hosted Angular shell, RWP bus bridge
    inventory/        # stock grid (AG Grid), adjustments, alerts  — Signal Store
    customers/        # CRM: profiles, loyalty, segments
    reports/          # daily sales, payments breakdown, cash reconciliation
    admin/            # users, roles (RBAC), devices, configuration
  project.json        # Nx @nx/angular targets
```

## First module
**Reporting → Daily Sales** consuming the API's reporting endpoints and the central Postgres
read models, with AG Grid + an NgRx Signal Store, validating the Angular ↔ RWP ↔ shared-lib
integration end-to-end.
