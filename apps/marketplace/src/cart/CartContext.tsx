import { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  listingId: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  priceMinorUnits: number;
  currency: string;
  quantity: number;
  stock: number;
  imageUrl?: string;
}

export type AddResult = 'ok' | 'out_of_stock' | 'different_seller' | 'different_currency';

interface CartCtx {
  items: CartItem[];
  add: (item: CartItem) => AddResult;
  remove: (listingId: string) => void;
  clear: () => void;
  total: number;
  /** Currency the total is denominated in; undefined for an empty cart. */
  currency?: string;
  count: number;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Caps at available stock — repeated "Agregar" clicks (or a stale stock value
  // from a longer-open tab) can never push the cart quantity past what's
  // actually purchasable; the backend re-validates this independently at
  // checkout anyway, but catching it here gives immediate feedback instead of
  // a generic error at the very end of checkout.
  //
  // MercadoPago's marketplace split is a documented 1:1 model (one payment, one
  // seller-collector) — a cart can never hold items from more than one seller,
  // so this is enforced here too, not just at checkout submission, to give the
  // buyer immediate feedback instead of a surprise error after filling out the
  // whole checkout form.
  const add = useCallback((item: CartItem): AddResult => {
    if (item.stock <= 0) return 'out_of_stock';
    const cartSellerId = items[0]?.sellerId;
    const alreadyInCart = items.some((i) => i.listingId === item.listingId);
    if (cartSellerId && cartSellerId !== item.sellerId && !alreadyInCart) {
      return 'different_seller';
    }
    // A cart total is a single number, so it can only be denominated in one
    // currency. Adding an ARS listing to an MXN cart would sum unlike amounts
    // and label the result with whichever happened to be added first.
    const cartCurrency = items[0]?.currency;
    if (cartCurrency && cartCurrency !== item.currency && !alreadyInCart) {
      return 'different_currency';
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === item.listingId);
      if (existing) {
        return prev.map((i) =>
          i.listingId === item.listingId
            ? { ...i, quantity: Math.min(i.quantity + item.quantity, item.stock), stock: item.stock }
            : i,
        );
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity, item.stock) }];
    });
    return 'ok';
  }, [items]);

  const remove = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.priceMinorUnits * i.quantity, 0);
  // Guaranteed single-currency by the add() guard above, so the total is a
  // number the buyer can actually be charged.
  const currency = items[0]?.currency;
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, add, remove, clear, total, currency, count }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
