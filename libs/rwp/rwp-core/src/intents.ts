import type { MoneyDTO } from './events.js';

/**
 * RWP intents — verbs an app asks the workspace to fulfil ("start a payment",
 * "open the customer picker"). Intents differ from events: they are directed,
 * may be resolved by a chooser, and usually expect a response.
 */
export interface RwpIntentMap {
  'StartPayment': { saleId: string; provider: string; method: string; amount: MoneyDTO };
  'ViewCustomer': { customerId: string };
  'AddToCart': { productId: string; quantity?: number };
  'PrintReceipt': { saleId: string };
}

export type RwpIntentName = keyof RwpIntentMap;

/** Commands are fire-and-forget imperatives addressed to a specific handler. */
export interface RwpCommandMap {
  'pos.clearCart': Record<string, never>;
  'pos.focusSearch': Record<string, never>;
  'shell.openApp': { appId: string };
  /** Virtual terminal emulator → POS: finalize a simulated payment with the given outcome. */
  'pos.simulator.finalizePayment': { paymentId: string; providerId: string; status: string };
}

export type RwpCommandName = keyof RwpCommandMap;
