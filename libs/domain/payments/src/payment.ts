import { Money, type PaymentId, type SaleId } from '@retail-os/shared-kernel';

/**
 * Payments domain — provider-agnostic value objects shared by the POS, the
 * payment orchestrator and every provider adapter. No provider SDK types leak
 * past this boundary.
 */
export type PaymentMethod = 'card_terminal' | 'qr' | 'cash' | 'transfer';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'refunded';

/** A payment status is final when no further transitions are possible. */
export const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'timeout',
  'refunded',
]);

export function isApproved(status: PaymentStatus): boolean {
  return status === 'approved';
}

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export interface PaymentIntent {
  paymentId: PaymentId;
  saleId: SaleId;
  provider: string;
  method: PaymentMethod;
  amount: Money;
  status: PaymentStatus;
  /** Provider-supplied reference (terminal op id, CoDi QR id, etc.). */
  providerRef?: string;
  /** Opaque provider data the UI may render (QR string, terminal name…). */
  display?: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
}

export interface Refund {
  refundId: string;
  paymentId: PaymentId;
  amount: Money;
  status: 'refunded' | 'rejected';
  createdAt: string;
}
