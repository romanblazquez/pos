import { describe, it, expect } from 'vitest';
import { RwpBus } from './bus.js';
import { InProcessTransport } from './transport.js';

/** A shared loopback transport lets two bus endpoints talk in-process. */
function pair() {
  const transport = new InProcessTransport();
  const a = new RwpBus({ source: 'app:pos', transport });
  const b = new RwpBus({ source: 'shell', transport });
  return { a, b };
}

describe('RwpBus', () => {
  it('publishes typed events with a full envelope and delivers to subscribers', async () => {
    const { a, b } = pair();
    const received = new Promise<{ paymentId: string; envType: string; source: string }>((resolve) => {
      b.subscribe('rwp.payment.completed', (payload, env) =>
        resolve({ paymentId: payload.paymentId, envType: env.type, source: env.source }),
      );
    });
    a.publish('rwp.payment.completed', {
      saleId: 's1',
      provider: 'codi',
      amount: { minorUnits: 5800, currency: 'MXN' },
      paymentId: 'pay-1',
      status: 'approved',
    });
    const r = await received;
    expect(r.paymentId).toBe('pay-1');
    expect(r.envType).toBe('rwp.payment.completed');
    expect(r.source).toBe('app:pos');
  });

  it('supports request/response correlation', async () => {
    const { a, b } = pair();
    b.onRequest<{ x: number }, { y: number }>('square', (p) => ({ y: p.x * p.x }));
    const res = await a.request<{ x: number }, { y: number }>('square', { x: 7 });
    expect(res.y).toBe(49);
  });

  it('caches shared context (last value) for late subscribers', () => {
    const { a } = pair();
    a.setContext('activeCustomer', { id: 'c1', name: 'Ada' });
    expect(a.getContext<{ name: string }>('activeCustomer')?.payload.name).toBe('Ada');
  });
});
