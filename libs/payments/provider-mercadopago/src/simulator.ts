import { newId, type Money, type PaymentId } from '@retail-os/shared-kernel';
import type { PaymentIntent, PaymentStatus, PaymentMethod, Refund } from '@retail-os/payments-domain';
import type { IPaymentProvider, CreatePaymentIntentRequest } from '@retail-os/payment-orchestrator';

export type SimulatedOutcome = 'approved' | 'rejected' | 'timeout' | 'cancelled' | 'manual';

interface PendingPayment {
  intent: PaymentIntent;
  status: PaymentStatus;
  listeners: Set<(status: PaymentStatus) => void>;
  timer?: ReturnType<typeof setTimeout>;
}

export interface MercadoPagoPointSimulatorOptions {
  /** Default terminal outcome when a request doesn't force one via metadata. */
  defaultOutcome?: SimulatedOutcome;
  /** Milliseconds before the simulated terminal resolves. */
  resolveDelayMs?: number;
  terminalName?: string;
}

/**
 * MercadoPagoPointSimulator — a deterministic, fully-offline stand-in for a
 * Mercado Pago Point smart terminal. It mimics the real adapter's lifecycle
 * (assign terminal → create payment → poll status) so the POS, orchestrator and
 * CheckoutSaga can be developed and demoed without hardware or network.
 *
 * Force an outcome per payment via `metadata.simulate`:
 *   'approved' | 'rejected' | 'timeout' | 'cancelled'
 */
export class MercadoPagoPointSimulator implements IPaymentProvider {
  readonly id = 'mercadopago_point';
  readonly supportedMethods: ReadonlyArray<PaymentMethod> = ['card_terminal'];

  private readonly payments = new Map<string, PendingPayment>();
  private readonly delay: number;
  private readonly defaultOutcome: SimulatedOutcome;
  private readonly terminalName: string;

  constructor(opts: MercadoPagoPointSimulatorOptions = {}) {
    this.delay = opts.resolveDelayMs ?? 1500;
    this.defaultOutcome = opts.defaultOutcome ?? 'approved';
    this.terminalName = opts.terminalName ?? 'POINT-SIM-001';
  }

  async createPaymentIntent(req: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    const paymentId = newId<'PaymentId'>();
    const outcome = (req.metadata?.simulate as SimulatedOutcome) ?? this.defaultOutcome;
    const intent: PaymentIntent = {
      paymentId,
      saleId: req.saleId,
      provider: this.id,
      method: 'card_terminal',
      amount: req.amount,
      status: 'processing',
      providerRef: `mp-${paymentId}`,
      display: { terminal: this.terminalName, instruction: 'Insert / tap card on terminal' },
      createdAt: new Date().toISOString(),
    };
    const pending: PendingPayment = { intent, status: 'processing', listeners: new Set() };
    this.payments.set(paymentId, pending);

    // Simulate the terminal resolving after a delay unless the UI will drive
    // the callback manually.
    if (outcome !== 'manual') {
      pending.timer = setTimeout(() => {
        const finalStatus: PaymentStatus = outcome === 'approved' ? 'approved' : outcome;
        this.transition(paymentId, finalStatus);
      }, this.delay);
    }

    return intent;
  }

  simulateCallback(paymentId: PaymentId, status: Exclude<SimulatedOutcome, 'manual'>): boolean {
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
    const refundAmount = amount ?? pending?.intent.amount;
    return {
      refundId: newId<'PaymentId'>(),
      paymentId,
      amount: refundAmount!,
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
