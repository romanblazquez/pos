import { newId, type Money, type PaymentId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, PaymentMethod, Refund } from '@retail-os/payments-domain';
import type { IPaymentProvider, CreatePaymentIntentRequest } from '@retail-os/payment-orchestrator';

export type CoDiSimulatedOutcome = 'approved' | 'rejected' | 'timeout' | 'expired' | 'cancelled' | 'manual';

interface PendingPayment {
  intent: PaymentIntent;
  status: PaymentStatus;
  listeners: Set<(status: PaymentStatus) => void>;
  timer?: ReturnType<typeof setTimeout>;
}

export interface CoDiSimulatorOptions {
  defaultOutcome?: CoDiSimulatedOutcome;
  resolveDelayMs?: number;
  /** Seconds until the dynamic QR expires (CoDi default is short-lived). */
  expirySeconds?: number;
}

/**
 * CoDiSimulator — offline stand-in for Banxico's CoDi dynamic-QR payments.
 *
 * Generates a (fake) dynamic QR payload the POS can render, then resolves to a
 * terminal status after a delay, emulating the payer scanning and confirming in
 * their banking app. Supports Approved / Rejected / Timeout / Expired. Force an
 * outcome via `metadata.simulate`.
 */
export class CoDiSimulator implements IPaymentProvider {
  readonly id = 'codi';
  readonly supportedMethods: ReadonlyArray<PaymentMethod> = ['qr'];

  private readonly payments = new Map<string, PendingPayment>();
  private readonly delay: number;
  private readonly defaultOutcome: CoDiSimulatedOutcome;
  private readonly expirySeconds: number;

  constructor(opts: CoDiSimulatorOptions = {}) {
    this.delay = opts.resolveDelayMs ?? 1800;
    this.defaultOutcome = opts.defaultOutcome ?? 'approved';
    this.expirySeconds = opts.expirySeconds ?? 120;
  }

  async createPaymentIntent(req: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    const paymentId = newId<'PaymentId'>();
    const outcome = (req.metadata?.simulate as CoDiSimulatedOutcome) ?? this.defaultOutcome;
    const now = Date.now();
    // A fake but realistically-shaped CoDi dynamic QR payload.
    const qrPayload = JSON.stringify({
      v: 1,
      t: 'codi',
      ref: `CODI-${paymentId}`,
      amt: req.amount.toDecimal(),
      cur: req.amount.currency,
      exp: new Date(now + this.expirySeconds * 1000).toISOString(),
    });

    const intent: PaymentIntent = {
      paymentId,
      saleId: req.saleId,
      provider: this.id,
      method: 'qr',
      amount: req.amount,
      status: 'processing',
      providerRef: `codi-${paymentId}`,
      display: { qr: qrPayload, instruction: 'Scan the QR with your banking app' },
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.expirySeconds * 1000).toISOString(),
    };
    const pending: PendingPayment = { intent, status: 'processing', listeners: new Set() };
    this.payments.set(paymentId, pending);

    if (outcome !== 'manual') {
      pending.timer = setTimeout(() => {
        const finalStatus: PaymentStatus = outcome === 'approved' ? 'approved' : outcome;
        this.transition(paymentId, finalStatus);
      }, this.delay);
    }

    return intent;
  }

  simulateCallback(paymentId: PaymentId, status: Exclude<CoDiSimulatedOutcome, 'manual'>): boolean {
    const pending = this.payments.get(paymentId);
    if (!pending) return false;
    if (pending.timer) clearTimeout(pending.timer);
    this.transition(paymentId, status);
    return true;
  }

  private transition(paymentId: string, status: PaymentStatus): void {
    const pending = this.payments.get(paymentId);
    if (!pending) return;
    pending.status = status;
    for (const listener of pending.listeners) listener(status);
  }

  async cancelPayment(paymentId: PaymentId): Promise<void> {
    const pending = this.payments.get(paymentId);
    if (pending?.timer) clearTimeout(pending.timer);
    this.transition(paymentId, 'cancelled');
  }

  async refundPayment(paymentId: PaymentId, amount?: Money): Promise<Refund> {
    const pending = this.payments.get(paymentId);
    return {
      refundId: newId<'PaymentId'>(),
      paymentId,
      amount: amount ?? pending!.intent.amount,
      status: 'refunded',
      createdAt: new Date().toISOString(),
    };
  }

  async getPaymentStatus(paymentId: PaymentId): Promise<PaymentStatus> {
    return this.payments.get(paymentId)?.status ?? 'pending';
  }

  onStatus(paymentId: PaymentId, handler: (status: PaymentStatus) => void): () => void {
    const pending = this.payments.get(paymentId);
    if (!pending) return () => undefined;
    pending.listeners.add(handler);
    return () => pending.listeners.delete(handler);
  }
}
