import { useState, useEffect, useCallback, useRef } from 'react';
import type { SellerSession } from '../App.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const MARKETPLACE = import.meta.env.VITE_MARKETPLACE_URL ?? 'http://localhost:4300';
const PAGE_SIZE = 24;

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListingPromo {
  id: string;
  bonusCashbackPct: number;
  label: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

interface Listing {
  id: string;
  sellerSku: string | null;
  sellerUrl: string | null;
  priceMinorUnits: number;
  currency: string;
  stock: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  active: boolean;
  lastSyncedAt: string | null;
  product: {
    id: string;
    name: string;
    images: string[];
    description: string | null;
    category: string;
    slug: string;
    tags: string[];
  };
}

interface Stats {
  total: number;
  active: number;
  outOfStock: number;
  lowStock: number;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'out_of_stock' | 'low_stock';
type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function timeAgo(iso: string | null) {
  if (!iso) return 'nunca';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function isPromoCurrentlyActive(promo: ListingPromo): boolean {
  if (!promo.active) return false;
  const now = new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) return false;
  if (promo.endsAt && new Date(promo.endsAt) < now) return false;
  return true;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ListingsPage({ session }: { session: SellerSession }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // tracks which listing IDs have at least one currently-active promo (lazy, populated when modal opens)
  const [promoMap, setPromoMap] = useState<Record<string, boolean>>({});

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q]);

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/listings/stats`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.json())
      .then((s) => setStats(s as Stats))
      .catch(() => null);
  }, [session.seller.id, session.token]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort,
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API}/api/v1/sellers/${session.seller.id}/listings?${params}`);
      const data = (await res.json()) as { data?: Listing[]; total?: number };
      setListings(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [session.seller.id, page, debouncedQ, statusFilter, sort]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  async function toggleActive(listing: Listing) {
    setSavingId(listing.id);
    try {
      await fetch(`${API}/api/v1/sellers/${session.seller.id}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !listing.active }),
      });
      setListings((prev) =>
        prev.map((l) => l.id === listing.id ? { ...l, active: !l.active } : l)
      );
      setStats((s) => s ? { ...s, active: s.active + (listing.active ? -1 : 1) } : s);
    } finally {
      setSavingId(null);
    }
  }

  function handlePromosFetched(listingId: string, promos: ListingPromo[]) {
    const hasActive = promos.some(isPromoCurrentlyActive);
    setPromoMap((prev) => ({ ...prev, [listingId]: hasActive }));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Productos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total.toLocaleString('es-AR')} productos en catálogo
            </p>
          </div>
          <button
            onClick={fetchListings}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300
                       rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 space-y-5 overflow-auto">
        {/* Stats */}
        {stats && <StatsBar stats={stats} onFilter={setStatusFilter} activeFilter={statusFilter} />}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white
                         focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent
                         placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all',          label: 'Todos'      },
                { id: 'active',       label: 'Activos'    },
                { id: 'inactive',     label: 'Inactivos'  },
                { id: 'low_stock',    label: 'Stock bajo' },
                { id: 'out_of_stock', label: 'Sin stock'  },
              ] as { id: StatusFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => { setStatusFilter(f.id); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:text-slate-800'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white
                         text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="recent">Más recientes</option>
              <option value="price_desc">Mayor precio</option>
              <option value="price_asc">Menor precio</option>
              <option value="stock_desc">Mayor stock</option>
              <option value="stock_asc">Menor stock</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && listings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400">
                      <p className="text-sm">Cargando productos…</p>
                    </td>
                  </tr>
                )}
                {!loading && listings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400">
                      <p className="font-medium text-slate-500">Sin resultados</p>
                      <p className="text-xs mt-1">Probá cambiando los filtros</p>
                    </td>
                  </tr>
                )}
                {listings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    onToggleActive={() => toggleActive(listing)}
                    onEdit={() => setEditListing(listing)}
                    isSaving={savingId === listing.id}
                    hasActivePromo={promoMap[listing.id] ?? false}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-500">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600
                             hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-600 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium tabular">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600
                             hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editListing && (
        <EditModal
          listing={editListing}
          sellerId={session.seller.id}
          token={session.token}
          onClose={() => setEditListing(null)}
          onSaved={(updated) => {
            setListings((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setEditListing(null);
          }}
          onPromosFetched={handlePromosFetched}
        />
      )}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
  stats, onFilter, activeFilter,
}: { stats: Stats; onFilter: (f: StatusFilter) => void; activeFilter: StatusFilter }) {
  const cards = [
    { id: 'all'          as StatusFilter, label: 'Total',      value: stats.total,      dot: 'bg-slate-400'   },
    { id: 'active'       as StatusFilter, label: 'Activos',    value: stats.active,     dot: 'bg-emerald-500' },
    { id: 'low_stock'    as StatusFilter, label: 'Stock bajo', value: stats.lowStock,   dot: 'bg-amber-400'   },
    { id: 'out_of_stock' as StatusFilter, label: 'Sin stock',  value: stats.outOfStock, dot: 'bg-red-400'     },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const isActive = activeFilter === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onFilter(c.id)}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              isActive
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
              <p className={cn('text-xs font-medium', isActive ? 'text-slate-400' : 'text-slate-500')}>
                {c.label}
              </p>
            </div>
            <p className={cn('text-2xl font-semibold tabular', isActive ? 'text-white' : 'text-slate-900')}>
              {c.value.toLocaleString('es-AR')}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Listing row ──────────────────────────────────────────────────────────────

function ListingRow({
  listing, onToggleActive, onEdit, isSaving, hasActivePromo,
}: {
  listing: Listing;
  onToggleActive: () => void;
  onEdit: () => void;
  isSaving: boolean;
  hasActivePromo: boolean;
}) {
  const stockClass =
    listing.stockStatus === 'in_stock'     ? 'text-emerald-700 bg-emerald-50' :
    listing.stockStatus === 'low_stock'    ? 'text-amber-700 bg-amber-50'     :
    listing.stockStatus === 'out_of_stock' ? 'text-red-700 bg-red-50'         :
    'text-slate-500 bg-slate-50';

  const stockLabel =
    listing.stockStatus === 'out_of_stock' ? 'Sin stock'          :
    listing.stockStatus === 'low_stock'    ? `${listing.stock} — bajo` :
    listing.stock >= 999                   ? 'Sin límite'         : String(listing.stock);

  return (
    <tr className={cn('group hover:bg-slate-50/60 transition-colors', !listing.active && 'opacity-50')}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0">
            {listing.product.images[0] ? (
              <img
                src={listing.product.images[0]}
                alt={listing.product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-200" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900 truncate max-w-[200px]">{listing.product.name}</p>
              {hasActivePromo && (
                <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  PROMO
                </span>
              )}
            </div>
            {listing.sellerSku && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{listing.sellerSku}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium capitalize">
          {listing.product.category}
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="font-semibold text-slate-900 tabular">
          {fmtPrice(listing.priceMinorUnits, listing.currency)}
        </span>
      </td>

      <td className="px-4 py-3 text-center">
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', stockClass)}>
          {stockLabel}
        </span>
      </td>

      <td className="px-4 py-3 text-center">
        <button
          onClick={onToggleActive}
          disabled={isSaving}
          title={listing.active ? 'Desactivar' : 'Activar'}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-60',
            listing.active ? 'bg-emerald-500' : 'bg-slate-300'
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
            listing.active ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </button>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Editar
          </button>
          {listing.product.slug && (
            <a
              href={`${MARKETPLACE}/product/${listing.product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              Ver ↗
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  listing, sellerId, token, onClose, onSaved, onPromosFetched,
}: {
  listing: Listing;
  sellerId: string;
  token: string;
  onClose: () => void;
  onSaved: (updated: Partial<Listing> & { id: string }) => void;
  onPromosFetched: (listingId: string, promos: ListingPromo[]) => void;
}) {
  const [price, setPrice] = useState(String(listing.priceMinorUnits / 100));
  const [stock, setStock] = useState(String(listing.stock));
  const [active, setActive] = useState(listing.active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Promos state
  const [promos, setPromos] = useState<ListingPromo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [showNewPromo, setShowNewPromo] = useState(false);
  const [newBonusPct, setNewBonusPct] = useState(5);
  const [newLabel, setNewLabel] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [savingPromo, setSavingPromo] = useState(false);
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null);
  const [togglingPromoId, setTogglingPromoId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${sellerId}/listings/${listing.id}/promos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data: ListingPromo[]) => {
        const list = Array.isArray(data) ? data : [];
        setPromos(list);
        onPromosFetched(listing.id, list);
      })
      .catch(() => setPromos([]))
      .finally(() => setLoadingPromos(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, listing.id, token]);

  function updatePromos(updated: ListingPromo[]) {
    setPromos(updated);
    onPromosFetched(listing.id, updated);
  }

  async function handleCreatePromo() {
    setSavingPromo(true);
    try {
      const res = await fetch(`${API}/api/v1/sellers/${sellerId}/listings/${listing.id}/promos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bonusCashbackPct: newBonusPct / 100,
          ...(newLabel ? { label: newLabel } : {}),
          ...(newStartsAt ? { startsAt: newStartsAt } : {}),
          ...(newEndsAt ? { endsAt: newEndsAt } : {}),
        }),
      });
      if (res.ok) {
        const created = await res.json() as ListingPromo;
        updatePromos([created, ...promos]);
        setShowNewPromo(false);
        setNewBonusPct(5);
        setNewLabel('');
        setNewStartsAt('');
        setNewEndsAt('');
      }
    } finally {
      setSavingPromo(false);
    }
  }

  async function handleTogglePromo(promo: ListingPromo) {
    setTogglingPromoId(promo.id);
    try {
      const res = await fetch(`${API}/api/v1/sellers/${sellerId}/listings/${listing.id}/promos/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !promo.active }),
      });
      if (res.ok) {
        updatePromos(promos.map((p) => p.id === promo.id ? { ...p, active: !p.active } : p));
      }
    } finally {
      setTogglingPromoId(null);
    }
  }

  async function handleDeletePromo(promoId: string) {
    setDeletingPromoId(promoId);
    try {
      const res = await fetch(`${API}/api/v1/sellers/${sellerId}/listings/${listing.id}/promos/${promoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        updatePromos(promos.filter((p) => p.id !== promoId));
      }
    } finally {
      setDeletingPromoId(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const priceMinorUnits = Math.round(parseFloat(price) * 100);
      const stockNum = parseInt(stock, 10);
      const res = await fetch(`${API}/api/v1/sellers/${sellerId}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceMinorUnits: isNaN(priceMinorUnits) ? undefined : priceMinorUnits,
          stock: isNaN(stockNum) ? undefined : stockNum,
          active,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          onSaved({
            id: listing.id,
            priceMinorUnits: isNaN(priceMinorUnits) ? listing.priceMinorUnits : priceMinorUnits,
            stock: isNaN(stockNum) ? listing.stock : stockNum,
            active,
            stockStatus: stockNum === 0 ? 'out_of_stock' : stockNum <= 3 ? 'low_stock' : 'in_stock',
          });
        }, 500);
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
            {listing.product.images[0] ? (
              <img src={listing.product.images[0]} alt={listing.product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-200" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 leading-tight truncate">{listing.product.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {listing.sellerSku && (
                <span className="text-xs font-mono text-slate-400">{listing.sellerSku}</span>
              )}
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full capitalize">
                {listing.product.category}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none text-slate-400 hover:text-slate-700 transition-colors px-1"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Precio ({listing.currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0"
                className="w-full pl-7 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Actual: {fmtPrice(listing.priceMinorUnits, listing.currency)}
            </p>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Stock disponible
            </label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min="0"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1">Usá 999 para stock ilimitado.</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-900">Activo en marketplace</p>
              <p className="text-xs text-slate-500 mt-0.5">Visible para compradores</p>
            </div>
            <button
              onClick={() => setActive((a) => !a)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                active ? 'bg-emerald-500' : 'bg-slate-300'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
                active ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>

          {/* ── Promos section ── */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Cashback por producto
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Se suma al cashback base de tu tienda, solo para este producto
                </p>
              </div>
              {!showNewPromo && (
                <button
                  onClick={() => setShowNewPromo(true)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors shrink-0 ml-3"
                >
                  + Nueva
                </button>
              )}
            </div>

            {/* Existing promos list */}
            {loadingPromos ? (
              <p className="text-xs text-slate-400 py-2">Cargando promos…</p>
            ) : promos.length === 0 && !showNewPromo ? (
              <p className="text-xs text-slate-400 py-2 italic">
                Sin promos — el cashback base de tu tienda aplica normalmente.
              </p>
            ) : (
              <div className="space-y-2">
                {promos.map((promo) => {
                  const nowActive = isPromoCurrentlyActive(promo);
                  return (
                    <div
                      key={promo.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border text-xs transition-colors',
                        nowActive
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      {/* Bonus pct */}
                      <span className={cn(
                        'text-base font-bold tabular shrink-0',
                        nowActive ? 'text-emerald-600' : 'text-slate-400'
                      )}>
                        +{Math.round(promo.bonusCashbackPct * 100)}%
                      </span>

                      {/* Label + dates */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {promo.label && (
                            <span className="text-slate-700 font-medium truncate">{promo.label}</span>
                          )}
                          {nowActive && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">
                              ACTIVA
                            </span>
                          )}
                          {!promo.active && (
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                              PAUSADA
                            </span>
                          )}
                        </div>
                        {(promo.startsAt || promo.endsAt) && (
                          <p className="text-slate-400 mt-0.5">
                            {promo.startsAt ? fmtDate(promo.startsAt) : '∞'} → {promo.endsAt ? fmtDate(promo.endsAt) : '∞'}
                          </p>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleTogglePromo(promo)}
                          disabled={togglingPromoId === promo.id}
                          title={promo.active ? 'Pausar' : 'Activar'}
                          className={cn(
                            'relative w-8 h-4 rounded-full transition-colors duration-200 disabled:opacity-50',
                            promo.active ? 'bg-emerald-500' : 'bg-slate-300'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200',
                            promo.active ? 'translate-x-4' : 'translate-x-0.5'
                          )} />
                        </button>
                        <button
                          onClick={() => handleDeletePromo(promo.id)}
                          disabled={deletingPromoId === promo.id}
                          title="Eliminar promo"
                          className="text-slate-300 hover:text-red-400 transition-colors text-base leading-none disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New promo form */}
            {showNewPromo && (
              <div className="mt-3 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3.5">
                {/* Bonus slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Cashback extra
                    </label>
                    <span className="text-lg font-bold text-emerald-600 tabular">+{newBonusPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={1} max={15} step={0.5}
                    value={newBonusPct}
                    onChange={(e) => setNewBonusPct(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>1%</span><span>15%</span>
                  </div>
                </div>

                {/* Label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Etiqueta <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ej: Liquidación de verano"
                    maxLength={60}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white
                               focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Inicio <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={newStartsAt}
                      onChange={(e) => setNewStartsAt(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Fin <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={newEndsAt}
                      onChange={(e) => setNewEndsAt(e.target.value)}
                      min={newStartsAt || undefined}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => {
                      setShowNewPromo(false);
                      setNewBonusPct(5);
                      setNewLabel('');
                      setNewStartsAt('');
                      setNewEndsAt('');
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg
                               hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreatePromo}
                    disabled={savingPromo}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg
                               hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    {savingPromo ? 'Guardando…' : 'Crear promo'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="flex gap-3">
            {listing.sellerUrl && (
              <a
                href={listing.sellerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
              >
                Ver en tienda ↗
              </a>
            )}
            {listing.product.slug && (
              <a
                href={`${MARKETPLACE}/product/${listing.product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:text-emerald-800 underline underline-offset-2"
              >
                Ver en marketplace ↗
              </a>
            )}
          </div>

          {listing.product.description && (
            <details className="text-xs text-slate-500 cursor-pointer">
              <summary className="font-medium text-slate-700 hover:text-slate-900 select-none">
                Descripción del producto
              </summary>
              <div
                className="mt-2 p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto leading-relaxed"
                dangerouslySetInnerHTML={{ __html: listing.product.description }}
              />
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <p className="text-xs text-slate-400">Sync: {timeAgo(listing.lastSyncedAt)}</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg
                         hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={cn(
                'px-5 py-2 text-sm font-semibold rounded-lg transition-all',
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-700 text-white disabled:opacity-60'
              )}
            >
              {saved ? 'Guardado' : saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
