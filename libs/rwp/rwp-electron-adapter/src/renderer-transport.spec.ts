import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { RwpEnvelope } from '@retail-os/rwp-core';
import { RendererBridgeTransport } from './renderer-transport.js';
import type { WindowRwpBridge } from './ipc-channels.js';

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

describe('RendererBridgeTransport', () => {
  it('delivers sent envelopes back to local subscribers', async () => {
    const bridge: WindowRwpBridge = {
      source: 'app:pos',
      send: vi.fn(),
      onMessage: vi.fn(() => () => undefined),
    };
    const transport = new RendererBridgeTransport(bridge);
    const received = firstValueFrom(transport.incoming$);

    transport.send(envelope);

    await expect(received).resolves.toEqual(envelope);
    expect(bridge.send).toHaveBeenCalledWith(envelope);
  });
});
