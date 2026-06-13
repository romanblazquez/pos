import { useState, useEffect, useRef } from 'react';
import { shellBus } from '../shell-bus.js';
import type { PaymentRequestedPayload } from '@retail-os/rwp-core';
import { virtualTerminalSessionStore } from './session-store.js';

const STATE_INSTRUCTIONS: Record<string, string> = {
  ORDER_RECEIVED:  'Orden recibida — iniciando terminal…',
  WAITING_FOR_CARD:'Acerca o inserta tu tarjeta',
  CARD_DETECTED:   'Tarjeta detectada',
  PIN_REQUIRED:    'Ingresa tu NIP',
  PROCESSING:      'Procesando — no retires la tarjeta',
  APPROVED:        'Pago aprobado',
  REJECTED:        'Pago rechazado',
  CANCELLED:       'Operación cancelada',
  TIMEOUT:         'Tiempo agotado',
  NETWORK_ERROR:   'Error de red — intenta de nuevo',
};

type TerminalUIState =
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

type CardAction = 'INSERT' | 'TAP' | 'SWIPE';
type FinalStatus = 'approved' | 'rejected' | 'cancelled' | 'timeout';

const STATE_LABELS: Record<TerminalUIState, string> = {
  IDLE: 'En espera',
  ORDER_RECEIVED: 'Orden recibida',
  WAITING_FOR_CARD: 'Esperando tarjeta…',
  CARD_DETECTED: 'Tarjeta detectada',
  PIN_REQUIRED: 'Ingresa tu NIP',
  PROCESSING: 'Procesando…',
  APPROVED: 'Pago aprobado ✓',
  REJECTED: 'Pago rechazado',
  CANCELLED: 'Cancelado',
  TIMEOUT: 'Tiempo agotado',
  NETWORK_ERROR: 'Error de red',
};

interface TimelineRow {
  label: string;
  at: string;
}

function now() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtAmount(minorUnits: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(minorUnits / 100);
}

/**
 * VirtualTerminalPanel — a Dockview panel in the shell that acts as a virtual
 * Mercado Pago Point terminal.
 *
 * Lifecycle:
 *  1. Subscribes to `rwp.payment.requested` from the POS via the shell RWP bus.
 *  2. Shows an incoming-order animation, then transitions to WAITING_FOR_CARD.
 *  3. Developer drives the physical-terminal lifecycle step-by-step.
 *  4. On final outcome, publishes `pos.simulator.finalizePayment` command back
 *     to the POS, which resolves the pending CheckoutSaga.
 *
 * The POS is always unaware of this panel's existence — it only sees the
 * `rwp.payment.completed` event emitted after the command is handled.
 */
