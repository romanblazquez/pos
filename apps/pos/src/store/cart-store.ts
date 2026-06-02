import { create } from 'zustand';
import { Money, asId, type StoreId, type DeviceId, type SaleLineId } from '@retail-os/shared-kernel';
import { Sale } from '@retail-os/sales';
import { CatalogIndex, productFromSnapshot, type ProductSnapshot } from '@retail-os/catalog';
import { dataClient } from '../platform/data-client.js';

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

export const useCart = create<CartState>((set, get) => ({
  sale: null,
  rev: 0,
  catalog: new CatalogIndex(),
  ready: false,
  terminal: null,

  async init() {
    const [terminal, products] = await Promise.all([dataClient.getTerminal(), dataClient.listProducts()]);
    const catalog = new CatalogIndex(products.map(productFromSnapshot));
    set({ terminal, catalog, sale: freshSale(terminal), ready: true, rev: get().rev + 1 });
  },

  newSale() {
    const terminal = get().terminal;
    if (!terminal) return;
    set({ sale: freshSale(terminal), rev: get().rev + 1 });
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
  },

  changeQty(lineId, qty) {
    const { sale, rev } = get();
    sale?.changeQuantity(asId<'SaleLineId'>(lineId) as SaleLineId, qty);
    set({ rev: rev + 1 });
  },

  removeLine(lineId) {
    const { sale, rev } = get();
    sale?.removeLine(asId<'SaleLineId'>(lineId) as SaleLineId);
    set({ rev: rev + 1 });
  },

  setLineDiscount(lineId, minorUnits) {
    const { sale, rev } = get();
    if (!sale) return;
    sale.setLineDiscount(asId<'SaleLineId'>(lineId) as SaleLineId, Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
  },

  setCartDiscount(minorUnits) {
    const { sale, rev } = get();
    if (!sale) return;
    sale.setCartDiscount(Money.of(minorUnits, sale.currency));
    set({ rev: rev + 1 });
  },
}));
