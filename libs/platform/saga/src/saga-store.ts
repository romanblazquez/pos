import type { SagaRecord, SagaStore } from './types.js';

/** Default in-memory saga store (used in tests and single-process contexts). */
export class InMemorySagaStore implements SagaStore {
  private readonly records = new Map<string, SagaRecord>();

  save(record: SagaRecord): void {
    this.records.set(record.sagaId, { ...record });
  }

  load(sagaId: string): SagaRecord | undefined {
    return this.records.get(sagaId);
  }

  findUnfinished(): SagaRecord[] {
    return [...this.records.values()].filter(
      (r) => r.status === 'running' || r.status === 'compensating',
    );
  }
}
