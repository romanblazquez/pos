import type { RwpEnvelope } from './envelope.js';

/**
 * The typed RWP event catalog. Each entry maps a `type` string to its payload
 * shape; `RwpEventMap` gives end-to-end type-safety to `publish`/`subscribe`.
 * Keep this in sync with `docs/event-catalog.md`.
 */

export interface MoneyDTO {
  minorUnits: number;
  currency: string;
}

// ─── Payments ───────────────────────────────────────────────────────────────
export interface PaymentRequestedPayload {
  saleId: string;
  provider: string;
  method: string;
  amount: MoneyDTO;
}
export interface PaymentStatusChangedPayload {
  saleId: string;
  paymentId: string;
  provider: string;
  status: string;
}
/** The single unified terminal event every provider emits. */
export interface PaymentCompletedPayload {
  saleId: string;
  provider: string;
  amount: MoneyDTO;
  paymentId: string;
  status: 'approved' | 'rejected' | 'cancelled' | 'expired' | 'timeout';
}

// ─── Sales / checkout ─────────────────────────────────────────────────────────
export interface CheckoutStartedPayload {
  saleId: string;
  total: MoneyDTO;
}
export interface SaleCommittedPayload {
  saleId: string;
  total: MoneyDTO;
  lineCount: number;
}
export interface CheckoutFailedPayload {
  saleId: string;
  reason: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────
export interface SyncStatusPayload {
  online: boolean;
  pending: number;
  lastSyncedAt: string | null;
}

export interface RwpEventMap {
  'rwp.payment.requested': PaymentRequestedPayload;
  'rwp.payment.statusChanged': PaymentStatusChangedPayload;
  'rwp.payment.completed': PaymentCompletedPayload;
  'rwp.checkout.started': CheckoutStartedPayload;
  'rwp.checkout.failed': CheckoutFailedPayload;
  'rwp.sale.committed': SaleCommittedPayload;
  'rwp.sync.status': SyncStatusPayload;
}

export type RwpEventType = keyof RwpEventMap;

export type TypedRwpEvent<K extends RwpEventType = RwpEventType> = RwpEnvelope<RwpEventMap[K]> & {
  type: K;
};
