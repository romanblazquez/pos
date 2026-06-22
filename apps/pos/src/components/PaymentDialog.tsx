import { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  formatMoney,
} from '@retail-os/ui-react';
import type { Sale } from '@retail-os/sales';
import {
  checkoutSaga,
  PROVIDERS,
  simulatePaymentCallback,
  type PaymentCallbackStatus,
  type ProviderChoice,
} from '../checkout/checkout-service.js';
import { bus } from '../platform/bus.js';

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
  const [terminalMsg, setTerminalMsg] = useState<string | null>(null);

  useEffect(() => {
    return bus.subscribe('rwp.terminal.instruction', (p) => {
      setTerminalMsg(p.message);
    });
  }, []);

  const total = formatMoney({ minorUnits: sale.grandTotal.minorUnits, currency: sale.currency });
  const itemCount = sale.lines.reduce((sum, line) => sum + line.quantity, 0);

  async function charge() {
    setPhase('processing');
    setActivePayment(null);
    setCallbackSent(null);
    setResult(null);
    if (provider.method === 'cash') {
      bus.publish('rwp.payment.screen', {
        saleId: sale.id,
        provider: 'cash',
        method: 'cash',
        amount: { minorUnits: sale.grandTotal.minorUnits, currency: sale.currency },
      });
    }
    const saga = await checkoutSaga.run({
      sale,
      providerId: provider.id,
      method: provider.method,
      simulate: provider.method === 'cash' ? 'approved' : 'manual',
      onPaymentIntent: (intent) => {
        setActivePayment({ paymentId: intent.paymentId, providerId: intent.provider });
        bus.publish('rwp.payment.screen', {
          saleId: sale.id,
          provider: intent.provider,
          method: provider.method,
          amount: { minorUnits: sale.grandTotal.minorUnits, currency: sale.currency },
          qrData: provider.method === 'qr' ? intent.paymentId : undefined,
        });
      },
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && phase !== 'processing') onClose();
      }}
    >
      <DialogContent
        showCloseButton={phase !== 'processing'}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[480px]"
        onPointerDownOutside={(event) => {
          if (phase === 'processing') event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (phase === 'processing') event.preventDefault();
        }}
      >
        <DialogHeader className="grid grid-cols-[1fr_auto] items-start gap-4 text-left">
          <div>
            <DialogTitle>Cobrar</DialogTitle>
            <DialogDescription className="mt-1">
              {itemCount} artículos · #{sale.id.slice(-6).toUpperCase()}
            </DialogDescription>
          </div>
          <strong className="pr-6 text-2xl leading-none tabular-nums">{total}</strong>
        </DialogHeader>

        {/* ── Step 1: choose provider ─────────────────────────── */}
        {phase === 'choose' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {PROVIDERS.map((p) => (
                <Card
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className={`min-h-24 cursor-pointer gap-1.5 rounded-lg p-4 text-left shadow-none transition ${
                    provider.id === p.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'bg-muted/40 hover:border-primary/40 hover:bg-accent/30'
                  }`}
                  onClick={() => setProvider(p)}
                >
                  <strong className="text-sm">{p.label}</strong>
                  <span className="text-xs text-muted-foreground">{p.hint}</span>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={charge}>Confirmar pago</Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 2: processing ───────────────────────────────── */}
        {phase === 'processing' && (
          <div className="processing">
            {/* Cash */}
            {provider.method === 'cash' && (
              <div className="cash-box">
                <div className="grid size-20 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-4xl font-bold text-primary" aria-hidden>$</div>
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
                {terminalMsg && (
                  <Badge variant="secondary" className="terminal-instruction">
                    <span className="terminal-instruction-dot" />
                    {terminalMsg}
                  </Badge>
                )}
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
                <div className="codi-card">
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
                      <p className="vterm-dev-note">🧪 Simulador — elige resultado:</p>
                      <div className="vterm-action-row" style={{ marginTop: 5 }}>
                        {CODI_CALLBACKS.map((cb) => (
                          <Button
                            key={cb.status}
                            variant={cb.status === 'approved' ? 'default' : cb.status === 'rejected' ? 'destructive' : 'outline'}
                            size="sm"
                            className="text-xs"
                            onClick={() => sendCallback(cb.status)}
                            disabled={Boolean(callbackSent)}
                          >
                            {cb.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {callbackSent && (
                    <div className="codi-actions">
                      <p className="vterm-dev-note">
                        Callback: <strong>{callbackSent}</strong> — esperando respuesta…
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: result ──────────────────────────────────── */}
        {phase === 'done' && result && (
          <div className="grid min-h-52 place-items-center gap-4 py-3 text-center">
            <div className={`grid size-16 place-items-center rounded-full text-3xl font-bold text-white ${
              result.ok ? 'bg-success' : 'bg-destructive'
            }`}>
              {result.ok ? '✓' : '✕'}
            </div>
            <p className="font-medium">{result.message}</p>
            <DialogFooter className="w-full">
              {result.ok ? (
                <Button onClick={onCompleted}>Nueva venta</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onClose}>Volver al carrito</Button>
                  <Button onClick={() => { setPhase('choose'); setCallbackSent(null); }}>
                    Reintentar
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
