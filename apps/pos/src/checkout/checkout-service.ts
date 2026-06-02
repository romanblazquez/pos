import { PaymentOrchestrator } from '@retail-os/payment-orchestrator';
import { MercadoPagoPointSimulator } from '@retail-os/provider-mercadopago';
import { CoDiSimulator } from '@retail-os/provider-codi';
import type { PaymentStatus } from '@retail-os/payments-domain';
import type { PaymentId } from '@retail-os/shared-kernel';
import { bus } from '../platform/bus.js';
import { dataClient } from '../platform/data-client.js';
import { CashPaymentProvider } from './cash-provider.js';
import { CheckoutSaga } from './checkout-saga.js';

/**
 * Wires the payment orchestrator with the offline simulators and exposes a
 * single {@link CheckoutSaga} instance for the POS.
 *
 * Provider switching: set `VITE_PAYMENT_PROVIDER=mercadopago_point` (real) or
 * leave blank / `simulator` for offline dev. Swapping providers here requires
 * no changes to the POS UI or the CheckoutSaga.
 */
const cashProvider = new CashPaymentProvider();
const mercadoPagoPointSimulator = new MercadoPagoPointSimulator({
  // In manual mode the simulator waits for simulateCallback() — the virtual
  // terminal panel drives the outcome. Set resolveDelayMs > 0 for auto-approve.
  defaultOutcome: 'manual',
});
const coDiSimulator = new CoDiSimulator({ defaultOutcome: 'manual' });

export const orchestrator = new PaymentOrchestrator(bus, [
  cashProvider,
  mercadoPagoPointSimulator,
  coDiSimulator,
]);

export const checkoutSaga = new CheckoutSaga({ orchestrator, bus, data: dataClient });

export interface ProviderChoice {
  id: string;
  label: string;
  method: 'cash' | 'card_terminal' | 'qr';
  hint: string;
}

export const PROVIDERS: ProviderChoice[] = [
  { id: 'cash', label: 'Efectivo', method: 'cash', hint: 'Tender local' },
  { id: 'mercadopago_point', label: 'Mercado Pago Point', method: 'card_terminal', hint: 'Terminal de tarjeta' },
  { id: 'codi', label: 'CoDi', method: 'qr', hint: 'Pago con QR' },
];

export type PaymentCallbackStatus = Extract<
  PaymentStatus,
  'approved' | 'rejected' | 'timeout' | 'cancelled' | 'expired'
>;

interface SimulatedCallbackProvider {
  simulateCallback(paymentId: PaymentId, status: PaymentCallbackStatus): boolean;
}

const simulatorCallbacks: Record<string, SimulatedCallbackProvider> = {
  mercadopago_point: mercadoPagoPointSimulator as SimulatedCallbackProvider,
  codi: coDiSimulator as SimulatedCallbackProvider,
};

/**
 * Called by the virtual terminal emulator (or any external actor) to resolve a
 * pending simulated payment. The bus also accepts the
 * `pos.simulator.finalizePayment` RWP command so the shell's Virtual Terminal
 * panel can trigger this cross-window without direct import coupling.
 */
export function simulatePaymentCallback(
  providerId: string,
  paymentId: string,
  status: PaymentCallbackStatus,
): boolean {
  if (status === 'expired' && providerId !== 'codi') return false;
  return simulatorCallbacks[providerId]?.simulateCallback(paymentId as PaymentId, status) ?? false;
}

// Register the RWP command handler so the shell Virtual Terminal panel can
// trigger the simulator from a different window.
bus.onCommand('pos.simulator.finalizePayment', (payload) => {
  simulatePaymentCallback(
    payload.providerId,
    payload.paymentId,
    payload.status as PaymentCallbackStatus,
  );
});