export function VirtualTerminalPanel() {
  const [session, setSession] = useState(() => virtualTerminalSessionStore.getSnapshot());
  const [state, setState] = useState<TerminalUIState>('IDLE');
  const [order, setOrder] = useState<PaymentRequestedPayload | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [cardAction, setCardAction] = useState<CardAction | null>(null);
  const [pinDigits, setPinDigits] = useState('');
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [resolved, setResolved] = useState(false);
  const lastSequenceRef = useRef(0);
  const processingSeenRef = useRef(false);

  useEffect(() => {
    return virtualTerminalSessionStore.subscribe(setSession);
  }, []);

  useEffect(() => {
    if (!session.order) return;

    if (session.sequence !== lastSequenceRef.current) {
      lastSequenceRef.current = session.sequence;
      processingSeenRef.current = Boolean(session.paymentId);
      setOrder(session.order);
      setPaymentId(session.paymentId);
      setCardAction(null);
      setPinDigits('');
      setResolved(false);
      setTimeline([
        { label: 'Orden recibida del POS', at: now() },
        ...(session.paymentId ? [{ label: STATE_LABELS.WAITING_FOR_CARD, at: now() }] : []),
      ]);
      const initState: TerminalUIState = session.paymentId ? 'WAITING_FOR_CARD' : 'ORDER_RECEIVED';
      setState(initState);
      if (session.paymentId) {
        shellBus.publish('rwp.terminal.instruction', {
          saleId: session.order.saleId,
          paymentId: session.paymentId,
          state: 'WAITING_FOR_CARD',
          message: STATE_INSTRUCTIONS.WAITING_FOR_CARD,
        });
      }
      return;
    }

    if (session.paymentId && session.paymentId !== paymentId) {
      setPaymentId(session.paymentId);
    }

    if (session.paymentId && !processingSeenRef.current) {
      processingSeenRef.current = true;
      if (state === 'ORDER_RECEIVED') push('WAITING_FOR_CARD', session.order, session.paymentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, paymentId, state]);

  function push(next: TerminalUIState, currentOrder = order, currentPaymentId = paymentId) {
    setState(next);
    setTimeline((prev) => [...prev, { label: STATE_LABELS[next], at: now() }]);
    if (currentOrder && currentPaymentId) {
      shellBus.publish('rwp.terminal.instruction', {
        saleId: currentOrder.saleId,
        paymentId: currentPaymentId,
        state: next,
        message: STATE_INSTRUCTIONS[next] ?? STATE_LABELS[next],
      });
    }
  }

  function doCard(action: CardAction) {
    setCardAction(action);
    push('CARD_DETECTED');
  }

  function doProcess() {
    push('PROCESSING');
  }

  function finalize(terminalState: TerminalUIState, status: FinalStatus) {
    if (resolved || !paymentId || !order) return;
    setResolved(true);
    push(terminalState);
    shellBus.sendCommand('pos.simulator.finalizePayment', {
      paymentId,
      providerId: order.provider,
      status,
    }, 'app:pos');
  }

  function reset() {
    virtualTerminalSessionStore.clear();
    setState('IDLE');
    setOrder(null);
    setPaymentId(null);
    setTimeline([]);
    setResolved(false);
    setCardAction(null);
    setPinDigits('');
  }

  const isFinalState = ['APPROVED','REJECTED','CANCELLED','TIMEOUT','NETWORK_ERROR'].includes(state);

  return (
    <div className="vt-panel">
      {/* ─── Terminal device shell ─── */}
      <div className={`vt-device${isFinalState ? ` vt-${state.toLowerCase()}` : ''}`}>
        {/* Header */}
        <div className="vt-device-header">
          <div className="vt-device-brand">
            <span className="vt-logo-dot" />
            <strong>Mercado Pago</strong>
            <span className="vt-model-badge">Point Emulator</span>
          </div>
          <div className="vt-led-cluster">
            <span className={`vt-led${state !== 'IDLE' ? ' active' : ''}`} />
            <span className="vt-led-label">{state !== 'IDLE' ? 'ACTIVO' : 'EN ESPERA'}</span>
          </div>
        </div>

        {/* Screen */}
        <div className="vt-screen">
          {state === 'IDLE' && (
            <div className="vt-screen-idle">
              <div className="vt-idle-icon">📡</div>
              <p>Esperando orden del POS…</p>
              <span className="vt-idle-hint">El terminal se activará automáticamente cuando el cajero inicie un cobro con Mercado Pago Point</span>
            </div>
          )}

          {state === 'ORDER_RECEIVED' && order && (
            <div className="vt-screen-incoming">
              <div className="vt-incoming-pulse" />
              <p className="vt-incoming-label">¡Nueva orden recibida!</p>
              <div className="vt-order-amount">{fmtAmount(order.amount.minorUnits, order.amount.currency)}</div>
              <div className="vt-order-ref">Venta: {order.saleId.slice(-8).toUpperCase()}</div>
            </div>
          )}

          {(state === 'WAITING_FOR_CARD') && order && (
            <>
              <div className="vt-screen-amount">{fmtAmount(order.amount.minorUnits, order.amount.currency)}</div>
              <div className="vt-screen-ref">#{order.saleId.slice(-8).toUpperCase()}</div>
              <div className="vt-screen-instruction">Acerca o inserta tu tarjeta</div>
              <div className="vt-card-anim">
                <span className="vt-ripple" />
                <span className="vt-ripple" />
                <span className="vt-ripple" />
                <span className="vt-card-icon">💳</span>
              </div>
            </>
          )}

          {state === 'CARD_DETECTED' && (
            <>
              <div className="vt-status-badge ok">✔ Tarjeta detectada</div>
              {cardAction && (
                <div className="vt-card-type-badge">
                  {cardAction === 'TAP' ? '📡 Sin contacto' : cardAction === 'SWIPE' ? '↔ Banda magnética' : '⬆ Chip EMV'}
                </div>
              )}
              <div className="vt-screen-instruction">Confirmar transacción</div>
            </>
          )}

          {state === 'PIN_REQUIRED' && (
            <div className="vt-pin-area">
              <div className="vt-pin-label">Ingresa tu NIP de 4 dígitos</div>
              <div className="vt-pin-dots">
                {[0,1,2,3].map((i) => (
                  <span key={i} className={`vt-pin-dot${i < pinDigits.length ? ' filled' : ''}`} />
                ))}
              </div>
            </div>
          )}

          {state === 'PROCESSING' && (
            <div className="vt-processing-area">
              <div className="vt-spinner" />
              <p>Procesando pago…</p>
              <p className="vt-processing-sub">No retires la tarjeta</p>
            </div>
          )}

          {isFinalState && (
            <div className={`vt-final-area vt-final-${state.toLowerCase()}`}>
              <div className="vt-final-icon">
                {state === 'APPROVED' ? '✓' : state === 'REJECTED' ? '✕' : '⚠'}
              </div>
              <p>{STATE_LABELS[state]}</p>
              {order && state === 'APPROVED' && (
                <div className="vt-final-amount">{fmtAmount(order.amount.minorUnits, order.amount.currency)}</div>
              )}
            </div>
          )}
        </div>

        {/* Keypad */}
        {!resolved && (
          <div className="vt-keypad">
            {state === 'ORDER_RECEIVED' && (
              <button className="vt-btn vt-btn-full vt-btn-confirm" onClick={() => push('WAITING_FOR_CARD')}>
                Iniciar cobro
              </button>
            )}

            {state === 'WAITING_FOR_CARD' && (
              <>
                <div className="vt-btn-row">
                  <button className="vt-btn vt-btn-primary" onClick={() => doCard('TAP')}>📡 Acercar</button>
                  <button className="vt-btn vt-btn-primary" onClick={() => doCard('INSERT')}>⬆ Chip</button>
                </div>
                <button className="vt-btn vt-btn-wide" onClick={() => doCard('SWIPE')}>↔ Deslizar banda</button>
                <button className="vt-btn vt-btn-cancel" onClick={() => finalize('CANCELLED', 'cancelled')}>
                  Cancelar
                </button>
              </>
            )}

            {state === 'CARD_DETECTED' && (
              <>
                <div className="vt-btn-row">
                  <button className="vt-btn vt-btn-primary" onClick={() => push('PIN_REQUIRED')}>🔢 Requiere NIP</button>
                  <button className="vt-btn vt-btn-confirm" onClick={doProcess}>▶ Procesar</button>
                </div>
                <div className="vt-btn-row">
                  <button className="vt-btn vt-btn-danger" onClick={() => finalize('REJECTED', 'rejected')}>✕ Rechazar</button>
                  <button className="vt-btn vt-btn-cancel" onClick={() => finalize('CANCELLED', 'cancelled')}>Cancelar</button>
                </div>
              </>
            )}

            {state === 'PIN_REQUIRED' && (
              <>
                <div className="vt-numpad">
                  {['1','2','3','4','5','6','7','8','9','←','0','✓'].map((k) => (
                    <button key={k}
                      className={`vt-numpad-key${k==='✓' ? ' ok' : k==='←' ? ' del' : ''}`}
                      onClick={() => {
                        if (k === '←') { setPinDigits((d) => d.slice(0,-1)); return; }
                        if (k === '✓') { if (pinDigits.length >= 4) doProcess(); return; }
                        if (pinDigits.length < 4) setPinDigits((d) => d + k);
                      }}>
                      {k}
                    </button>
                  ))}
                </div>
                <button className="vt-btn vt-btn-cancel" onClick={() => finalize('CANCELLED', 'cancelled')}>Cancelar</button>
              </>
            )}

            {state === 'PROCESSING' && (
              <>
                <div className="vt-btn-row">
                  <button className="vt-btn vt-btn-approve" onClick={() => finalize('APPROVED', 'approved')}>✓ Aprobar</button>
                  <button className="vt-btn vt-btn-danger" onClick={() => finalize('REJECTED', 'rejected')}>✕ Rechazar</button>
                </div>
                <div className="vt-btn-row">
                  <button className="vt-btn vt-btn-cancel" onClick={() => finalize('TIMEOUT', 'timeout')}>⏱ Timeout</button>
                  <button className="vt-btn vt-btn-cancel" onClick={() => finalize('NETWORK_ERROR', 'rejected')}>📡 Error red</button>
                </div>
              </>
            )}
          </div>
        )}

        {isFinalState && (
          <div className="vt-keypad">
            <button className="vt-btn vt-btn-full" onClick={reset}>Nueva operación</button>
          </div>
        )}
      </div>

      {/* Timeline sidebar */}
      <div className="vt-timeline-panel">
        <div className="vt-tl-header">Terminal ID: POINT-SIM-001</div>
        {timeline.length === 0 ? (
          <p className="vt-tl-empty">Sin actividad</p>
        ) : (
          timeline.map((row, i) => (
            <div key={i} className={`vt-tl-row${i === timeline.length - 1 ? ' current' : ' done'}`}>
              <span className="vt-tl-dot" />
              <div className="vt-tl-content">
                <span>{row.label}</span>
                <span className="vt-tl-time">{row.at}</span>
              </div>
            </div>
          ))
        )}
        <div className="vt-tl-footer">
          <span className="vt-dev-badge">🧪 Dev Mode</span>
          <span>Emulador local — sin red</span>
        </div>
      </div>
    </div>
  );
}
