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
 * single {@link CheckoutSaga} instance for the POS. Swapping a simulator for a
 * live adapter (MercadoPagoPointAdapter / CoDiProvider) is a registry change
 * here — no POS or saga code changes.
 */
const cashProvider = new CashPaymentProvider();
const mercadoPagoPointSimulator = new MercadoPagoPointSimulator({ resolveDelayMs: 1400 });
const coDiSimulator = new CoDiSimulator({ resolveDelayMs: 1700 });

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

export type PaymentCallbackStatus = Extract<PaymentStatus, 'approved' | 'rejected' | 'timeout' | 'cancelled' | 'expired'>;

interface SimulatedCallbackProvider {
  simulateCallback(paymentId: PaymentId, status: PaymentCallbackStatus): boolean;
}

const simulatorCallbacks: Record<string, SimulatedCallbackProvider> = {
  mercadopago_point: mercadoPagoPointSimulator as SimulatedCallbackProvider,
  codi: coDiSimulator as SimulatedCallbackProvider,
};

export function simulatePaymentCallback(providerId: string, paymentId: string, status: PaymentCallbackStatus): boolean {
  if (status === 'expired' && providerId !== 'codi') return false;
  return simulatorCallbacks[providerId]?.simulateCallback(paymentId as PaymentId, status) ?? false;
}
