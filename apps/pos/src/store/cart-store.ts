import { create } from 'zustand';
import { Money, asId, type StoreId, type DeviceId, type SaleLineId, type ProductId } from '@retail-os/shared-kernel';
import { Sale } from '@retail-os/sales';
import { CatalogIndex, productFromSnapshot, type ProductSnapshot } from '@retail-os/catalog';
import { dataClient } from '../platform/data-client.js';
import { bus } from '../platform/bus.js';

const HELD_CARTS_KEY = 'retail-os.pos.held-carts.v1';

interface HeldLine {
  productId: string;
  name: string;
  unitPriceMinorUnits: number;
  taxRatePercent: number;
  quantity: number;
  discountMinorUnits: number;
}

export interface HeldCart {
  id: string;
  label: string;
  heldAt: string;
  currency: string;
  cartDiscountMinorUnits: number;
  lines: HeldLine[];
}

function loadHeld(): HeldCart[] {
  try {
    const raw = localStorage.getItem(HELD_CARTS_KEY);
    return raw ? (JSON.parse(raw) as HeldCart[]) : [];
  } catch { return []; }
}

function saveHeld(carts: HeldCart[]): void {
  localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(carts));
}

interface Terminal {
  tenantId: string;
  storeId: string;
  deviceId: string;
  currency: string;
}

interface CartState {
  sale: Sale | null;
  /** Bumped on every mutation so selectors recompute (Sale is a mutable aggregate). */
  rev: number;
  catalog: CatalogIndex;
  ready: boolean;
  terminal: Terminal | null;
  heldCarts: HeldCart[];

  init(): Promise<void>;
  newSale(): void;
  addProduct(p: ProductSnapshot): void;
  changeQty(lineId: string, qty: number): void;
  removeLine(lineId: string): void;
  setLineDiscount(lineId: string, minorUnits: number): void;
  setCartDiscount(minorUnits: number): void;
  holdCart(): void;
  restoreHeld(id: string): void;
  discardHeld(id: string): void;
}

function freshSale(terminal: Terminal): Sale {
  return Sale.start(terminal.currency, {
    storeId: asId<'StoreId'>(terminal.storeId) as StoreId,
    deviceId: asId<'DeviceId'>(terminal.deviceId) as DeviceId,
  });
}

function publishCartUpdate(sale: Sale, catalog?: CatalogIndex) {
  try {
    const payload = {
      saleId: sale.id,
      currency: sale.currency,
      lines: sale.lines.map((l) => {
        const product = catalog?.getById(String(l.productId));
        return {
          lineId: l.lineId,
          name: l.name,
          quantity: l.quantity,
          unitPrice: { minorUnits: l.unitPrice.minorUnits, currency: sale.currency },
          lineTotal: { minorUnits: l.lineTotal.minorUnits, currency: sale.currency },
          imageUrl: product?.imageUrl,
        };
      }),
      subtotal: { minorUnits: sale.netSubtotal.minorUnits, currency: sale.currency },
      discount: { minorUnits: sale.discountTotal.minorUnits, currency: sale.currency },
      taxTotal: { minorUnits: sale.taxTotal.minorUnits, currency: sale.currency },
      grandTotal: { minorUnits: sale.grandTotal.minorUnits, currency: sale.currency },
      itemCount: sale.lines.reduce((s, l) => s + l.quantity, 0),
    };
    bus.publish('rwp.cart.updated', payload);
    bus.publish('rwp.context.cart', payload);
  } catch (e) {
    console.error('[cart-store] publishCartUpdate failed:', e);
  }
}

