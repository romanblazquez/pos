import type { OutboxRepository, SaleRepository } from '@retail-os/local-db';
import type { SaleIngestionRequest } from '@retail-os/shared-types';
import type { SyncTarget } from './sync-target.js';

export interface SyncEngineOptions {
  deviceId: string;
  /** Base retry backoff; doubles per attempt up to `maxBackoffMs`. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxAttempts?: number;
  /** Emit sync status (online/pending/lastSyncedAt) for the POS status bar. */
  onStatus?: (status: { online: boolean; pending: number; lastSyncedAt: string | null }) => void;
}

/**
 * SyncEngine — drains the local transactional outbox to the central API with
 * at-least-once delivery, exponential backoff and eventual consistency.
 *
 * Design choices (per spec): no distributed transactions, no two-phase commit.
 * The outbox guarantees durability; server-side idempotency keys guarantee
 * exactly-once *effect*. A failed push reschedules with backoff and never blocks
 * the POS — selling continues entirely offline while messages queue.
 */
export class SyncEngine {
  private timer?: ReturnType<typeof setInterval>;
  private lastSyncedAt: string | null = null;
  private readonly baseBackoff: number;
  private readonly maxBackoff: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly sales: SaleRepository,
    private readonly target: SyncTarget,
    private readonly options: SyncEngineOptions,
  ) {
    this.baseBackoff = options.baseBackoffMs ?? 1000;
    this.maxBackoff = options.maxBackoffMs ?? 60_000;
    this.maxAttempts = options.maxAttempts ?? 10;
  }

  /** Process all currently-due outbox messages once. Returns count delivered. */
  async runOnce(): Promise<{ delivered: number; online: boolean }> {
    const due = this.outbox.listDue();
    let delivered = 0;
    let online = true;

    for (const msg of due) {
      if (msg.type !== 'sales.SaleCommitted') {
        // Only sale ingestion is wired in this pass; other types stay queued.
        continue;
      }
      const req: SaleIngestionRequest = {
        idempotencyKey: msg.id,
        sale: msg.payload,
        outboxId: msg.id,
        deviceId: this.options.deviceId,
        occurredAt: msg.createdAt,
      };
      try {
        await this.target.pushSale(req);
        this.outbox.markSynced(msg.id);
        this.sales.markSynced(msg.aggregateId);
        this.lastSyncedAt = new Date().toISOString();
        delivered++;
      } catch {
        online = false;
        const attempts = msg.attempts + 1;
        const backoff = Math.min(this.baseBackoff * 2 ** msg.attempts, this.maxBackoff);
        this.outbox.recordFailure(msg.id, attempts, backoff);
        if (attempts >= this.maxAttempts) {
          // Leave for operator visibility; a dead-letter view lives in backoffice (roadmap).
        }
        break; // stop this cycle; network is down — try again next tick
      }
    }

    this.emitStatus(online);
    return { delivered, online };
  }

  start(intervalMs = 5000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    void this.runOnce();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private emitStatus(online: boolean): void {
    this.options.onStatus?.({
      online,
      pending: this.outbox.countPending(),
      lastSyncedAt: this.lastSyncedAt,
    });
  }
}
