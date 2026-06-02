import { newId, systemClock, type Clock } from '@retail-os/shared-kernel';
import type { Db } from './database.js';

/**
 * Transactional outbox row. Committing a sale and enqueuing its outbox row
 * happen in the **same SQLite transaction**, guaranteeing that every persisted
 * sale is eventually shipped to the central API exactly once (eventual
 * consistency, no two-phase commit).
 */
export interface OutboxMessage {
  id: string;
  aggregateId: string;
  type: string;
  correlationId: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  status: 'pending' | 'synced' | 'failed';
}

export class OutboxRepository {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock = systemClock,
  ) {}

  enqueue(input: { aggregateId: string; type: string; correlationId: string; payload: unknown }): OutboxMessage {
    const now = this.clock.isoNow();
    const msg: OutboxMessage = {
      id: newId(),
      aggregateId: input.aggregateId,
      type: input.type,
      correlationId: input.correlationId,
      payload: input.payload,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
      status: 'pending',
    };
    this.db
      .prepare(
        `INSERT INTO outbox (id, aggregate_id, type, correlation_id, payload, created_at, attempts, next_attempt_at, status)
         VALUES (@id, @aggregate_id, @type, @correlation_id, @payload, @created_at, 0, @next_attempt_at, 'pending')`,
      )
      .run({
        id: msg.id,
        aggregate_id: msg.aggregateId,
        type: msg.type,
        correlation_id: msg.correlationId,
        payload: JSON.stringify(msg.payload),
        created_at: msg.createdAt,
        next_attempt_at: msg.nextAttemptAt,
      });
    return msg;
  }

  /** Due, not-yet-synced messages (respecting backoff), oldest first. */
  listDue(limit = 50): OutboxMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ?
         ORDER BY created_at ASC LIMIT ?`,
      )
      .all(this.clock.isoNow(), limit) as Record<string, unknown>[];
    return rows.map(rowToMessage);
  }

  markSynced(id: string): void {
    this.db.prepare(`UPDATE outbox SET status = 'synced' WHERE id = ?`).run(id);
  }

  /** Record a failed attempt and schedule the next try with exponential backoff. */
  recordFailure(id: string, attempts: number, backoffMs: number): void {
    const next = new Date(this.clock.now().getTime() + backoffMs).toISOString();
    this.db
      .prepare(`UPDATE outbox SET attempts = ?, next_attempt_at = ? WHERE id = ?`)
      .run(attempts, next, id);
  }

  countPending(): number {
    return (
      this.db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'`).get() as { n: number }
    ).n;
  }
}

function rowToMessage(r: Record<string, unknown>): OutboxMessage {
  return {
    id: r.id as string,
    aggregateId: r.aggregate_id as string,
    type: r.type as string,
    correlationId: r.correlation_id as string,
    payload: JSON.parse(r.payload as string),
    createdAt: r.created_at as string,
    attempts: r.attempts as number,
    nextAttemptAt: r.next_attempt_at as string,
    status: r.status as OutboxMessage['status'],
  };
}
