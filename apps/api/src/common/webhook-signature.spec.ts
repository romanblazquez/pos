import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from './webhook-signature.js';

describe('MercadoPago webhook signature', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'webhook-test-secret';
  });

  it('accepts an authentic, recent notification', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const manifest = `id:payment-1;request-id:request-1;ts:${timestamp};`;
    const signature = createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET!)
      .update(manifest).digest('hex');
    expect(() => verifyMercadoPagoSignature(
      `ts=${timestamp},v1=${signature}`, 'request-1', 'payment-1',
    )).not.toThrow();
  });

  it('rejects stale and forged notifications', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 601);
    expect(() => verifyMercadoPagoSignature(
      `ts=${timestamp},v1=${'0'.repeat(64)}`, 'request-1', 'payment-1',
    )).toThrow();
  });
});
