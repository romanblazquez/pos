import { newId, newCorrelationId } from './ids.js';

/**
 * DomainEvent — something meaningful that happened in the domain, in the past
 * tense (e.g. `SaleCommitted`). Events are the backbone of the event-driven
 * architecture: aggregates record them, the outbox persists them, the
 * sync-engine ships them, and the RWP bus publishes their UI-facing projections.
 */
export interface DomainEvent<T = unknown> {
  readonly eventId: string;
  readonly correlationId: string;
  /** Past-tense event type, namespaced, e.g. 'sales.SaleCommitted'. */
  readonly type: string;
  readonly occurredAt: string; // ISO-8601
  readonly aggregateId: string;
  readonly version: number;
  readonly payload: T;
}

export interface CreateEventInput<T> {
  type: string;
  aggregateId: string;
  payload: T;
  correlationId?: string;
  version?: number;
  occurredAt?: string;
}

export function createDomainEvent<T>(input: CreateEventInput<T>): DomainEvent<T> {
  return {
    eventId: newId(),
    correlationId: input.correlationId ?? newCorrelationId(),
    type: input.type,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    aggregateId: input.aggregateId,
    version: input.version ?? 1,
    payload: input.payload,
  };
}

/**
 * AggregateRoot — base for entities that own a consistency boundary and record
 * domain events. Callers pull events via `pullDomainEvents()` after a unit of
 * work and hand them to the outbox.
 */
export abstract class AggregateRoot<Id extends string = string> {
  private readonly _events: DomainEvent[] = [];

  protected constructor(public readonly id: Id) {}

  protected record(event: DomainEvent): void {
    this._events.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const drained = [...this._events];
    this._events.length = 0;
    return drained;
  }

  get hasPendingEvents(): boolean {
    return this._events.length > 0;
  }
}
