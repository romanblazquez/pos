import { useState } from 'react';
import { useCart } from './CartContext.js';
import { Button } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? '';

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-[--border] bg-[--bg-input] text-[--tx] ' +
  'placeholder:text-[--tx-faint] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

type Step = 'cart' | 'form' | 'processing' | 'success' | 'error';

export default function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, remove, clear, total } = useCart();
  const [step, setStep] = useState<Step>('cart');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    setStep('processing');
    setError('');
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${API}/api/v1/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
          deliveryAddress: { street, city, state: stateVal, postalCode },
          customerEmail: email,
          customerName: name,
          successUrl: `${baseUrl}/checkout/success`,
          failureUrl: `${baseUrl}/checkout/failure`,
          pendingUrl: `${baseUrl}/checkout/pending`,
        }),
      });
      const data = await res.json() as { orderId?: string; checkoutUrl?: string; message?: string };
      if (!res.ok) { setError(data.message ?? 'Error al iniciar el pago.'); setStep('error'); return; }
      setOrderId(data.orderId ?? '');
      clear();
      if (data.checkoutUrl?.includes('dev_mode=1')) setStep('success');
      else window.location.href = data.checkoutUrl!;
    } catch {
      setError('No se pudo conectar con el servidor.');
      setStep('error');
    }
  }

  const stepTitle = step === 'cart' ? 'Tu carrito' : step === 'form' ? 'Datos de envío' : '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="animate-slide-right relative w-full max-w-md bg-[--bg-raised] h-full shadow-2xl flex flex-col border-l border-[--border]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--border] shrink-0">
          <h2 className="font-bold text-[--tx] text-base">{stepTitle}</h2>
          <button onClick={onClose} className="text-[--tx-faint] hover:text-[--tx] transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'cart' && <CartItems items={items} onRemove={remove} />}

          {step === 'form' && (
            <form id="checkout-form" onSubmit={submitCheckout} className="p-5 flex flex-col gap-4">
              <Field label="Nombre completo">
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan García" className={inputCls} />
              </Field>
              <Field label="Email">
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@ejemplo.com" className={inputCls} />
              </Field>
              <hr className="border-[--border]" />
              <p className="text-xs font-semibold text-[--tx-muted] uppercase tracking-wide">Dirección de envío</p>
              <Field label="Calle y número">
                <input required value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Av. Insurgentes 1234" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ciudad">
                  <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="CDMX" className={inputCls} />
                </Field>
                <Field label="Estado">
                  <input required value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="Ciudad de México" className={inputCls} />
                </Field>
              </div>
              <Field label="Código postal">
                <input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="06600" className={inputCls} />
              </Field>
            </form>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[--tx-muted] text-sm">Iniciando pago seguro…</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-5xl">✅</p>
              <p className="font-bold text-[--tx] text-lg">¡Pedido recibido!</p>
              <p className="text-sm text-[--tx-muted]">
                Pedido <code className="bg-[--bg-subtle] px-1.5 py-0.5 rounded text-xs font-mono">{orderId.slice(-10)}</code> confirmado.
              </p>
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          )}

          {step === 'error' && (
            <div className="p-5 flex flex-col gap-3">
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
              <Button variant="outline" onClick={() => setStep('form')}>← Volver e intentar de nuevo</Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'cart' && items.length > 0 && (
          <div className="px-5 py-4 border-t border-[--border] flex flex-col gap-3 shrink-0">
            <div className="flex justify-between text-sm font-semibold text-[--tx]">
              <span>Total</span>
              <span>{fmt(total, items[0]?.currency)}</span>
            </div>
            <Button className="w-full justify-center py-3" onClick={() => setStep('form')}>
              Continuar con el pago →
            </Button>
          </div>
        )}

        {step === 'form' && (
          <div className="px-5 py-4 border-t border-[--border] flex flex-col gap-2 shrink-0">
            <div className="flex justify-between text-sm font-semibold text-[--tx]">
              <span>Total a pagar</span>
              <span>{fmt(total, items[0]?.currency)}</span>
            </div>
            <Button type="submit" form="checkout-form" className="w-full justify-center py-3">
              Pagar con Mercado Pago 🔒
            </Button>
            <Button variant="ghost" onClick={() => setStep('cart')} className="w-full justify-center text-[--tx-muted]">
              ← Volver al carrito
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartItems({ items, onRemove }: { items: ReturnType<typeof useCart>['items']; onRemove: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[--tx-faint]">
        <p className="text-4xl">🛒</p>
        <p className="text-sm">Tu carrito está vacío</p>
      </div>
    );
  }

  const sellers = [...new Set(items.map((i) => i.sellerName))];

  return (
    <div className="p-5 flex flex-col gap-3">
      {sellers.length > 1 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ Tenés productos de distintas tiendas. Solo podés comprar de una tienda por pedido.
        </div>
      )}
      {items.map((item) => (
        <div key={item.listingId} className="flex gap-3 items-start p-3 rounded-xl border border-[--border] bg-[--bg-raised]">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[--bg-subtle] flex items-center justify-center text-2xl shrink-0">🎲</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-[--tx] truncate">{item.productName}</p>
            <p className="text-xs text-[--tx-muted]">{item.sellerName} · ×{item.quantity}</p>
            <p className="text-sm font-semibold text-[--tx] mt-0.5">{fmt(item.priceMinorUnits * item.quantity, item.currency)}</p>
          </div>
          <button onClick={() => onRemove(item.listingId)} className="text-[--tx-faint] hover:text-red-500 transition-colors text-lg shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[--tx-muted]">{label}</label>
      {children}
    </div>
  );
}
