import type { Money, PaymentId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, PaymentMethod, Refund } from '@retail-os/payments-domain';
import type { IPaymentProvider, CreatePaymentIntentRequest } from '@retail-os/payment-orchestrator';

export interface CoDiProviderConfig {
  /** Banking-partner / Banxico CoDi API credentials. */
  apiKey: string;
  merchantId: string;
  baseUrl?: string;
  webhookUrl?: string;
  expirySeconds?: number;
}

/**
 * CoDiProvider — production adapter for Banxico CoDi dynamic-QR collections via
 * a participating bank's CoDi gateway.
 *
 * Real implementation (roadmap):
 *  1. `createPaymentIntent` → request a **mensaje de cobro** (collection message)
 *     for the amount, receiving a dynamic QR/`idMensajeCobro` used as
 *     `providerRef`, with an expiry.
 *  2. Status arrives via the bank's webhook (mapped onto `onStatus`), with a
 *     polling fallback; CoDi notifications resolve to approved/rejected/expired.
 *  3. Refunds are handled out-of-band (SPEI return) — `refundPayment` initiates
 *     the return transfer.
 *
 * Until credentials are wired, instances throw; the demo uses {@link CoDiSimulator}.
 */
export class CoDiProvider implements IPaymentProvider {
  readonly id = 'codi';
  readonly supportedMethods: ReadonlyArray<PaymentMethod> = ['qr'];

  constructor(private readonly config: CoDiProviderConfig) {}

  private notConfigured(): never {
    throw new Error(
      'CoDiProvider requires a configured CoDi gateway and webhook. ' +
        'Use CoDiSimulator for local/offline development.',
    );
  }

  async createPaymentIntent(_req: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    void this.config;
    this.notConfigured();
  }
  async cancelPayment(_paymentId: PaymentId): Promise<void> {
    this.notConfigured();
  }
  async refundPayment(_paymentId: PaymentId, _amount?: Money): Promise<Refund> {
    this.notConfigured();
  }
  async getPaymentStatus(_paymentId: PaymentId): Promise<PaymentStatus> {
    this.notConfigured();
  }
  onStatus(_paymentId: PaymentId, _handler: (status: PaymentStatus) => void): () => void {
    this.notConfigured();
  }
}
