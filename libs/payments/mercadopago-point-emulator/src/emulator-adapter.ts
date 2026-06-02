import { nanoid } from 'nanoid';
import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentIntent,
  ProviderPaymentStatus,
  RefundResult,
} from '@retail-os/payments-contracts';
import {
  VirtualTerminalOrder,
  TERMINAL_FINAL_STATES,
  type TerminalFinalState,
  type TerminalOrder,
} from './terminal-state-machine.js';

type StatusHandler = (status: ProviderPaymentStatus) => void;

/**
 * MercadoPagoPointEmulatorAdapter — implements the same `PaymentProvider` port
 * as the real adapter but routes through in-process virtual terminals instead of
 * a physical device. This is the adapter the POS uses in development mode; the
 * POS code doesn't change between dev and production.
 *
 * Supports two driving modes:
 * - **Auto**: creates a `VirtualTerminalOrder`, transitions through the state
 *   machine on a timer and resolves to a deterministic outcome.
 * - **Manual** (default in UI-driven dev): creates the order and waits; the
 *   emulator UI or API calls `driveOrder(orderId, action)` to advance states,
 *   ultimately calling `approveOrder` / `rejectOrder` / etc.
 */
export interface EmulatorAdapterOptions {
  /** Auto-resolve delay in ms. 0 = manual mode (UI-driven). */
  autoResolveMs?: number;
  defaultTerminalId?: string;
  webhookTarget?: string;
}

export class MercadoPagoPointEmulatorAdapter implements PaymentProvider {
  readonly provider = 'mercadopago-point-emulator';
  private readonly orders = new Map<string, VirtualTerminalOrder>();
  private readonly statusHandlers = new Map<string, Set<StatusHandler>>();
  private readonly autoResolveMs: number;
  private readonly defaultTerminalId: string;
  readonly webhookTarget?: string;

  constructor(opts: EmulatorAdapterOptions = {}) {
    this.autoResolveMs = opts.autoResolveMs ?? 0;
    this.defaultTerminalId = opts.defaultTerminalId ?? 'VTERM-001';
    this.webhookTarget = opts.webhookTarget;
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const paymentId = `mp-emu-${nanoid()}`;
    const terminalId = input.terminalId ?? this.defaultTerminalId;
    const orderData: TerminalOrder = {
      orderId: paymentId,
      terminalId,
      saleId: input.saleId,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      externalReference: input.externalReference ?? input.saleId,
      state: 'IDLE',
      timeline: [{ type: 'ORDER_RECEIVED', at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      webhookTarget: this.webhookTarget,
    };
    const order = new VirtualTerminalOrder({ ...orderData, state: 'ORDER_RECEIVED' });
    this.orders.set(paymentId, order);

    // Wire final-state transitions to emit to status handlers.
    order.listeners.add((snap) => {
      if (TERMINAL_FINAL_STATES.has(snap.state)) {
        const status = this.mapState(snap.state as TerminalFinalState);
        const handlers = this.statusHandlers.get(paymentId);
        handlers?.forEach((h) => h(status));
      }
    });

    if (this.autoResolveMs > 0) {
      // Auto mode: drive the state machine automatically to APPROVED.
      setTimeout(() => order.transition('WAITING_FOR_CARD'), 200);
      setTimeout(() => order.transition('CARD_DETECTED'), this.autoResolveMs * 0.4);
      setTimeout(() => order.transition('PROCESSING'), this.autoResolveMs * 0.7);
      setTimeout(() => order.forceTransition('APPROVED'), this.autoResolveMs);
    }

    return {
      paymentId,
      provider: this.provider,
      saleId: input.saleId,
      amount: input.amount,
      currency: input.currency,
      status: 'processing',
      terminalId,
      providerRef: paymentId,
      display: {
        terminal: terminalId,
        instruction: 'Insert / tap card on virtual terminal',
        emulator: true,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /** Drive a virtual order through a state-machine transition (from emulator UI/API). */
  driveOrder(paymentId: string, action: string): { ok: boolean; state?: string; error?: string } {
    const order = this.orders.get(paymentId);
    if (!order) return { ok: false, error: 'Order not found' };
    const STATE_MAP: Record<string, string> = {
      'insert-card': 'CARD_DETECTED',
      'tap-card': 'CARD_DETECTED',
      'swipe-card': 'CARD_DETECTED',
      'require-pin': 'PIN_REQUIRED',
      'approve': 'APPROVED',
      'reject': 'REJECTED',
      'cancel': 'CANCELLED',
      'timeout': 'TIMEOUT',
      'network-error': 'NETWORK_ERROR',
      'start-processing': 'PROCESSING',
      'waiting-card': 'WAITING_FOR_CARD',
    };
    const next = STATE_MAP[action] as Parameters<typeof order.transition>[0];
    if (!next) return { ok: false, error: `Unknown action: ${action}` };
    const ok = order.transition(next as never, action);
    return { ok, state: order.state, error: ok ? undefined : `Transition to ${next} not allowed from ${order.state}` };
  }

  getOrder(paymentId: string): TerminalOrder | undefined {
    return this.orders.get(paymentId)?.snapshot;
  }

  listOrders(): TerminalOrder[] {
    return [...this.orders.values()].map((o) => o.snapshot);
  }

  async cancelPayment(paymentId: string): Promise<void> {
    const order = this.orders.get(paymentId);
    if (order && !order.isFinal) order.forceTransition('CANCELLED', 'cancel-via-api');
  }

  async getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus> {
    const order = this.orders.get(paymentId);
    if (!order) return 'pending';
    return this.mapState(order.state as TerminalFinalState) ?? 'processing';
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    const order = this.orders.get(paymentId)?.snapshot;
    return {
      refundId: `refund-${nanoid()}`,
      paymentId,
      amount: amount ?? order?.amount ?? 0,
      status: 'refunded',
      createdAt: new Date().toISOString(),
    };
  }

  onStatus(paymentId: string, handler: StatusHandler): () => void {
    let set = this.statusHandlers.get(paymentId);
    if (!set) { set = new Set(); this.statusHandlers.set(paymentId, set); }
    set.add(handler);
    return () => set!.delete(handler);
  }

  private mapState(state: string): ProviderPaymentStatus {
    const map: Record<string, ProviderPaymentStatus> = {
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      TIMEOUT: 'timeout',
      NETWORK_ERROR: 'rejected',
    };
    return map[state] ?? 'processing';
  }
}
