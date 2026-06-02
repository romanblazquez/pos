import { describe, it, expect } from 'vitest';
import { Money, asId, type SaleId } from '@retail-os/shared-kernel';
import { RwpBus } from '@retail-os/rwp-bus';
import { MercadoPagoPointSimulator } from '@retail-os/provider-mercadopago';
import { CoDiSimulator } from '@retail-os/provider-codi';
import { PaymentOrchestrator } from './orchestrator.js';

const saleId = asId<'SaleId'>('sale-1') as SaleId;

function waitForCompleted(bus: RwpBus) {
  return new Promise<{ provider: string; status: string }>((resolve) => {
    bus.subscribe('rwp.payment.completed', (p) => resolve({ provider: p.provider, status: p.status }));
  });
}

describe('PaymentOrchestrator', () => {
  it('emits unified rwp.payment.completed for an approved Mercado Pago payment', async () => {
    const bus = new RwpBus({ source: 'test' });
    const orch = new PaymentOrchestrator(bus, [new MercadoPagoPointSimulator({ resolveDelayMs: 5 })]);
    const done = waitForCompleted(bus);
    await orch.startPayment({
      saleId,
      providerId: 'mercadopago_point',
      method: 'card_terminal',
      amount: Money.of(5800, 'MXN'),
      correlationId: 'c1',
    });
    expect(await done).toEqual({ provider: 'mercadopago_point', status: 'approved' });
  });

  it('emits unified completion when a Mercado Pago simulator callback is pushed manually', async () => {
    const bus = new RwpBus({ source: 'test' });
    const provider = new MercadoPagoPointSimulator({ resolveDelayMs: 5 });
    const orch = new PaymentOrchestrator(bus, [provider]);
    const done = waitForCompleted(bus);
    const intent = await orch.startPayment({
      saleId,
      providerId: 'mercadopago_point',
      method: 'card_terminal',
      amount: Money.of(5800, 'MXN'),
      correlationId: 'c1-manual',
      metadata: { simulate: 'manual' },
    });
    provider.simulateCallback(intent.paymentId, 'approved');
    expect(await done).toEqual({ provider: 'mercadopago_point', status: 'approved' });
  });

  it('emits a rejected outcome for CoDi when forced, with the same event shape', async () => {
    const bus = new RwpBus({ source: 'test' });
    const orch = new PaymentOrchestrator(bus, [new CoDiSimulator({ resolveDelayMs: 5 })]);
    const done = waitForCompleted(bus);
    await orch.startPayment({
      saleId,
      providerId: 'codi',
      method: 'qr',
      amount: Money.of(5800, 'MXN'),
      correlationId: 'c2',
      metadata: { simulate: 'rejected' },
    });
    expect(await done).toEqual({ provider: 'codi', status: 'rejected' });
  });

  it('emits unified completion when a CoDi simulator webhook is pushed manually', async () => {
    const bus = new RwpBus({ source: 'test' });
    const provider = new CoDiSimulator({ resolveDelayMs: 5 });
    const orch = new PaymentOrchestrator(bus, [provider]);
    const done = waitForCompleted(bus);
    const intent = await orch.startPayment({
      saleId,
      providerId: 'codi',
      method: 'qr',
      amount: Money.of(5800, 'MXN'),
      correlationId: 'c2-manual',
      metadata: { simulate: 'manual' },
    });
    provider.simulateCallback(intent.paymentId, 'expired');
    expect(await done).toEqual({ provider: 'codi', status: 'expired' });
  });
});
