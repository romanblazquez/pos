import type { Money, PaymentId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, PaymentMethod, Refund } from '@retail-os/payments-domain';
import type { IPaymentProvider, CreatePaymentIntentRequest } from '@retail-os/payment-orchestrator';

export interface MercadoPagoPointConfig {
  accessToken: string;
  /** Device id of the assigned Point terminal (from the Devices API). */
  deviceId: string;
  /** Base URL — defaults to the production Mercado Pago API. */
  baseUrl?: string;
  /** Public URL the MP webhook posts payment updates to. */
  webhookUrl?: string;
}

/**
 * MercadoPagoPointAdapter — production adapter for Mercado Pago Point using the
 * official **Orders API** (terminal-present payments).
 *
 * Real implementation (roadmap, requires credentials + a public webhook):
 *  1. `createPaymentIntent` → POST `/v1/orders` with `type: "point"`,
 *     `config.point.terminal_id`, `transactions.payments[].amount`. Returns the
 *     order id used as `providerRef`.
 *  2. The terminal prompts the cardholder; MP posts status to `webhookUrl`.
 *     The shell's webhook receiver maps it onto `onStatus`. A polling fallback
 *     hits GET `/v1/orders/{id}` until a terminal status.
 *  3. `cancelPayment` → POST `/v1/orders/{id}/cancel`;
 *     `refundPayment` → POST `/v1/orders/{id}/refund`.
 *
 * Until credentials are wired, instances throw a clear configuration error; the
 * demo uses {@link MercadoPagoPointSimulator}.
 */
export class MercadoPagoPointAdapter implements IPaymentProvider {
  readonly id = 'mercadopago_point';
  readonly supportedMethods: ReadonlyArray<PaymentMethod> = ['card_terminal'];
  private readonly baseUrl: string;

  constructor(private readonly config: MercadoPagoPointConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.mercadopago.com';
  }

  private notConfigured(): never {
    throw new Error(
      'MercadoPagoPointAdapter requires live credentials and a public webhook. ' +
        'Use MercadoPagoPointSimulator for local/offline development.',
    );
  }

  async createPaymentIntent(_req: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    // POST `${this.baseUrl}/v1/orders` with bearer `this.config.accessToken`,
    // `config.point.terminal_id = this.config.deviceId` …
    void [this.baseUrl, this.config];
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
