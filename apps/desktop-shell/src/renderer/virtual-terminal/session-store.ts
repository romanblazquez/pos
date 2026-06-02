import type { PaymentRequestedPayload, PaymentStatusChangedPayload } from '@retail-os/rwp-core';
import { shellBus } from '../shell-bus.js';

export interface VirtualTerminalSessionSnapshot {
  sequence: number;
  order: PaymentRequestedPayload | null;
  paymentId: string | null;
  status: string | null;
  updatedAt: string | null;
}

type Listener = (snapshot: VirtualTerminalSessionSnapshot) => void;

const EMPTY_SNAPSHOT: VirtualTerminalSessionSnapshot = {
  sequence: 0,
  order: null,
  paymentId: null,
  status: null,
  updatedAt: null,
};

class VirtualTerminalSessionStore {
  private snapshot = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<Listener>();

  constructor() {
    shellBus.subscribe('rwp.payment.requested', (payload) => {
      if (payload.method !== 'card_terminal') return;
      this.setSnapshot({
        sequence: this.snapshot.sequence + 1,
        order: payload,
        paymentId: null,
        status: 'requested',
        updatedAt: new Date().toISOString(),
      });
    });

    shellBus.subscribe('rwp.payment.statusChanged', (payload) => {
      if (!this.matchesCurrentOrder(payload)) return;
      this.setSnapshot({
        ...this.snapshot,
        paymentId: payload.paymentId,
        status: payload.status,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  getSnapshot(): VirtualTerminalSessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.setSnapshot({
      ...EMPTY_SNAPSHOT,
      sequence: this.snapshot.sequence,
      updatedAt: new Date().toISOString(),
    });
  }

  private matchesCurrentOrder(payload: PaymentStatusChangedPayload): boolean {
    const order = this.snapshot.order;
    return Boolean(order && payload.saleId === order.saleId && payload.provider === order.provider);
  }

  private setSnapshot(next: VirtualTerminalSessionSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
  }
}

export const virtualTerminalSessionStore = new VirtualTerminalSessionStore();
