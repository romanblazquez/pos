/**
 * Virtual Mercado Pago Point terminal state machine.
 *
 * Models the physical terminal lifecycle so developers can drive the UI through
 * each state and reproduce edge cases (duplicate webhooks, network errors, PIN
 * required, etc.) without hardware. The machine accepts explicit transitions from
 * the emulator UI or emulator API; automatic timeout transitions are also supported.
 */
export type TerminalState =
  | 'IDLE'
  | 'ORDER_RECEIVED'
  | 'WAITING_FOR_CARD'
  | 'CARD_DETECTED'
  | 'PIN_REQUIRED'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export type CardAction = 'INSERT' | 'TAP' | 'SWIPE';

/** What the emulator feeds back to the payment orchestrator. */
export type TerminalFinalState = Extract<TerminalState, 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'TIMEOUT' | 'NETWORK_ERROR'>;

export const TERMINAL_FINAL_STATES = new Set<TerminalState>([
  'APPROVED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'NETWORK_ERROR',
]);

export interface TerminalEvent {
  type: string;
  at: string;
  detail?: string;
}

export interface TerminalOrder {
  orderId: string;
  terminalId: string;
  saleId: string;
  amount: number;
  currency: string;
  description?: string;
  externalReference?: string;
  state: TerminalState;
  timeline: TerminalEvent[];
  createdAt: string;
  updatedAt: string;
  webhookTarget?: string;
}

const ALLOWED: Partial<Record<TerminalState, TerminalState[]>> = {
  IDLE: ['ORDER_RECEIVED'],
  ORDER_RECEIVED: ['WAITING_FOR_CARD', 'CANCELLED'],
  WAITING_FOR_CARD: ['CARD_DETECTED', 'CANCELLED', 'TIMEOUT'],
  CARD_DETECTED: ['PIN_REQUIRED', 'PROCESSING', 'REJECTED', 'CANCELLED'],
  PIN_REQUIRED: ['PROCESSING', 'REJECTED', 'CANCELLED'],
  PROCESSING: ['APPROVED', 'REJECTED', 'NETWORK_ERROR'],
};

export class VirtualTerminalOrder {
  private _state: TerminalState;
  private readonly _timeline: TerminalEvent[];
  private readonly _order: TerminalOrder;
  readonly listeners = new Set<(order: TerminalOrder) => void>();

  constructor(order: TerminalOrder) {
    this._order = { ...order };
    this._state = order.state;
    this._timeline = [...(order.timeline ?? [])];
  }

  get state(): TerminalState {
    return this._state;
  }

  get isFinal(): boolean {
    return TERMINAL_FINAL_STATES.has(this._state);
  }

  get snapshot(): TerminalOrder {
    return {
      ...this._order,
      state: this._state,
      timeline: [...this._timeline],
      updatedAt: new Date().toISOString(),
    };
  }

  transition(next: TerminalState, detail?: string): boolean {
    const allowed = ALLOWED[this._state];
    if (!allowed || !allowed.includes(next)) return false;
    this._state = next;
    this._timeline.push({ type: next, at: new Date().toISOString(), detail });
    const snap = this.snapshot;
    for (const fn of this.listeners) fn(snap);
    return true;
  }

  forceTransition(next: TerminalState, detail?: string): void {
    this._state = next;
    this._timeline.push({ type: next, at: new Date().toISOString(), detail });
    const snap = this.snapshot;
    for (const fn of this.listeners) fn(snap);
  }
}
