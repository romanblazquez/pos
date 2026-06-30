import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ShelfStatus = 'owned' | 'wishlist' | 'want-to-play' | 'previously-owned' | 'for-trade' | 'preordered' | null;

export interface ShelfEntry {
  slug: string;
  name: string;
  status: ShelfStatus;
  addedAt: string;
}

export interface XPEvent {
  label: string;
  xp: number;
  at: string;
}

export interface ShelfState {
  items: Record<string, ShelfEntry>;
  xp: number;
  recentXPEvents: XPEvent[];
}

export interface ShelfCounts {
  owned: number;
  wishlist: number;
  'want-to-play': number;
  'previously-owned': number;
  'for-trade': number;
  preordered: number;
}

interface ShelfContextValue {
  shelfState: ShelfState;
  setShelfStatus: (slug: string, name: string, status: ShelfStatus) => void;
  getShelfStatus: (slug: string) => ShelfStatus;
  shelfCounts: ShelfCounts;
  recentXPEvents: XPEvent[];
  awardXP: (amount: number, label: string) => void;
}

const STORAGE_KEY = 'jp-shelf-v1';

const XP_TIERS_SIMPLE = [
  { name: 'Pawn', min: 0 },
  { name: 'Meeple', min: 200 },
  { name: 'Collector', min: 500 },
  { name: 'Curator', min: 1000 },
  { name: 'Loremaster', min: 2000 },
] as const;

function getTierName(xp: number): string {
  let tier = XP_TIERS_SIMPLE[0].name as string;
  for (const t of XP_TIERS_SIMPLE) {
    if (xp >= t.min) tier = t.name;
  }
  return tier;
}

function loadState(): ShelfState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ShelfState;
  } catch {
    // ignore
  }
  return { items: {}, xp: 0, recentXPEvents: [] };
}

function saveState(state: ShelfState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const ShelfContext = createContext<ShelfContextValue | null>(null);

export function ShelfProvider({ children }: { children: ReactNode }) {
  const [shelfState, setShelfState] = useState<ShelfState>(loadState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const prevTierRef = useRef<string>(getTierName(shelfState.xp));
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist on change and show tier-up toast
  useEffect(() => {
    saveState(shelfState);
    const newTier = getTierName(shelfState.xp);
    if (newTier !== prevTierRef.current) {
      prevTierRef.current = newTier;
      setToastMsg(`¡Subiste de rango! Ahora eres ${newTier} 🎉`);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000);
    }
  }, [shelfState]);

  const awardXP = useCallback((amount: number, label: string) => {
    setShelfState((prev) => {
      const event: XPEvent = { label, xp: amount, at: new Date().toISOString() };
      return {
        ...prev,
        xp: prev.xp + amount,
        recentXPEvents: [event, ...prev.recentXPEvents].slice(0, 10),
      };
    });
  }, []);

  const setShelfStatus = useCallback((slug: string, name: string, status: ShelfStatus) => {
    setShelfState((prev) => {
      const current = prev.items[slug]?.status ?? null;
      if (current === status) return prev;

      const newItems = { ...prev.items };
      let xpDelta = 0;
      let xpLabel = '';

      if (status === null) {
        delete newItems[slug];
      } else {
        newItems[slug] = { slug, name, status, addedAt: new Date().toISOString() };
        if (status === 'owned') { xpDelta = 10; xpLabel = 'Juego agregado a colección'; }
        else if (status === 'wishlist') { xpDelta = 5; xpLabel = 'Juego agregado a wishlist'; }
        else if (status === 'want-to-play') { xpDelta = 5; xpLabel = 'Juego marcado como quiero jugar'; }
      }

      const events = prev.recentXPEvents;
      const newEvents = xpDelta > 0
        ? [{ label: xpLabel, xp: xpDelta, at: new Date().toISOString() }, ...events].slice(0, 10)
        : events;

      return {
        ...prev,
        items: newItems,
        xp: prev.xp + xpDelta,
        recentXPEvents: newEvents,
      };
    });
  }, []);

  const getShelfStatus = useCallback((slug: string): ShelfStatus => {
    return shelfState.items[slug]?.status ?? null;
  }, [shelfState.items]);

  const shelfCounts: ShelfCounts = {
    owned: 0,
    wishlist: 0,
    'want-to-play': 0,
    'previously-owned': 0,
    'for-trade': 0,
    preordered: 0,
  };
  for (const entry of Object.values(shelfState.items)) {
    if (entry.status && entry.status in shelfCounts) {
      shelfCounts[entry.status as keyof ShelfCounts]++;
    }
  }

  return (
    <ShelfContext.Provider value={{
      shelfState,
      setShelfStatus,
      getShelfStatus,
      shelfCounts,
      recentXPEvents: shelfState.recentXPEvents,
      awardXP,
    }}>
      {children}

      {/* Tier-up toast */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3
                     rounded-2xl border border-[--border] bg-[--bg-raised] px-5 py-3 shadow-xl
                     text-sm font-semibold text-[--tx] animate-fade-in"
        >
          <span className="text-xl">🏆</span>
          {toastMsg}
        </div>
      )}
    </ShelfContext.Provider>
  );
}

export function useShelf(): ShelfContextValue {
  const ctx = useContext(ShelfContext);
  if (!ctx) throw new Error('useShelf must be used within <ShelfProvider>');
  return ctx;
}
