import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentIntent,
  ProviderPaymentStatus,
  RefundResult,
} from '@retail-os/payments-contracts';

export interface MercadoPagoPointAdapterConfig {
  accessToken?: string;
  apiBaseUrl?: string;
  webhookUrl?: string;
}

/**
 * Production Mercado Pago Point adapter boundary.
 *
 * This class intentionally does not process anything until live credentials,
 * webhook verification and the official Mercado Pago Orders API integration are
 * configured. Local development should use MercadoPagoPointEmulatorAdapter.
 */
export class MercadoPagoPointAdapter implements PaymentProvider {
  readonly provider = 'mercadopago-point';

  constructor(private readonly config: MercadoPagoPointAdapterConfig = {}) {}

  async createPaymentIntent(_input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    this.assertConfigured();
    throw new Error('MercadoPagoPointAdapter Orders API integration is not enabled in this environment.');
  }

  async cancelPayment(_paymentId: string): Promise<void> {
    this.assertConfigured();
    throw new Error('MercadoPagoPointAdapter cancellation is not enabled in this environment.');
  }

  async getPaymentStatus(_paymentId: string): Promise<ProviderPaymentStatus> {
    this.assertConfigured();
    throw new Error('MercadoPagoPointAdapter status polling is not enabled in this environment.');
  }

  async refundPayment(_paymentId: string, _amount?: number): Promise<RefundResult> {
    this.assertConfigured();
    throw new Error('MercadoPagoPointAdapter refunds are not enabled in this environment.');
  }

  private assertConfigured(): void {
    if (!this.config.accessToken || !this.config.webhookUrl) {
      throw new Error(
        'MercadoPagoPointAdapter requires live credentials and a webhook URL. Use MercadoPagoPointEmulatorAdapter for local development.',
      );
    }
  }
}
