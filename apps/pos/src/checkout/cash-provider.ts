import { newId, type Money, type PaymentId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, Refund } from '@retail-os/payments-domain';
import type { CreatePaymentIntentRequest, IPaymentProvider } from '@retail-os/payment-orchestrator';

/**
 * CashPaymentProvider — local tender adapter for cash payments. It still goes
 * through the orchestrator so checkout, events, saga compensation and sync do
 * not special-case cash inside the POS UI.
 */
export class CashPaymentProvider implements IPaymentProvider {
  readonly id = 'cash';
  readonly supportedMethods = ['cash'] as const;

  private readonly intents = new Map<PaymentId, PaymentIntent>();
  private readonly finalStatuses = new Map<PaymentId, PaymentStatus>();

  async createPaymentIntent(req: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    const paymentId = newId<'PaymentId'>() as PaymentId;
    const status = parseStatus(req.metadata?.simulate);
    const intent: PaymentIntent = {
      paymentId,
      saleId: req.saleId,
      provider: this.id,
      method: 'cash',
      amount: req.amount,
      status: 'pending',
      providerRef: `cash-${paymentId}`,
      createdAt: new Date().toISOString(),
    };
    this.intents.set(paymentId, intent);
    this.finalStatuses.set(paymentId, status);
    return intent;
  }

  async cancelPayment(paymentId: PaymentId): Promise<void> {
    this.setStatus(paymentId, 'cancelled');
  }

  async refundPayment(paymentId: PaymentId, amount?: Money): Promise<Refund> {
    const intent = this.intents.get(paymentId);
    if (!intent && !amount) {
      throw new Error(`Unknown cash payment: ${paymentId}`);
    }
    if (intent) this.setStatus(paymentId, 'refunded');
    return {
      refundId: `refund-${newId<'PaymentId'>()}`,
      paymentId,
      amount: amount ?? intent!.amount,
      status: intent ? 'refunded' : 'rejected',
      createdAt: new Date().toISOString(),
    };
  }

  async getPaymentStatus(paymentId: PaymentId): Promise<PaymentStatus> {
    return this.intents.get(paymentId)?.status ?? 'cancelled';
  }

  onStatus(paymentId: PaymentId, handler: (status: PaymentStatus) => void): () => void {
    const timer = window.setTimeout(() => {
      const status = this.finalStatuses.get(paymentId) ?? 'approved';
      this.setStatus(paymentId, status);
      handler(status);
    }, 120);
    return () => window.clearTimeout(timer);
  }

  private setStatus(paymentId: PaymentId, status: PaymentStatus): void {
    const intent = this.intents.get(paymentId);
    if (!intent) return;
    this.intents.set(paymentId, { ...intent, status });
  }
}

function parseStatus(value: unknown): PaymentStatus {
  if (
    value === 'approved' ||
    value === 'rejected' ||
    value === 'cancelled' ||
    value === 'expired' ||
    value === 'timeout'
  ) {
    return value;
  }
  return 'approved';
}
