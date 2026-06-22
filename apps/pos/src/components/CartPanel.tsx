import { Badge, Button, Card, formatMoney } from '@retail-os/ui-react';
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
    <aside className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto_auto] bg-card p-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Venta actual</h2>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">{itemCount} artículos</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={holdCart}
            disabled={sale.isEmpty}
            title="Apartar venta y abrir nueva"
          >
            Apartar
          </Button>
          <Button variant="secondary" size="sm" onClick={newSale}>
            Nueva
          </Button>
        </div>
      </header>

      {/* ── Held carts ── */}
      {heldCarts.length > 0 && (
        <Card className="mb-2 gap-1 rounded-lg bg-muted/50 p-2">
          <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">En espera</span>
          {heldCarts.map((h) => (
            <HeldCartChip
              key={h.id}
              cart={h}
              onRestore={() => restoreHeld(h.id)}
              onDiscard={() => discardHeld(h.id)}
            />
          ))}
        </Card>
      )}

      <div className="flex min-h-0 flex-col gap-2 overflow-auto py-1 pb-3">
        {sale.lines.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Carrito vacío</div>
        )}
        {sale.lines.map((line) => (
          <Card key={line.lineId} className="gap-2 rounded-lg bg-muted/40 p-3 shadow-none">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm font-semibold">
              <span className="truncate">{line.name}</span>
              <span className="tabular-nums">{fmt(line.lineTotal.minorUnits)}</span>
            </div>
            <div className="grid grid-cols-[28px_28px_28px_minmax(0,1fr)_28px] items-center gap-1.5 text-xs text-muted-foreground">
              <Button variant="outline" size="icon" className="size-7" onClick={() => changeQty(line.lineId, line.quantity - 1)}>−</Button>
              <span className="text-center font-semibold text-foreground">{line.quantity}</span>
              <Button variant="outline" size="icon" className="size-7" onClick={() => changeQty(line.lineId, line.quantity + 1)}>+</Button>
              <span className="truncate">@ {fmt(line.unitPrice.minorUnits)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeLine(line.lineId)}
              >
                ×
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-1.5 border-t py-3">
        <span className="text-xs font-medium text-muted-foreground">Descuento</span>
        {discountOptions.map((minorUnits) => (
          <Button
            key={minorUnits}
            variant={sale.cartDiscount.minorUnits === minorUnits ? 'default' : 'outline'}
            size="sm"
            className="h-8 min-w-0 px-2 text-[11px]"
            disabled={minorUnits > sale.netSubtotal.minorUnits}
            onClick={() => setCartDiscount(minorUnits)}
          >
            {minorUnits === 0 ? 'Sin' : `-${fmt(minorUnits)}`}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <Row label="Subtotal" value={fmt(sale.netSubtotal.minorUnits)} />
        {!sale.discountTotal.isZero() && (
          <Row label="Descuentos" value={`− ${fmt(sale.discountTotal.minorUnits)}`} />
        )}
        <Row label="IVA (16%)" value={fmt(sale.taxTotal.minorUnits)} />
        <Row label="Total" value={fmt(sale.grandTotal.minorUnits)} strong />
      </div>

      <Button size="lg" className="mt-4 h-12 text-base font-semibold" disabled={sale.isEmpty} onClick={onCharge}>
        Cobrar {fmt(sale.grandTotal.minorUnits)}
      </Button>
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
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-8 min-w-0 flex-1 justify-between px-2"
        onClick={onRestore}
        title="Recuperar venta"
      >
        <span className="truncate text-xs font-semibold">{cart.label}</span>
        <Badge variant="muted" className="ml-2 shrink-0 text-[10px]">{itemCount} art · {fmt(total)}</Badge>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDiscard}
        title="Descartar venta apartada"
      >
        ×
      </Button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong
      ? 'mt-1 flex items-baseline justify-between gap-3 text-xl font-bold'
      : 'flex justify-between gap-3 text-sm text-muted-foreground'}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
