import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCustomer } from './CustomerContext.js';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';

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
// Marks that a given customerId's guest shelf has already been merged into
// their account, so a returning guest session never re-imports (and never
// re-awards XP for) items the account already has.
const MIGRATED_KEY = 'jp-shelf-migrated-v1';

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

function loadGuestState(): ShelfState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ShelfState;
  } catch {
    // ignore
  }
  return { items: {}, xp: 0, recentXPEvents: [] };
}

function saveGuestState(state: ShelfState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ── Server-backed shelf (logged-in customers) ────────────────────────────
// Mirrors apps/api/src/shelf/shelf.service.ts's response shape exactly.
interface ServerShelfItem {
  status: string;
  addedAt: string;
  product: { slug: string; name: string };
}
interface ServerShelfResponse {
  items: ServerShelfItem[];
  totalXp: number;
  recentEvents: { label: string; amount: number; createdAt: string }[];
}

function serverToShelfState(data: ServerShelfResponse): ShelfState {
  const items: Record<string, ShelfEntry> = {};
  for (const item of data.items) {
    items[item.product.slug] = {
      slug: item.product.slug,
      name: item.product.name,
      status: item.status as ShelfStatus,
      addedAt: item.addedAt,
    };
  }
  return {
    items,
    xp: data.totalXp,
    recentXPEvents: data.recentEvents.map((e) => ({ label: e.label, xp: e.amount, at: e.createdAt })),
  };
}

async function fetchServerShelf(customerId: string): Promise<ServerShelfResponse> {
  const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/shelf`);
  if (!res.ok) throw new Error(`shelf fetch failed: ${res.status}`);
  return res.json() as Promise<ServerShelfResponse>;
}

async function putShelfStatus(customerId: string, slug: string, status: ShelfStatus): Promise<ServerShelfResponse> {
  const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/shelf/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`shelf update failed: ${res.status}`);
  return res.json() as Promise<ServerShelfResponse>;
}

// The only registered generic XP event today — see apps/api/src/shelf/shelf.dto.ts's
// XP_EVENT_TYPES. eventType is a fixed server-side lookup, not a client-supplied
// amount, so awardXP's `amount`/`label` args are display-only for the guest path.
async function postAwardXp(customerId: string): Promise<ServerShelfResponse> {
  const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/shelf/xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'purchase_confirmed' }),
  });
  if (!res.ok) throw new Error(`xp award failed: ${res.status}`);
  return res.json() as Promise<ServerShelfResponse>;
}

async function importGuestShelf(customerId: string, items: ShelfEntry[]): Promise<ServerShelfResponse> {
  const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/shelf/import-guest`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items.map((i) => ({ slug: i.slug, status: i.status })) }),
  });
  if (!res.ok) throw new Error(`shelf import failed: ${res.status}`);
  return res.json() as Promise<ServerShelfResponse>;
}

const ShelfContext = createContext<ShelfContextValue | null>(null);

export function ShelfProvider({ children }: { children: ReactNode }) {
  const { session } = useCustomer();
  const customerId = session?.customer.id;
  const queryClient = useQueryClient();

  // Guest (logged-out) state — unchanged localStorage behavior, no regression
  // for ShelfButtons/ProductCard rendered on public product pages.
  const [guestState, setGuestState] = useState<ShelfState>(loadGuestState);

  const { data: serverData } = useQuery({
    queryKey: ['shelf', customerId],
    queryFn: () => fetchServerShelf(customerId!),
    enabled: !!customerId,
    retry: false,
  });

  // One-time guest→account migration on login (standard guest-cart-merges-
  // on-login pattern) — only runs if the account doesn't already have shelf
  // data, and only once per customerId, so it can never overwrite or
  // duplicate-award XP for real account state.
  useEffect(() => {
    if (!customerId || !serverData) return;
    if (localStorage.getItem(MIGRATED_KEY) === customerId) return;
    if (serverData.items.length > 0) {
      localStorage.setItem(MIGRATED_KEY, customerId);
      return;
    }
    const guestItems = Object.values(loadGuestState().items);
    if (guestItems.length === 0) {
      localStorage.setItem(MIGRATED_KEY, customerId);
      return;
    }
    importGuestShelf(customerId, guestItems)
      .then((updated) => {
        queryClient.setQueryData(['shelf', customerId], updated);
        localStorage.setItem(MIGRATED_KEY, customerId);
      })
      .catch(() => {
        // Leave unmigrated — retried on next mount/login.
      });
  }, [customerId, serverData, queryClient]);

  const shelfState: ShelfState = customerId && serverData ? serverToShelfState(serverData) : guestState;

  // Persist guest state on change (server state is already persisted server-side).
  useEffect(() => {
    if (!customerId) saveGuestState(guestState);
  }, [guestState, customerId]);

  // Tier-up toast — cosmetic only, driven by whichever xp value is active.
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const prevTierRef = useRef<string>(getTierName(shelfState.xp));
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const newTier = getTierName(shelfState.xp);
    if (newTier !== prevTierRef.current) {
      prevTierRef.current = newTier;
      setToastMsg(`¡Subiste de rango! Ahora eres ${newTier} 🎉`);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000);
    }
  }, [shelfState.xp]);

  const awardXP = useCallback((amount: number, label: string) => {
    if (customerId) {
      postAwardXp(customerId)
        .then((updated) => queryClient.setQueryData(['shelf', customerId], updated))
        .catch(() => {
          // Non-fatal — XP is cosmetic; next shelf refetch will reconcile.
        });
      return;
    }
    setGuestState((prev) => {
      const event: XPEvent = { label, xp: amount, at: new Date().toISOString() };
      return {
        ...prev,
        xp: prev.xp + amount,
        recentXPEvents: [event, ...prev.recentXPEvents].slice(0, 10),
      };
    });
  }, [customerId, queryClient]);

  const setShelfStatus = useCallback((slug: string, name: string, status: ShelfStatus) => {
    if (customerId) {
      putShelfStatus(customerId, slug, status)
        .then((updated) => queryClient.setQueryData(['shelf', customerId], updated))
        .catch(() => {
          // Non-fatal — next shelf refetch will reconcile the real state.
        });
      return;
    }

    setGuestState((prev) => {
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
  }, [customerId, queryClient]);

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
