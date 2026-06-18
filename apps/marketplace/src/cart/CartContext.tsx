import { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  listingId: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  priceMinorUnits: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
}

interface CartCtx {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (listingId: string) => void;
  clear: () => void;
  total: number;
  count: number;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === item.listingId);
      if (existing) {
        return prev.map((i) =>
          i.listingId === item.listingId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        );
      }
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.priceMinorUnits * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, add, remove, clear, total, count }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
