import { useState } from 'react';
import { useCart } from './CartContext.js';

const API = import.meta.env.VITE_API_URL ?? '';

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(minor / 100);
}

interface Props {
  onClose: () => void;
}

type Step = 'cart' | 'form' | 'processing' | 'success' | 'error';

export default function CartDrawer({ onClose }: Props) {
  const { items, remove, clear, total } = useCart();
  const [step, setStep] = useState<Step>('cart');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
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
          deliveryAddress: { street, city, state, postalCode },
          customerEmail: email,
          customerName: name,
          successUrl: `${baseUrl}/checkout/success`,
          failureUrl: `${baseUrl}/checkout/failure`,
          pendingUrl: `${baseUrl}/checkout/pending`,
        }),
      });

      const data = await res.json() as {
        orderId?: string;
        checkoutUrl?: string;
        message?: string;
      };

      if (!res.ok) {
        setError(data.message ?? 'Error al iniciar el pago.');
        setStep('error');
        return;
      }

      setOrderId(data.orderId ?? '');
      clear();

      // In dev mode the checkoutUrl is back to successUrl — just show success
      if (data.checkoutUrl?.includes('dev_mode=1')) {
        setStep('success');
      } else {
        // Redirect to MercadoPago Checkout Pro
        window.location.href = data.checkoutUrl!;
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="font-bold text-stone-900 text-lg">
            {step === 'cart' ? 'Tu carrito' : step === 'form' ? 'Datos de envío' : ''}
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'cart' && (
            <CartStep items={items} onRemove={remove} total={total} onNext={() => setStep('form')} />
          )}
          {step === 'form' && (
            <form id="checkout-form" onSubmit={submitCheckout} className="p-5 space-y-4">
              <Field label="Nombre completo">
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Juan García" className={cls} />
              </Field>
              <Field label="Email">
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@ejemplo.com" className={cls} />
              </Field>
              <hr className="border-stone-200" />
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Dirección de envío</p>
              <Field label="Calle y número">
                <input required value={street} onChange={(e) => setStreet(e.target.value)}
                  placeholder="Av. Insurgentes 1234" className={cls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ciudad">
                  <input required value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="CDMX" className={cls} />
                </Field>
                <Field label="Estado">
                  <input required value={state} onChange={(e) => setState(e.target.value)}
                    placeholder="Ciudad de México" className={cls} />
                </Field>
              </div>
              <Field label="Código postal">
                <input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="06600" className={cls} />
              </Field>
            </form>
          )}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-600 text-sm">Iniciando pago seguro...</p>
            </div>
          )}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
              <p className="text-5xl">✅</p>
              <p className="font-bold text-stone-900">¡Pedido recibido!</p>
              <p className="text-sm text-stone-500">
                Tu pedido <code className="bg-stone-100 px-1 rounded text-xs">{orderId}</code> está
                confirmado. Recibirás un email con los detalles.
              </p>
              <button onClick={onClose}
                className="mt-2 px-5 py-2 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-800">
                Cerrar
              </button>
            </div>
          )}
          {step === 'error' && (
            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
              <button
                onClick={() => setStep('form')}
                className="w-full py-2.5 border border-stone-300 rounded-lg text-sm text-stone-700 hover:bg-stone-50"
              >
                ← Volver e intentar de nuevo
              </button>
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        {step === 'cart' && items.length > 0 && (
          <div className="px-5 py-4 border-t border-stone-200">
            <div className="flex justify-between text-sm font-semibold text-stone-900 mb-3">
              <span>Total</span>
              <span>{fmt(total, items[0]?.currency)}</span>
            </div>
            <button
              onClick={() => setStep('form')}
              className="w-full py-3 bg-emerald-700 text-white font-semibold rounded-xl hover:bg-emerald-800"
            >
              Continuar con el pago →
            </button>
          </div>
        )}
        {step === 'form' && (
          <div className="px-5 py-4 border-t border-stone-200 space-y-2">
            <div className="flex justify-between text-sm font-semibold text-stone-900 mb-1">
              <span>Total a pagar</span>
              <span>{fmt(total, items[0]?.currency)}</span>
            </div>
            <button
              type="submit"
              form="checkout-form"
              className="w-full py-3 bg-emerald-700 text-white font-semibold rounded-xl hover:bg-emerald-800"
            >
              Pagar con Mercado Pago 🔒
            </button>
            <button
              onClick={() => setStep('cart')}
              className="w-full py-2 text-sm text-stone-500 hover:text-stone-700"
            >
              ← Volver al carrito
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartStep({
  items,
  onRemove,
  total,
  onNext,
}: {
  items: ReturnType<typeof useCart>['items'];
  onRemove: (id: string) => void;
  total: number;
  onNext: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400">
        <p className="text-4xl mb-3">🛒</p>
        <p className="text-sm">Tu carrito está vacío</p>
      </div>
    );
  }

  // Warn if mixed sellers (checkout will reject)
  const sellers = [...new Set(items.map((i) => i.sellerName))];
  const mixedSellers = sellers.length > 1;

  return (
    <div className="p-5 space-y-3">
      {mixedSellers && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          ⚠️ Tenés productos de distintas tiendas. Por ahora solo podés comprar de una tienda por pedido.
          Eliminá los de una tienda para continuar.
        </div>
      )}
      {items.map((item) => (
        <div key={item.listingId} className="flex gap-3 items-start p-3 rounded-xl border border-stone-200">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-stone-100 flex items-center justify-center text-2xl shrink-0">
              🎲
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-stone-900 truncate">{item.productName}</p>
            <p className="text-xs text-stone-500">{item.sellerName} · ×{item.quantity}</p>
            <p className="text-sm font-semibold text-stone-900 mt-0.5">
              {fmt(item.priceMinorUnits * item.quantity, item.currency)}
            </p>
          </div>
          <button
            onClick={() => onRemove(item.listingId)}
            className="text-stone-300 hover:text-red-400 text-lg shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-stone-600">{label}</label>
      {children}
    </div>
  );
}

const cls =
  'w-full px-3 py-2 text-sm rounded-lg border border-stone-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
