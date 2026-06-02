import { describe, it, expect } from 'vitest';
import { SagaOrchestrator } from './orchestrator.js';
import { InMemorySagaStore } from './saga-store.js';
import type { SagaStep } from './types.js';

interface Ctx {
  trail: string[];
  failAt?: string;
}

function step(name: string): SagaStep<Ctx> {
  return {
    name,
    invoke(ctx) {
      if (ctx.failAt === name) throw new Error(`boom at ${name}`);
      ctx.trail.push(`do:${name}`);
    },
    compensate(ctx) {
      ctx.trail.push(`undo:${name}`);
    },
  };
}

const definition = { name: 'TestSaga', steps: [step('A'), step('B'), step('C')] };

describe('SagaOrchestrator', () => {
  it('runs all steps forward on success', async () => {
    const ctx: Ctx = { trail: [] };
    const saga = new SagaOrchestrator(definition, { store: new InMemorySagaStore() });
    const res = await saga.run(ctx, { correlationId: 'c1' });
    expect(res.status).toBe('completed');
    expect(ctx.trail).toEqual(['do:A', 'do:B', 'do:C']);
  });

  it('compensates completed steps in reverse when a step fails', async () => {
    const ctx: Ctx = { trail: [], failAt: 'C' };
    const store = new InMemorySagaStore();
    const saga = new SagaOrchestrator(definition, { store });
    const res = await saga.run(ctx, { correlationId: 'c2', sagaId: 'saga-2' });
    expect(res.status).toBe('compensated');
    expect(res.error).toContain('boom at C');
    // A and B ran forward; C failed; B then A compensate (reverse order).
    expect(ctx.trail).toEqual(['do:A', 'do:B', 'undo:B', 'undo:A']);

    const persisted = await store.load('saga-2');
    expect(persisted?.status).toBe('compensated');
  });

  it('persists checkpoints so unfinished sagas are recoverable', async () => {
    const ctx: Ctx = { trail: [], failAt: 'B' };
    const store = new InMemorySagaStore();
    const saga = new SagaOrchestrator(definition, { store });
    await saga.run(ctx, { correlationId: 'c3', sagaId: 'saga-3' });
    // Terminal state is compensated; nothing left unfinished.
    expect(store.findUnfinished()).toHaveLength(0);
  });
});
