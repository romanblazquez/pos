import { describe, expect, it, vi } from 'vitest';
import type { RwpEnvelope } from '@retail-os/rwp-core';
import { RwpBroker, type BrokerTarget } from './broker.js';

function target(id: number): BrokerTarget & { send: ReturnType<typeof vi.fn> } {
  return {
    id,
    send: vi.fn(),
    isDestroyed: () => false,
  };
}

const envelope: RwpEnvelope = {
  eventId: 'evt-1',
  correlationId: 'corr-1',
  timestamp: '2026-06-02T00:00:00.000Z',
  source: 'app:pos',
  target: null,
  version: '1.0',
  kind: 'event',
  type: 'rwp.payment.completed',
  payload: { saleId: 'sale-1', provider: 'codi', amount: { minorUnits: 100, currency: 'MXN' }, paymentId: 'pay-1', status: 'approved' },
};

describe('RwpBroker', () => {
  it('fans out broadcasts to peer windows only', () => {
    const broker = new RwpBroker();
    const origin = target(1);
    const peer = target(2);
    broker.register(origin, 'app:pos');
    broker.register(peer, 'shell');

    broker.publish(envelope, origin.id);

    expect(origin.send).not.toHaveBeenCalled();
    expect(peer.send).toHaveBeenCalledWith('rwp:deliver', envelope);
  });

  it('does not echo a self-targeted envelope over IPC', () => {
    const broker = new RwpBroker();
    const origin = target(1);
    broker.register(origin, 'app:pos');

    broker.publish({ ...envelope, target: 'app:pos' }, origin.id);

    expect(origin.send).not.toHaveBeenCalled();
  });
});
