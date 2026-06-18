import { useState, useEffect } from 'react';
import { useCart } from './CartContext.js';
import { useCustomer } from '../context/CustomerContext.js';
import { useAddresses } from '../hooks/useAddresses.js';
import { useWallet, storeCreditFor } from '../hooks/useWallet.js';
import { Button, inputCls } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? '';

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

type Step = 'cart' | 'form' | 'processing' | 'success' | 'error';

export default function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, remove, clear, total } = useCart();
  const { session } = useCustomer();
  const { addresses, create: createAddress } = useAddresses(session?.customer.id);
  const { data: wallet } = useWallet(session?.customer.id);
  const [step, setStep] = useState<Step>('cart');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [useCredits, setUseCredits] = useState(true);

  const cartSellerId = items[0]?.sellerId;
  const platformCreditsAvailable = wallet?.platformCreditsMinor ?? 0;
  const storeCreditsAvailable = cartSellerId ? storeCreditFor(wallet, cartSellerId) : 0;
  const creditsAvailable = platformCreditsAvailable + storeCreditsAvailable;
  const creditsToApply = useCredits ? Math.min(creditsAvailable, total) : 0;
  const amountDue = total - creditsToApply;

  const [name, setName] = useState(session?.customer.name ?? '');
  const [email, setEmail] = useState(session?.customer.email ?? '');

  // 'new' = typing a fresh address below; otherwise the id of a saved address to reuse.
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>('new');
  const [saveAddress, setSaveAddress] = useState(true);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Default to the customer's default saved address the first time the list loads.
  useEffect(() => {
    if (addresses.length === 0) return;
    setSelectedAddressId((current) => {
      if (current !== 'new') return current;
      return addresses.find((a) => a.isDefault)?.id ?? addresses[0].id;
    });
  }, [addresses]);

  const usingNewAddress = selectedAddressId === 'new' || addresses.length === 0;

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    setStep('processing');
    setError('');
    try {
      const savedAddress = addresses.find((a) => a.id === selectedAddressId);
      const deliveryAddress = savedAddress
        ? { street: savedAddress.street, city: savedAddress.city, state: savedAddress.state, postalCode: savedAddress.postalCode, country: savedAddress.country }
        : { street, city, state: stateVal, postalCode, country: 'MX' };

      // Save the new address for next time — best-effort, never blocks checkout itself.
      if (usingNewAddress && saveAddress && session) {
        try { await createAddress.mutateAsync({ street, city, state: stateVal, postalCode, country: 'MX' }); } catch { /* non-blocking */ }
      }

      const baseUrl = window.location.origin;
      const res = await fetch(`${API}/api/v1/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
          deliveryAddress,
          customerId: session?.customer.id,
          customerEmail: email,
          customerName: name,
          // Backend caps these at actual balance and at the order subtotal — sending
          // the full available amounts here is safe even if it exceeds what's needed.
          platformCreditsToUse: useCredits ? platformCreditsAvailable : 0,
          storeCreditsToUse: useCredits ? storeCreditsAvailable : 0,
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
      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-md" onClick={onClose} />

      <div className="animate-slide-right relative w-full max-w-md bg-[--bg-raised] h-full shadow-xl flex flex-col border-l border-[--border]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--border] shrink-0">
          <h2 className="font-bold text-[--tx] text-base">{stepTitle}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
          >
            ✕
          </button>
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

              {addresses.length > 0 && (
                <div className="flex flex-col gap-2">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedAddressId === addr.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                          : 'border-[--border] hover:border-[--tx-faint]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 accent-emerald-600"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[--tx]">{addr.label || 'Dirección'}</p>
                        <p className="text-xs text-[--tx-muted]">{addr.street}, {addr.city}, {addr.state} {addr.postalCode}</p>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedAddressId === 'new'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-[--border] hover:border-[--tx-faint]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === 'new'}
                      onChange={() => setSelectedAddressId('new')}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-[--tx]">+ Usar una dirección nueva</span>
                  </label>
                </div>
              )}

              {usingNewAddress && (
                <div className="flex flex-col gap-4">
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
                  {session && (
                    <label className="flex items-center gap-2.5 text-sm text-[--tx-muted] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      Guardar esta dirección para la próxima vez
                    </label>
                  )}
                </div>
              )}

              {session && creditsAvailable > 0 && (
                <>
                  <hr className="border-[--border]" />
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-[--border] bg-[--bg-subtle] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCredits}
                      onChange={(e) => setUseCredits(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[--tx]">Usar mis créditos</p>
                      <p className="text-xs text-[--tx-muted] mt-0.5">
                        Tenés {fmt(creditsAvailable, items[0]?.currency)} disponibles
                        {storeCreditsAvailable > 0 && platformCreditsAvailable > 0 ? ' (saldo general + crédito de esta tienda)' : ''}.
                      </p>
                    </div>
                  </label>
                </>
              )}
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
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-200">
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
            {creditsToApply > 0 && (
              <>
                <div className="flex justify-between text-sm text-[--tx-muted]">
                  <span>Subtotal</span>
                  <span className="tabular">{fmt(total, items[0]?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Créditos aplicados</span>
                  <span className="tabular">−{fmt(creditsToApply, items[0]?.currency)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-semibold text-[--tx]">
              <span>Total a pagar</span>
              <span className="tabular">{fmt(amountDue, items[0]?.currency)}</span>
            </div>
            <Button type="submit" form="checkout-form" className="w-full justify-center py-3">
              {amountDue <= 0 ? 'Confirmar pedido' : 'Pagar con Mercado Pago 🔒'}
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
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
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
          <button
            onClick={() => onRemove(item.listingId)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-200"
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[--tx-muted]">{label}</label>
      {children}
    </div>
  );
}
