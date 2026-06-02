import type { Money, PaymentId, SaleId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, PaymentMethod, Refund } from '@retail-os/payments-domain';

/**
 * IPaymentProvider — the hexagonal **port** every payment integration must
 * implement. The POS and orchestrator depend only on this interface; concrete
 * adapters (Mercado Pago Point, CoDi, future Clip/Stripe Terminal/Adyen) live
 * behind it. The POS never imports a provider — it asks the orchestrator.
 */
export interface CreatePaymentIntentRequest {
  saleId: SaleId;
  amount: Money;
  method: PaymentMethod;
  /** Optional provider hints (terminal id, payer alias…). */
  metadata?: Record<string, unknown>;
  correlationId: string;
}

export interface IPaymentProvider {
  /** Stable provider id, e.g. 'mercadopago_point' or 'codi'. */
  readonly id: string;
  readonly supportedMethods: ReadonlyArray<PaymentMethod>;

  createPaymentIntent(req: CreatePaymentIntentRequest): Promise<PaymentIntent>;
  cancelPayment(paymentId: PaymentId): Promise<void>;
  refundPayment(paymentId: PaymentId, amount?: Money): Promise<Refund>;
  getPaymentStatus(paymentId: PaymentId): Promise<PaymentStatus>;

  /**
   * Subscribe to terminal status transitions for a payment (webhook/poll
   * abstraction). The adapter calls `handler` exactly once with the final
   * status. Returns an unsubscribe function.
   */
  onStatus(paymentId: PaymentId, handler: (status: PaymentStatus) => void): () => void;
}
