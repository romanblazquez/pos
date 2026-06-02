/**
 * Saga pattern — types.
 *
 * A saga coordinates a multi-step business transaction that spans several
 * aggregates/services without a distributed lock or two-phase commit. Each step
 * has a forward action and an optional **compensation**. If any step fails, the
 * orchestrator runs the compensations of the already-completed steps in reverse
 * to restore consistency. The saga's progress is persisted to a {@link SagaStore}
 * so an interrupted saga (app crash, power loss on a POS terminal) can be
 * recovered and either resumed or compensated.
 */
export type SagaStatus =
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

export interface SagaStep<C> {
  readonly name: string;
  /** Forward action. Throw to trigger compensation of prior steps. */
  invoke(ctx: C): Promise<void> | void;
  /** Undo this step's effect. Should be idempotent. */
  compensate?(ctx: C): Promise<void> | void;
}

export interface SagaDefinition<C> {
  readonly name: string;
  readonly steps: ReadonlyArray<SagaStep<C>>;
}

export interface SagaRecord {
  sagaId: string;
  correlationId: string;
  name: string;
  status: SagaStatus;
  /** Names of steps whose `invoke` completed successfully, in order. */
  completedSteps: string[];
  /** Index of the step currently executing (or that failed). */
  currentStepIndex: number;
  error?: string;
  /** Serialized working context for crash recovery. */
  context: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
}

/** Persistence port for saga state (in-memory default; SQLite impl in local-db). */
export interface SagaStore {
  save(record: SagaRecord): void | Promise<void>;
  load(sagaId: string): SagaRecord | undefined | Promise<SagaRecord | undefined>;
  /** Sagas left mid-flight (status 'running'|'compensating') for recovery on boot. */
  findUnfinished(): SagaRecord[] | Promise<SagaRecord[]>;
}

export interface SagaResult {
  sagaId: string;
  status: SagaStatus;
  error?: string;
  completedSteps: string[];
}
