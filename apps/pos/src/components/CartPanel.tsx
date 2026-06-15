import { formatMoney } from '@retail-os/ui-react';
import { useCart, type HeldCart } from '../store/cart-store.js';

/**
 * CartPanel — the live cart with per-line quantity controls and the running
 * totals (net subtotal, discounts, IVA, grand total). Reads straight off the
 * Sale aggregate; every mutation bumps the store revision so totals stay exact.
 */
export function CartPanel({ onCharge }: { onCharge: () => void }) {
  useCart((s) => s.rev);
  const sale = useCart((s) => s.sale);
  const heldCarts = useCart((s) => s.heldCarts);
  const changeQty = useCart((s) => s.changeQty);
  const removeLine = useCart((s) => s.removeLine);
  const newSale = useCart((s) => s.newSale);
  const setCartDiscount = useCart((s) => s.setCartDiscount);
  const holdCart = useCart((s) => s.holdCart);
  const restoreHeld = useCart((s) => s.restoreHeld);
  const discardHeld = useCart((s) => s.discardHeld);

  if (!sale) return null;
  const currency = sale.currency;
  const fmt = (minorUnits: number) => formatMoney({ minorUnits, currency });
  const itemCount = sale.lines.reduce((sum, line) => sum + line.quantity, 0);
  const discountOptions = [0, 500, 1000, 2500];

  return (
    <aside className="cart">
      <header className="cart-head">
        <div>
          <h2>Venta actual</h2>
          <span>{itemCount} articulos</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="link"
            onClick={holdCart}
            disabled={sale.isEmpty}
            title="Apartar venta y abrir nueva"
          >
            Apartar
          </button>
          <button className="link" onClick={newSale}>
            Nueva
          </button>
        </div>
      </header>

      {/* ── Held carts ── */}
      {heldCarts.length > 0 && (
        <div className="held-carts">
          <span className="held-label">En espera</span>
          {heldCarts.map((h) => (
            <HeldCartChip
              key={h.id}
              cart={h}
              onRestore={() => restoreHeld(h.id)}
              onDiscard={() => discardHeld(h.id)}
            />
          ))}
        </div>
      )}

      <div className="lines">
        {sale.lines.length === 0 && <p className="empty">Carrito vacío</p>}
        {sale.lines.map((line) => (
          <div key={line.lineId} className="line">
            <div className="line-main">
              <span className="line-name">{line.name}</span>
              <span className="line-total">{fmt(line.lineTotal.minorUnits)}</span>
            </div>
            <div className="line-controls">
              <button onClick={() => changeQty(line.lineId, line.quantity - 1)}>−</button>
              <span className="qty">{line.quantity}</span>
              <button onClick={() => changeQty(line.lineId, line.quantity + 1)}>+</button>
              <span className="unit">@ {fmt(line.unitPrice.minorUnits)}</span>
              <button className="remove" onClick={() => removeLine(line.lineId)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="discount-tools">
        <span>Descuento</span>
        {discountOptions.map((minorUnits) => (
          <button
            key={minorUnits}
            className={sale.cartDiscount.minorUnits === minorUnits ? 'active' : ''}
            disabled={minorUnits > sale.netSubtotal.minorUnits}
            onClick={() => setCartDiscount(minorUnits)}
          >
            {minorUnits === 0 ? 'Sin' : `-${fmt(minorUnits)}`}
          </button>
        ))}
      </div>

      <div className="totals">
        <Row label="Subtotal" value={fmt(sale.netSubtotal.minorUnits)} />
        {!sale.discountTotal.isZero() && (
          <Row label="Descuentos" value={`− ${fmt(sale.discountTotal.minorUnits)}`} />
        )}
        <Row label="IVA (16%)" value={fmt(sale.taxTotal.minorUnits)} />
        <Row label="Total" value={fmt(sale.grandTotal.minorUnits)} strong />
      </div>

      <button className="charge" disabled={sale.isEmpty} onClick={onCharge}>
        Cobrar {fmt(sale.grandTotal.minorUnits)}
      </button>
    </aside>
  );
}

function HeldCartChip({
  cart,
  onRestore,
  onDiscard,
}: {
  cart: HeldCart;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0);
  const total = cart.lines.reduce(
    (s, l) => s + l.unitPriceMinorUnits * l.quantity - l.discountMinorUnits,
    -cart.cartDiscountMinorUnits,
  );
  const fmt = (n: number) => formatMoney({ minorUnits: Math.max(0, n), currency: cart.currency });

  return (
    <div className="held-chip">
      <button className="held-restore" onClick={onRestore} title="Recuperar venta">
        <span className="held-time">{cart.label}</span>
        <span className="held-meta">{itemCount} art · {fmt(total)}</span>
      </button>
      <button className="held-discard" onClick={onDiscard} title="Descartar venta apartada">
        ×
      </button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`row${strong ? ' strong' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
