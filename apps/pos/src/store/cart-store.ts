import { create } from 'zustand';
import { Money, asId, type StoreId, type DeviceId, type SaleLineId } from '@retail-os/shared-kernel';
import { Sale } from '@retail-os/sales';
import { CatalogIndex, productFromSnapshot, type ProductSnapshot } from '@retail-os/catalog';
import { dataClient } from '../platform/data-client.js';
import { bus } from '../platform/bus.js';

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

  init(): Promise<void>;
  newSale(): void;
  addProduct(p: ProductSnapshot): void;
  changeQty(lineId: string, qty: number): void;
  removeLine(lineId: string): void;
  setLineDiscount(lineId: string, minorUnits: number): void;
  setCartDiscount(minorUnits: number): void;
}

function freshSale(terminal: Terminal): Sale {
  return Sale.start(terminal.currency, {
    storeId: asId<'StoreId'>(terminal.storeId) as StoreId,
    deviceId: asId<'DeviceId'>(terminal.deviceId) as DeviceId,
  });
}

function publishCartUpdate(sale: Sale) {
  try {
    const payload = {
      saleId: sale.id,
      currency: sale.currency,
      lines: sale.lines.map((l) => ({
        lineId: l.lineId,
        name: l.name,
        quantity: l.quantity,
        unitPrice: { minorUnits: l.unitPrice.minorUnits, currency: sale.currency },
        lineTotal: { minorUnits: l.lineTotal.minorUnits, currency: sale.currency },
      })),
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

  async init() {
    const [terminal, products] = await Promise.all([dataClient.getTerminal(), dataClient.listProducts()]);
    const catalog = new CatalogIndex(products.map(productFromSnapshot));
    const sale = freshSale(terminal);
    set({ terminal, catalog, sale, ready: true, rev: get().rev + 1 });
    publishCartUpdate(sale);
  },

  newSale() {
    const terminal = get().terminal;
    if (!terminal) return;
    const sale = freshSale(terminal);
    set({ sale, rev: get().rev + 1 });
    publishCartUpdate(sale);
  },

  addProduct(p) {
    const { sale, rev } = get();
    if (!sale) return;
    sale.addLine({
      productId: asId(p.id),
      name: p.name,
      unitPrice: Money.of(p.priceMinorUnits, p.currency),
      taxRatePercent: p.taxRatePercent,
    });
    set({ rev: rev + 1 });
    publishCartUpdate(sale);
  },

  changeQty(lineId, qty) {
    const { sale, rev } = get();
    sale?.changeQuantity(asId<'SaleLineId'>(lineId) as SaleLineId, qty);
    set({ rev: rev + 1 });
    if (sale) publishCartUpdate(sale);
  },

  removeLine(lineId) {
    const { sale, rev } = get();
    sale?.removeLine(asId<'SaleLineId'>(lineId) as SaleLineId);
    set({ rev: rev + 1 });
    if (sale) publishCartUpdate(sale);
  },

  setLineDiscount(lineId, minorUnits) {
    const { sale, rev } = get();
    if (!sale) return;
    sale.setLineDiscount(asId<'SaleLineId'>(lineId) as SaleLineId, Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
    publishCartUpdate(sale);
  },

  setCartDiscount(minorUnits) {
    const { sale, rev } = get();
    if (!sale) return;
    sale.setCartDiscount(Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
    publishCartUpdate(sale);
  },
}));
