import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { bus } from './platform/bus.js';
import type {
  CartUpdatedPayload,
  CartLineDTO,
  PaymentScreenPayload,
  PaymentCompletedPayload,
  TerminalInstructionPayload,
} from '@retail-os/rwp-core';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
  | { kind: 'idle' }
  | { kind: 'cart'; cart: CartUpdatedPayload }
  | { kind: 'payment'; data: PaymentScreenPayload }
  | { kind: 'result'; ok: boolean; amount: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(minorUnits: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(
    minorUnits / 100,
  );
}

function useClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  );
  useEffect(() => {
    const id = setInterval(() =>
      setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })),
      10_000,
    );
    return () => clearInterval(id);
  }, []);
  return time;
}

// ─── Root App ────────────────────────────────────────────────────────────────

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' });
  const [terminalMsg, setTerminalMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saleIdRef = useRef<string | null>(null);

  const log = (msg: string) => setDebug(prev => [...prev.slice(-4), msg]);

  const clear = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  useEffect(() => {
    const onCart = (cart: CartUpdatedPayload) => {
      log(`cart ${cart.saleId.slice(-4)} lines=${cart.lines.length}`);
      const isNewSale = saleIdRef.current !== null && saleIdRef.current !== cart.saleId;
      saleIdRef.current = cart.saleId;

      setScreen(prev => {
        // If it's a brand-new sale starting, always break out of result/payment
        if (isNewSale && cart.lines.length > 0) return { kind: 'cart', cart };
        if (isNewSale && cart.lines.length === 0) { clear(); return { kind: 'idle' }; }
        // Mid-sale: don't override payment or result screens
        if (prev.kind === 'payment' || prev.kind === 'result') return prev;
        return cart.lines.length === 0 ? { kind: 'idle' } : { kind: 'cart', cart };
      });
    };

    log(`bus ready · transport=${typeof window !== 'undefined' && window.rwp ? 'IPC' : 'in-proc'}`);

    const subs = [
      bus.subscribe('rwp.cart.updated',   onCart),
      bus.subscribe('rwp.context.cart',   onCart),

      bus.subscribe('rwp.payment.screen', (data: PaymentScreenPayload) => {
        clear();
        setTerminalMsg(null);
        setScreen({ kind: 'payment', data });
      }),

      bus.subscribe('rwp.terminal.instruction', (p: TerminalInstructionPayload) => {
        setTerminalMsg(p.message);
      }),

      bus.subscribe('rwp.payment.completed', (p: PaymentCompletedPayload) => {
        clear();
        setTerminalMsg(null);
        const ok = p.status === 'approved';
        setScreen({ kind: 'result', ok, amount: fmt(p.amount.minorUnits, p.amount.currency) });
        timerRef.current = setTimeout(() => setScreen({ kind: 'idle' }), ok ? 6000 : 4000);
      }),

      bus.subscribe('rwp.checkout.failed', () => {
        clear();
        setTerminalMsg(null);
        setScreen({ kind: 'result', ok: false, amount: '' });
        timerRef.current = setTimeout(() => setScreen({ kind: 'idle' }), 4000);
      }),

      bus.subscribe('rwp.sale.committed', () => {
        // POS calls newSale() right after commit → rwp.cart.updated fires with new saleId
        // that transition handles resetting the display
      }),
    ];

    return () => { clear(); subs.forEach(off => off()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg text-text select-none overflow-hidden">
      <TopBar />
      <main className="flex-1 min-h-0 relative">
        {screen.kind === 'idle'    && <IdleScreen />}
        {screen.kind === 'cart'    && <CartScreen key={screen.cart.saleId} cart={screen.cart} />}
        {screen.kind === 'payment' && <PaymentScreen key={screen.data.saleId + screen.data.method} data={screen.data} terminalMsg={terminalMsg} />}
        {screen.kind === 'result'  && <ResultScreen ok={screen.ok} amount={screen.amount} />}
        {/* Debug overlay — remove once events are confirmed working */}
        {debug.length > 0 && (
          <div style={{ position:'absolute', bottom:4, left:4, fontSize:9, color:'#00d68f', fontFamily:'monospace', opacity:.7, pointerEvents:'none' }}>
            {debug.map((d, i) => <div key={i}>{d}</div>)}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  const time = useClock();
  return (
    <header className="flex-shrink-0 flex items-center gap-3 px-6 h-11 border-b border-line bg-surface">
      <div className="w-5 h-5 rounded-md bg-accent/15 border border-accent/30 grid place-items-center text-accent font-black text-[9px]">
        ◆
      </div>
      <span className="text-xs font-black tracking-tight text-text">Retail OS</span>
      <span className="text-[10px] font-bold text-muted border-l border-line pl-3 uppercase tracking-widest">
        Pantalla Cliente
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[11px] font-bold text-muted tabular-nums">{time}</span>
      </div>
    </header>
  );
}

// ─── Idle ────────────────────────────────────────────────────────────────────

function IdleScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-12 animate-fade-in">
      {/* Logo mark */}
      <div className="relative animate-float">
        <div className="w-20 h-20 rounded-2xl bg-accent/8 border border-accent/20 grid place-items-center animate-pulse-ring">
          <span className="text-4xl text-accent/60 font-black">◆</span>
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-2 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <h1 className="text-4xl font-black tracking-tight leading-none">Bienvenido</h1>
        <p className="text-muted text-sm font-medium">Escanee o seleccione sus artículos para comenzar</p>
      </div>

      {/* Dots */}
      <div className="flex gap-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <span className="w-2 h-2 rounded-full bg-accent/50 dot-1" />
        <span className="w-2 h-2 rounded-full bg-accent/50 dot-2" />
        <span className="w-2 h-2 rounded-full bg-accent/50 dot-3" />
      </div>
    </div>
  );
}

// ─── Cart ────────────────────────────────────────────────────────────────────

function CartScreen({ cart }: { cart: CartUpdatedPayload }) {
  const { currency } = cart;
  const hasDiscount = cart.discount.minorUnits > 0;

  return (
    <div className="h-full flex min-h-0 animate-fade-in">

      {/* ── Items list ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Items header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-line">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest">Tu compra</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
            {cart.itemCount} {cart.itemCount === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>

        {/* Scrollable items */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 px-4 space-y-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cart.lines.map((line, i) => (
            <LineItem key={line.lineId} line={line} currency={currency} index={i} />
          ))}
        </div>
      </div>

      {/* ── Totals panel ── */}
      <div className="flex-shrink-0 w-64 flex flex-col border-l border-line bg-surface">
        <div className="flex-1 flex flex-col justify-end p-6 gap-3">
          {/* Subtotal */}
          <TotalRow label="Subtotal" value={fmt(cart.subtotal.minorUnits, currency)} />

          {/* Discount */}
          {hasDiscount && (
            <TotalRow
              label="Descuento"
              value={`−${fmt(cart.discount.minorUnits, currency)}`}
              valueClass="text-ok font-bold"
            />
          )}

          {/* Tax */}
          <TotalRow label="IVA (16%)" value={fmt(cart.taxTotal.minorUnits, currency)} />

          {/* Divider */}
          <div className="border-t border-line pt-3 mt-1">
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total</p>
            <p className="text-4xl font-black text-accent tabular-nums leading-none tracking-tight">
              {fmt(cart.grandTotal.minorUnits, currency)}
            </p>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-gradient-to-r from-accent/60 via-accent to-accent/60 flex-shrink-0" />
      </div>
    </div>
  );
}

function LineItem({ line, currency, index }: { line: CartLineDTO; currency: string; index: number }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl bg-panel border border-line/50 animate-slide-in-right"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Qty badge */}
      <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-accent/10 border border-accent/20 grid place-items-center">
        <span className="text-[11px] font-black text-accent leading-none">×{line.quantity}</span>
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate leading-tight">{line.name}</p>
        <p className="text-[11px] text-muted tabular-nums mt-0.5">
          {fmt(line.unitPrice.minorUnits, currency)} c/u
        </p>
      </div>

      {/* Line total */}
      <p className="text-sm font-black text-text tabular-nums flex-shrink-0">
        {fmt(line.lineTotal.minorUnits, currency)}
      </p>
    </div>
  );
}

function TotalRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${valueClass ?? 'text-text'}`}>{value}</span>
    </div>
  );
}

// ─── Payment ─────────────────────────────────────────────────────────────────

function PaymentScreen({ data, terminalMsg }: { data: PaymentScreenPayload; terminalMsg: string | null }) {
  const amount = fmt(data.amount.minorUnits, data.amount.currency);

  if (data.method === 'qr' && data.qrData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-7 p-8 animate-fade-in">
        <div className="text-center animate-slide-up">
          <p className="text-[10px] font-black text-accent/80 uppercase tracking-widest mb-2">Pago con CoDi</p>
          <h2 className="text-2xl font-black text-text">Escanee el código QR</h2>
          <p className="text-sm text-muted mt-1">Abra su app bancaria y apunte la cámara</p>
        </div>

        {/* QR with frame */}
        <div className="animate-scale-in" style={{ animationDelay: '80ms' }}>
          <div className="relative p-2 rounded-2xl bg-white shadow-2xl shadow-black/40">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-accent rounded-tl-xl -translate-x-0.5 -translate-y-0.5" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-accent rounded-tr-xl translate-x-0.5 -translate-y-0.5" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-accent rounded-bl-xl -translate-x-0.5 translate-y-0.5" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-accent rounded-br-xl translate-x-0.5 translate-y-0.5" />
            <QRCodeSVG value={data.qrData} size={200} bgColor="#ffffff" fgColor="#0a0c0b" level="M" />
          </div>
        </div>

        {/* Amount */}
        <div className="text-center animate-slide-up" style={{ animationDelay: '160ms' }}>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total a pagar</p>
          <p className="text-5xl font-black text-accent tabular-nums tracking-tight">{amount}</p>
        </div>

        {/* Waiting indicator */}
        <div key={terminalMsg ?? 'qr-wait'} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-panel border border-line animate-fade-in" style={{ animationDelay: '240ms' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
          <span className="text-[12px] font-semibold text-muted">
            {terminalMsg ?? 'Esperando confirmación bancaria…'}
          </span>
        </div>
      </div>
    );
  }

  if (data.method === 'card_terminal') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-7 p-8 animate-fade-in">
        {/* Card icon */}
        <div className="animate-float">
          <div className="w-28 h-18 rounded-2xl bg-gradient-to-br from-panel-2 to-panel border border-line flex items-center justify-center text-5xl shadow-xl shadow-black/30">
            💳
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center space-y-2 animate-slide-up">
          <p className="text-[10px] font-black text-accent/80 uppercase tracking-widest">Pago con tarjeta</p>
          <h2 className="text-2xl font-black text-text leading-tight">
            Por favor pague<br />en el terminal
          </h2>
          <p className="text-sm text-muted">Inserte, deslice o acerque su tarjeta</p>
        </div>

        {/* Amount */}
        <div className="text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total</p>
          <p className="text-5xl font-black text-accent tabular-nums tracking-tight">{amount}</p>
        </div>

        {/* Live terminal status */}
        <div key={terminalMsg ?? 'default'} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-panel border border-line animate-fade-in" style={{ animationDelay: '160ms' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
          <span className="text-[12px] font-semibold text-text">
            {terminalMsg ?? 'Terminal activo — esperando tarjeta…'}
          </span>
        </div>
      </div>
    );
  }

  // Cash
  return (
    <div className="h-full flex flex-col items-center justify-center gap-7 p-8 animate-fade-in">
      <div className="text-6xl animate-float">💵</div>
      <div className="text-center space-y-2 animate-slide-up">
        <p className="text-[10px] font-black text-accent/80 uppercase tracking-widest">Pago en efectivo</p>
        <h2 className="text-2xl font-black text-text">Entregue al cajero</h2>
        <p className="text-sm text-muted">Su cajero procesará el pago</p>
      </div>
      <div className="text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total</p>
        <p className="text-5xl font-black text-accent tabular-nums tracking-tight">{amount}</p>
      </div>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultScreen({ ok, amount }: { ok: boolean; amount: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 p-8 animate-fade-in">
      {/* Icon */}
      <div className="animate-scale-in">
        <div className={`w-24 h-24 rounded-full grid place-items-center ${ok ? 'bg-ok/15' : 'bg-danger/15'}`}>
          {ok ? (
            <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none">
              <path
                d="M10 26l10 10L38 14"
                stroke="#3fb950"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset="0"
                style={{ animation: 'check-draw .5s .1s cubic-bezier(.16,1,.3,1) both' }}
              />
            </svg>
          ) : (
            <span className="text-5xl font-black text-danger leading-none">✕</span>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="text-center space-y-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h2 className={`text-3xl font-black ${ok ? 'text-ok' : 'text-danger'}`}>
          {ok ? '¡Pago aprobado!' : 'Pago no completado'}
        </h2>
        {ok && amount && (
          <p className="text-5xl font-black text-accent tabular-nums tracking-tight mt-2">{amount}</p>
        )}
        <p className="text-muted text-sm mt-3">
          {ok ? 'Gracias por su compra. ¡Hasta pronto!' : 'Por favor intente con otro método de pago.'}
        </p>
      </div>

      {/* Bottom bar (ok only) */}
      {ok && (
        <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="h-px w-12 bg-line" />
          <span className="text-[11px] text-muted font-semibold">Retail OS</span>
          <div className="h-px w-12 bg-line" />
        </div>
      )}
    </div>
  );
}
