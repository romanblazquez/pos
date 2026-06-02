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

const CODI_CALLBACKS: Array<{ status: PaymentCallbackStatus; label: string }> = [
  { status: 'approved', label: '✅ Aprobar' },
  { status: 'rejected', label: '❌ Rechazar' },
  { status: 'expired', label: '⏱ Expirar QR' },
  { status: 'timeout', label: '⌛ Timeout' },
];

/**
 * PaymentDialog — drives a checkout through the CheckoutSaga.
 *
 * - **Cash**: instant commit, no interaction needed.
 * - **Mercado Pago Point**: the POS raises a `rwp.payment.requested` event and
 *   the SHELL opens the **Virtual Terminal** panel automatically. The dialog
 *   shows a "waiting for terminal" screen and resolves when the saga receives
 *   the `rwp.payment.completed` event triggered by the terminal emulator.
 * - **CoDi**: shows a dynamic QR with manual approve/reject/expire callbacks.
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
      onPaymentIntent: (intent) =>
        setActivePayment({ paymentId: intent.paymentId, providerId: intent.provider }),
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

  return (
    <div className="modal-backdrop" onClick={phase === 'processing' ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="payment-head">
          <div>
            <h2>Cobrar</h2>
            <span>{itemCount} artículos · #{sale.id.slice(-6).toUpperCase()}</span>
          </div>
          <strong>{total}</strong>
        </header>

        {/* ── Step 1: choose provider ─────────────────────────── */}
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
              <button className="secondary" onClick={onClose}>Cancelar</button>
              <button className="primary" onClick={charge}>Confirmar pago</button>
            </div>
          </>
        )}

        {/* ── Step 2: processing ───────────────────────────────── */}
        {phase === 'processing' && (
          <div className="processing">
            {/* Cash */}
            {provider.method === 'cash' && (
              <div className="cash-box">
                <div className="cash-icon" aria-hidden>$</div>
                <p>Registrando pago en efectivo…</p>
              </div>
            )}

            {/* MP Point: the Virtual Terminal panel handles everything */}
            {provider.method === 'card_terminal' && (
              <div className="terminal-waiting">
                <div className="terminal-waiting-icon">🖥️</div>
                <p className="terminal-waiting-title">Terminal abierta en el workspace</p>
                <p className="terminal-waiting-sub">
                  El panel <strong>Terminal Virtual MP</strong> se abrió automáticamente.<br />
                  Usa los controles del terminal para completar el cobro.
                </p>
                {activePayment ? (
                  <div className="terminal-waiting-id">
                    <span className="dot online" />
                    Terminal activa · {activePayment.paymentId.slice(-10).toUpperCase()}
                  </div>
                ) : (
                  <div className="terminal-waiting-id">
                    <span className="dot" /> Iniciando terminal…
                  </div>
                )}
              </div>
            )}

            {/* CoDi: QR inline */}
            {provider.method === 'qr' && (
              <div className="codi-emulator">
                <div className="codi-terminal-header">
                  <span className="codi-brand">CoDi</span>
                  <span className={`vterm-led${activePayment ? ' online' : ''}`} />
                </div>
                <div className="codi-screen">
                  <div className="codi-amount">{total}</div>
                  {activePayment ? (
                    <>
                      <div className="qr-fake" aria-hidden />
                      <p className="codi-instruction">Escanea con tu app bancaria</p>
                      <span className="codi-ref">Ref: {activePayment.paymentId.slice(-10).toUpperCase()}</span>
                    </>
                  ) : (
                    <div className="vterm-hint">Generando QR dinámico…</div>
                  )}
                </div>
                {activePayment && !callbackSent && (
                  <div className="codi-actions">
                    <p className="vterm-dev-note">🧪 Simulador CoDi — elige el resultado:</p>
                    <div className="vterm-action-row">
                      {CODI_CALLBACKS.map((cb) => (
                        <button
                          key={cb.status}
                          className={`vterm-key${cb.status === 'approved' ? ' vterm-key-approve' : cb.status === 'rejected' ? ' vterm-key-danger' : ' vterm-key-cancel'}`}
                          onClick={() => sendCallback(cb.status)}
                          disabled={Boolean(callbackSent)}
                        >
                          {cb.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {callbackSent && (
                  <p className="vterm-hint" style={{ textAlign: 'center', marginTop: 12 }}>
                    Callback enviado: <strong>{callbackSent}</strong> — esperando resultado…
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: result ──────────────────────────────────── */}
        {phase === 'done' && result && (
          <div className={`result ${result.ok ? 'ok' : 'fail'}`}>
            <div className="result-icon">{result.ok ? '✓' : '✕'}</div>
            <p>{result.message}</p>
            <div className="modal-actions">
              {result.ok ? (
                <button className="primary" onClick={onCompleted}>Nueva venta</button>
              ) : (
                <>
                  <button className="secondary" onClick={onClose}>Volver al carrito</button>
                  <button className="primary" onClick={() => { setPhase('choose'); setCallbackSent(null); }}>
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
