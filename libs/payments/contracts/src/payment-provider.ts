export type ProviderPaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'refunded';

export interface CreatePaymentIntentInput {
  saleId: string;
  amount: number;
  currency: string;
  description?: string;
  externalReference?: string;
  terminalId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderPaymentIntent {
  paymentId: string;
  provider: string;
  saleId: string;
  amount: number;
  currency: string;
  status: ProviderPaymentStatus;
  orderId?: string;
  terminalId?: string;
  providerRef?: string;
  display?: Record<string, unknown>;
  createdAt: string;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  amount: number;
  status: 'refunded' | 'rejected';
  createdAt: string;
}

export interface PaymentProvider {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent>;
  cancelPayment(paymentId: string): Promise<void>;
  getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
}
