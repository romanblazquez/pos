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

// ─── Customer Display ─────────────────────────────────────────────────────────

/** Cart line as seen by customer display */
export interface CartLineDTO {
  lineId: string;
  name: string;
  quantity: number;
  unitPrice: MoneyDTO;
  lineTotal: MoneyDTO;
}

/** Published on every cart mutation (add/remove/qty change/discount) */
export interface CartUpdatedPayload {
  saleId: string;
  currency: string;
  lines: CartLineDTO[];
  subtotal: MoneyDTO;    // net before discounts
  discount: MoneyDTO;   // total discount
  taxTotal: MoneyDTO;
  grandTotal: MoneyDTO;
  itemCount: number;
}

/** Published when cashier initiates payment — drives the customer payment screen */
export interface PaymentScreenPayload {
  saleId: string;
  provider: string;      // 'cash' | 'mercadopago_point' | 'codi'
  method: 'cash' | 'card_terminal' | 'qr';
  amount: MoneyDTO;
  qrData?: string;       // for CoDi: the string to QR-encode (paymentId)
}

// ─── Terminal instructions (live status from card terminal) ──────────────────
/** Published by the virtual terminal (and real adapters) on every state change. */
export interface TerminalInstructionPayload {
  saleId: string;
  paymentId: string;
  /** Machine state string, e.g. WAITING_FOR_CARD, PIN_REQUIRED, PROCESSING */
  state: string;
  /** Human-readable message in the cashier's locale */
  message: string;
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
  'rwp.cart.updated': CartUpdatedPayload;
  'rwp.context.cart': CartUpdatedPayload;
  'rwp.payment.screen': PaymentScreenPayload;
  'rwp.terminal.instruction': TerminalInstructionPayload;
}

export type RwpEventType = keyof RwpEventMap;

export type TypedRwpEvent<K extends RwpEventType = RwpEventType> = RwpEnvelope<RwpEventMap[K]> & {
  type: K;
};
