import { useState } from 'react';
import { formatMoney } from '@retail-os/ui-react';
import type { Sale } from '@retail-os/sales';
import {
  checkoutSaga,
  PROVIDERS,
  simulatePaymentCallback,
  type PaymentCallbackStatus,
  type ProviderChoice,
} from '../checkout/checkout-service.js';

type Phase = 'choose' | 'processing' | 'done';
type ActivePayment = { paymentId: string; providerId: string };

const TERMINAL_CALLBACKS: Array<{ status: PaymentCallbackStatus; label: string }> = [
  { status: 'approved', label: 'Aprobar' },
  { status: 'rejected', label: 'Rechazar' },
  { status: 'timeout', label: 'Timeout' },
];

const CODI_CALLBACKS: Array<{ status: PaymentCallbackStatus; label: string }> = [
  { status: 'approved', label: 'Aprobar' },
  { status: 'rejected', label: 'Rechazar' },
  { status: 'expired', label: 'Expirar' },
  { status: 'timeout', label: 'Timeout' },
];

/**
 * PaymentDialog — drives a checkout through the CheckoutSaga. The POS only knows
 * "start a payment with provider X"; the saga + orchestrator handle the rest and
 * this dialog reacts to the result. On success the sale is committed + queued for
 * sync; on failure the saga has already compensated and the cart is intact.
 */
export function PaymentDialog({
  sale,
  onClose,
  onCompleted,
}: {
  sale: Sale;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('choose');
  const [provider, setProvider] = useState<ProviderChoice>(PROVIDERS[0]);
  const [activePayment, setActivePayment] = useState<ActivePayment | null>(null);
  const [callbackSent, setCallbackSent] = useState<PaymentCallbackStatus | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const total = formatMoney({ minorUnits: sale.grandTotal.minorUnits, currency: sale.currency });
  const itemCount = sale.lines.reduce((sum, line) => sum + line.quantity, 0);

  async function charge() {
    setPhase('processing');
    setActivePayment(null);
    setCallbackSent(null);
    setResult(null);
    const saga = await checkoutSaga.run({
      sale,
      providerId: provider.id,
      method: provider.method,
      simulate: provider.method === 'cash' ? 'approved' : 'manual',
      onPaymentIntent: (intent) => setActivePayment({ paymentId: intent.paymentId, providerId: intent.provider }),
    });
    if (saga.status === 'completed') {
      setResult({ ok: true, message: `Pago aprobado con ${provider.label}` });
    } else {
      setResult({ ok: false, message: saga.error ?? 'El pago no se completó' });
    }
    setPhase('done');
  }

  function sendCallback(status: PaymentCallbackStatus) {
    if (!activePayment || callbackSent) return;
    const sent = simulatePaymentCallback(activePayment.providerId, activePayment.paymentId, status);
    if (sent) setCallbackSent(status);
  }

  const callbacks = provider.method === 'qr' ? CODI_CALLBACKS : TERMINAL_CALLBACKS;

  return (
    <div className="modal-backdrop" onClick={phase === 'processing' ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="payment-head">
          <div>
            <h2>Cobrar</h2>
            <span>{itemCount} articulos · {sale.id.slice(-8)}</span>
          </div>
          <strong>{total}</strong>
        </header>

        {phase === 'choose' && (
          <>
            <div className="providers">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`provider${provider.id === p.id ? ' active' : ''}`}
                  onClick={() => setProvider(p)}
                >
                  <strong>{p.label}</strong>
                  <span>{p.hint}</span>
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button className="secondary" onClick={onClose}>
                Cancelar
              </button>
              <button className="primary" onClick={charge}>
                Confirmar pago
              </button>
            </div>
          </>
        )}

        {phase === 'processing' && (
          <div className="processing">
            {provider.method === 'cash' ? (
              <div className="cash-box">
                <div className="cash-icon" aria-hidden>$</div>
                <p>Registrando pago en efectivo…</p>
              </div>
            ) : provider.method === 'qr' ? (
              <div className="qr-box">
                <div className="qr-fake" aria-hidden />
                <p>Escanea el QR con tu app bancaria…</p>
              </div>
            ) : (
              <div className="terminal-box">
                <div className="spinner" aria-hidden />
                <p>Inserta o acerca la tarjeta en la terminal…</p>
              </div>
            )}
            {provider.method !== 'cash' && (
              <section className="simulator-panel">
                <div>
                  <strong>Simular callback</strong>
                  <span>
                    {activePayment
                      ? `${activePayment.providerId} · ${activePayment.paymentId.slice(-8)}`
                      : 'Creando intent de pago...'}
                  </span>
                </div>
                <div className="simulator-actions">
                  {callbacks.map((callback) => (
                    <button
                      key={callback.status}
                      onClick={() => sendCallback(callback.status)}
                      disabled={!activePayment || Boolean(callbackSent)}
                    >
                      {callback.label}
                    </button>
                  ))}
                </div>
                <button
                  className="simulator-cancel"
                  onClick={() => sendCallback('cancelled')}
                  disabled={!activePayment || Boolean(callbackSent)}
                >
                  Cancelar cobro
                </button>
                {callbackSent && <p>Callback enviado: {callbackSent}</p>}
              </section>
            )}
          </div>
        )}

        {phase === 'done' && result && (
          <div className={`result ${result.ok ? 'ok' : 'fail'}`}>
            <div className="result-icon">{result.ok ? '✓' : '✕'}</div>
            <p>{result.message}</p>
            <div className="modal-actions">
              {result.ok ? (
                <button className="primary" onClick={onCompleted}>
                  Nueva venta
                </button>
              ) : (
                <>
                  <button className="secondary" onClick={onClose}>
                    Volver al carrito
                  </button>
                  <button className="primary" onClick={() => setPhase('choose')}>
                    Reintentar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
