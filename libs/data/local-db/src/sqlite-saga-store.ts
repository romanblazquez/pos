import type { SagaRecord, SagaStore } from '@retail-os/saga';
import type { Db } from './database.js';

/**
 * SqliteSagaStore — durable {@link SagaStore} so a CheckoutSaga survives a
 * terminal crash/power-loss mid-payment. On boot the shell calls
 * `findUnfinished()` to recover sagas that were left `running`/`compensating`.
 */
export class SqliteSagaStore implements SagaStore {
  constructor(private readonly db: Db) {}

  save(r: SagaRecord): void {
    this.db
      .prepare(
        `INSERT INTO saga_log (saga_id, correlation_id, name, status, completed_steps, current_step, error, context, started_at, updated_at)
         VALUES (@saga_id, @correlation_id, @name, @status, @completed_steps, @current_step, @error, @context, @started_at, @updated_at)
         ON CONFLICT(saga_id) DO UPDATE SET
           status=@status, completed_steps=@completed_steps, current_step=@current_step,
           error=@error, context=@context, updated_at=@updated_at`,
      )
      .run({
        saga_id: r.sagaId,
        correlation_id: r.correlationId,
        name: r.name,
        status: r.status,
        completed_steps: JSON.stringify(r.completedSteps),
        current_step: r.currentStepIndex,
        error: r.error ?? null,
        context: JSON.stringify(r.context),
        started_at: r.startedAt,
        updated_at: r.updatedAt,
      });
  }

  load(sagaId: string): SagaRecord | undefined {
    const row = this.db.prepare('SELECT * FROM saga_log WHERE saga_id = ?').get(sagaId) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  findUnfinished(): SagaRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM saga_log WHERE status IN ('running', 'compensating')`)
      .all() as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }
}

function rowToRecord(r: Record<string, unknown>): SagaRecord {
  return {
    sagaId: r.saga_id as string,
    correlationId: r.correlation_id as string,
    name: r.name as string,
    status: r.status as SagaRecord['status'],
    completedSteps: JSON.parse(r.completed_steps as string),
    currentStepIndex: r.current_step as number,
    error: (r.error as string) ?? undefined,
    context: JSON.parse(r.context as string),
    startedAt: r.started_at as string,
    updatedAt: r.updated_at as string,
  };
}
