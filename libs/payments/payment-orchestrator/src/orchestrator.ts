import type { Money, PaymentId, SaleId } from '@retail-os/shared-kernel';
import { isTerminal, type PaymentIntent, type PaymentMethod } from '@retail-os/payments-domain';
import type { RwpBus } from '@retail-os/rwp-bus';
import type { IPaymentProvider } from './payment-provider.js';

export interface StartPaymentRequest {
  saleId: SaleId;
  providerId: string;
  method: PaymentMethod;
  amount: Money;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

/**
 * PaymentOrchestrator — the POS's single entry point to payments.
 *
 * Responsibilities:
 * - Hold the provider registry and select a provider by id (POS stays ignorant
 *   of provider internals).
 * - Create the payment intent and translate the provider's status transitions
 *   into the **unified** RWP events `rwp.payment.requested` /
 *   `rwp.payment.statusChanged` / `rwp.payment.completed`.
 *
 * The POS and the CheckoutSaga react only to `rwp.payment.completed` — they
 * never know whether the money came from a Mercado Pago terminal or a CoDi QR.
 */
export class PaymentOrchestrator {
  private readonly providers = new Map<string, IPaymentProvider>();

  constructor(
    private readonly bus: RwpBus,
    providers: IPaymentProvider[] = [],
  ) {
    for (const p of providers) this.register(p);
  }

  register(provider: IPaymentProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): IPaymentProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown payment provider: ${id}`);
    return provider;
  }

  listProviders(): IPaymentProvider[] {
    return [...this.providers.values()];
  }

  async startPayment(req: StartPaymentRequest): Promise<PaymentIntent> {
    const provider = this.getProvider(req.providerId);

    this.bus.publish(
      'rwp.payment.requested',
      {
        saleId: req.saleId,
        provider: provider.id,
        method: req.method,
        amount: req.amount.toJSON(),
      },
      { correlationId: req.correlationId },
    );

    const intent = await provider.createPaymentIntent({
      saleId: req.saleId,
      amount: req.amount,
      method: req.method,
      metadata: req.metadata,
      correlationId: req.correlationId,
    });

    const unsubscribe = provider.onStatus(intent.paymentId, (status) => {
      this.bus.publish(
        'rwp.payment.statusChanged',
        { saleId: req.saleId, paymentId: intent.paymentId, provider: provider.id, status },
        { correlationId: req.correlationId },
      );

      if (isTerminal(status) && status !== 'refunded') {
        this.bus.publish(
          'rwp.payment.completed',
          {
            saleId: req.saleId,
            provider: provider.id,
            amount: req.amount.toJSON(),
            paymentId: intent.paymentId,
            status: status as 'approved' | 'rejected' | 'cancelled' | 'expired' | 'timeout',
          },
          { correlationId: req.correlationId },
        );
        unsubscribe();
      }
    });

    return intent;
  }

  cancelPayment(providerId: string, paymentId: PaymentId): Promise<void> {
    return this.getProvider(providerId).cancelPayment(paymentId);
  }

  refundPayment(providerId: string, paymentId: PaymentId, amount?: Money) {
    return this.getProvider(providerId).refundPayment(paymentId, amount);
  }
}