export const useCart = create<CartState>((set, get) => ({
  sale: null,
  rev: 0,
  catalog: new CatalogIndex(),
  ready: false,
  terminal: null,
  heldCarts: loadHeld(),

  async init() {
    const [terminal, products] = await Promise.all([dataClient.getTerminal(), dataClient.listProducts()]);
    const catalog = new CatalogIndex(products.map(productFromSnapshot));
    const sale = freshSale(terminal);
    set({ terminal, catalog, sale, ready: true, rev: get().rev + 1 });
    publishCartUpdate(sale, catalog);
  },

  newSale() {
    const { terminal, catalog } = get();
    if (!terminal) return;
    const sale = freshSale(terminal);
    set({ sale, rev: get().rev + 1 });
    publishCartUpdate(sale, catalog);
  },

  addProduct(p) {
    const { sale, rev, catalog } = get();
    if (!sale) return;
    sale.addLine({
      productId: asId(p.id),
      name: p.name,
      unitPrice: Money.of(p.priceMinorUnits, p.currency),
      taxRatePercent: p.taxRatePercent,
    });
    set({ rev: rev + 1 });
    publishCartUpdate(sale, catalog);
  },

  changeQty(lineId, qty) {
    const { sale, rev, catalog } = get();
    sale?.changeQuantity(asId<'SaleLineId'>(lineId) as SaleLineId, qty);
    set({ rev: rev + 1 });
    if (sale) publishCartUpdate(sale, catalog);
  },

  removeLine(lineId) {
    const { sale, rev, catalog } = get();
    sale?.removeLine(asId<'SaleLineId'>(lineId) as SaleLineId);
    set({ rev: rev + 1 });
    if (sale) publishCartUpdate(sale, catalog);
  },

  setLineDiscount(lineId, minorUnits) {
    const { sale, rev, catalog } = get();
    if (!sale) return;
    sale.setLineDiscount(asId<'SaleLineId'>(lineId) as SaleLineId, Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
    publishCartUpdate(sale, catalog);
  },

  setCartDiscount(minorUnits) {
    const { sale, rev, catalog } = get();
    if (!sale) return;
    sale.setCartDiscount(Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
    publishCartUpdate(sale, catalog);
  },

  holdCart() {
    const { sale, terminal, heldCarts, rev } = get();
    if (!sale || sale.isEmpty || !terminal) return;
    const now = new Date();
    const held: HeldCart = {
      id: crypto.randomUUID(),
      label: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      heldAt: now.toISOString(),
      currency: sale.currency,
      cartDiscountMinorUnits: sale.cartDiscount.minorUnits,
      lines: sale.lines.map((l) => ({
        productId: String(l.productId),
        name: l.name,
        unitPriceMinorUnits: l.unitPrice.minorUnits,
        taxRatePercent: l.taxRatePercent,
        quantity: l.quantity,
        discountMinorUnits: l.discount.minorUnits,
      })),
    };
    const next = [...heldCarts, held];
    saveHeld(next);
    const fresh = freshSale(terminal);
    set({ sale: fresh, heldCarts: next, rev: rev + 1 });
    publishCartUpdate(fresh, get().catalog);
  },

  restoreHeld(id) {
    const { terminal, heldCarts, sale } = get();
    if (!terminal) return;
    const target = heldCarts.find((h) => h.id === id);
    if (!target) return;

    // If current cart has items, auto-hold it before swapping
    if (sale && !sale.isEmpty) {
      get().holdCart();
    }

    const restored = freshSale(terminal);
    for (const l of target.lines) {
      const line = restored.addLine({
        productId: asId<'ProductId'>(l.productId) as ProductId,
        name: l.name,
        unitPrice: Money.of(l.unitPriceMinorUnits, target.currency),
        taxRatePercent: l.taxRatePercent,
        quantity: l.quantity,
      });
      if (l.discountMinorUnits > 0) {
        restored.setLineDiscount(line.lineId, Money.of(l.discountMinorUnits, target.currency));
      }
    }
    if (target.cartDiscountMinorUnits > 0) {
      restored.setCartDiscount(Money.of(target.cartDiscountMinorUnits, target.currency));
    }

    const remaining = get().heldCarts.filter((h) => h.id !== id);
    saveHeld(remaining);
    set({ sale: restored, heldCarts: remaining, rev: get().rev + 1 });
    publishCartUpdate(restored, get().catalog);
  },

  discardHeld(id) {
    const { heldCarts } = get();
    const next = heldCarts.filter((h) => h.id !== id);
    saveHeld(next);
    set((s) => ({ heldCarts: next, rev: s.rev + 1 }));
  },
}));
