# ADR-0003 — Offline-First with SQLite + Transactional Outbox

**Status:** Accepted · **Date:** 2026-06-02

## Context
A POS must keep selling when the internet is gone, and **must never lose a sale**. We need
durable local persistence and reliable, eventually-consistent propagation to the central
system without distributed transactions.

## Decision
Each terminal owns a **SQLite** database (`better-sqlite3`, synchronous) in the Electron
main process. Committing a sale writes the sale snapshot **and** an `outbox` row in a single
SQLite transaction (transactional outbox). A **sync engine** drains the outbox to the
central API with exponential backoff; the server enforces idempotency via the message id,
giving at-least-once delivery with exactly-once effect. Reconciliation is **eventual
consistency** — no 2PC, no distributed locks.

## Consequences
- Selling continues fully offline; queued messages drain automatically on reconnect.
- The renderer never touches SQLite/Node directly — only via the preload `window.retailData`
  bridge — preserving context isolation.
- Native module ABI differs between Node (tests) and Electron (runtime); we manage this with
  `rebuild:node` / `rebuild:electron` scripts (`predev` auto-switches for the app).
