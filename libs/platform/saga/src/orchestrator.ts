import { newId, systemClock, type Clock } from '@retail-os/shared-kernel';
import type { SagaDefinition, SagaRecord, SagaResult, SagaStore } from './types.js';
import { InMemorySagaStore } from './saga-store.js';

export interface SagaOrchestratorOptions<C> {
  store?: SagaStore;
  clock?: Clock;
  /** Serialize the working context into the persisted saga record. */
  serialize?: (ctx: C) => Record<string, unknown>;
  /** Hook for tracing/telemetry on each step transition. */
  onStep?: (event: { step: string; phase: 'invoke' | 'compensate' | 'failed'; sagaId: string }) => void;
}

/**
 * SagaOrchestrator — orchestration-based saga runner.
 *
 * Executes a {@link SagaDefinition}'s steps in order, persisting progress after
 * every transition. If a forward `invoke` throws, it walks the already-completed
 * steps in reverse and runs each `compensate`, then reports a `failed`/
 * `compensated` result. Because every transition is checkpointed to the
 * {@link SagaStore}, a terminal that dies mid-checkout can recover the saga on
 * next boot and finish compensating.
 *
 * This is the engine behind the **CheckoutSaga** (reserve stock → create payment
 * → await completion → commit sale → enqueue outbox), where compensations
 * release stock, cancel the payment and void the sale.
 */
export class SagaOrchestrator<C> {
  private readonly store: SagaStore;
  private readonly clock: Clock;

  constructor(
    private readonly definition: SagaDefinition<C>,
    private readonly options: SagaOrchestratorOptions<C> = {},
  ) {
    this.store = options.store ?? new InMemorySagaStore();
    this.clock = options.clock ?? systemClock;
  }

  async run(ctx: C, meta: { correlationId: string; sagaId?: string }): Promise<SagaResult> {
    const record: SagaRecord = {
      sagaId: meta.sagaId ?? newId<'SagaId'>(),
      correlationId: meta.correlationId,
      name: this.definition.name,
      status: 'running',
      completedSteps: [],
      currentStepIndex: 0,
      context: this.snapshot(ctx),
      startedAt: this.clock.isoNow(),
      updatedAt: this.clock.isoNow(),
    };
    await this.store.save(record);

    for (let i = 0; i < this.definition.steps.length; i++) {
      const step = this.definition.steps[i];
      record.currentStepIndex = i;
      record.updatedAt = this.clock.isoNow();
      await this.store.save(record);
      try {
        this.options.onStep?.({ step: step.name, phase: 'invoke', sagaId: record.sagaId });
        await step.invoke(ctx);
        record.completedSteps.push(step.name);
        record.context = this.snapshot(ctx);
        await this.store.save(record);
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        this.options.onStep?.({ step: step.name, phase: 'failed', sagaId: record.sagaId });
        await this.compensate(ctx, record);
        return this.result(record);
      }
    }

    record.status = 'completed';
    record.context = this.snapshot(ctx);
    record.updatedAt = this.clock.isoNow();
    await this.store.save(record);
    return this.result(record);
  }

  private async compensate(ctx: C, record: SagaRecord): Promise<void> {
    record.status = 'compensating';
    record.updatedAt = this.clock.isoNow();
    await this.store.save(record);

    const stepsByName = new Map(this.definition.steps.map((s) => [s.name, s]));
    for (const name of [...record.completedSteps].reverse()) {
      const step = stepsByName.get(name);
      if (!step?.compensate) continue;
      try {
        this.options.onStep?.({ step: name, phase: 'compensate', sagaId: record.sagaId });
        await step.compensate(ctx);
      } catch (compErr) {
        // A failed compensation needs human/automated intervention; record and continue.
        record.error = `${record.error}; compensation '${name}' failed: ${
          compErr instanceof Error ? compErr.message : String(compErr)
        }`;
      }
    }
    record.status = 'compensated';
    record.context = this.snapshot(ctx);
    record.updatedAt = this.clock.isoNow();
    await this.store.save(record);
  }

  private snapshot(ctx: C): Record<string, unknown> {
    if (this.options.serialize) return this.options.serialize(ctx);
    try {
      return JSON.parse(JSON.stringify(ctx)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private result(record: SagaRecord): SagaResult {
    return {
      sagaId: record.sagaId,
      status: record.status,
      error: record.error,
      completedSteps: record.completedSteps,
    };
  }
}
