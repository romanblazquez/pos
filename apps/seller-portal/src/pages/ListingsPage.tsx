import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, SlidersHorizontal, RefreshCw, Eye, EyeOff,
  TrendingUp, TrendingDown, Package, AlertTriangle,
  ChevronLeft, ChevronRight, ExternalLink, Edit3, X,
  Check, Loader2, ArrowUpDown, ToggleLeft, ToggleRight,
} from 'lucide-react';
import type { SellerSession } from '../App.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const MARKETPLACE = import.meta.env.VITE_MARKETPLACE_URL ?? 'http://localhost:4300';
const PAGE_SIZE = 24;

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q]);

  // Fetch stats once
  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/listings/stats`)
      .then((r) => r.json())
      .then((s) => setStats(s as Stats))
      .catch(() => null);
  }, [session.seller.id]);

  // Fetch listings
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
      const data = (await res.json()) as { listings: Listing[]; total: number };
      setListings(data.listings);
      setTotal(data.total);
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
      setStats((s) => s ? {
        ...s,
        active: s.active + (listing.active ? -1 : 1),
      } : s);
    } finally {
      setSavingId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Mis productos</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {total.toLocaleString('es-AR')} productos en tu catálogo
            </p>
          </div>
          <button
            onClick={fetchListings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700
                       bg-white border border-stone-300 rounded-lg hover:bg-stone-50
                       disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5 overflow-auto">
        {/* Stats */}
        {stats && <StatsBar stats={stats} onFilter={setStatusFilter} activeFilter={statusFilter} />}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-stone-300 rounded-lg
                         bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500
                         focus:border-transparent placeholder-stone-400"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'active', label: 'Activos' },
                { id: 'inactive', label: 'Inactivos' },
                { id: 'low_stock', label: 'Stock bajo' },
                { id: 'out_of_stock', label: 'Sin stock' },
              ] as { id: StatusFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => { setStatusFilter(f.id); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  statusFilter === f.id
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-stone-600 border-stone-300 hover:border-emerald-400 hover:text-emerald-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown size={13} className="text-stone-400" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              className="text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white
                         text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Categoría</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Precio</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && listings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-stone-400">
                      <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                      <p className="text-sm">Cargando productos…</p>
                    </td>
                  </tr>
                )}
                {!loading && listings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-stone-400">
                      <Package size={32} className="mx-auto mb-3 opacity-40" />
                      <p className="font-medium text-stone-600">Sin resultados</p>
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
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
              <p className="text-xs text-stone-500">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-stone-600 px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editListing && (
        <EditModal
          listing={editListing}
          sellerId={session.seller.id}
          onClose={() => setEditListing(null)}
          onSaved={(updated) => {
            setListings((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setEditListing(null);
          }}
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
    { id: 'all' as StatusFilter, label: 'Total', value: stats.total, icon: Package, color: 'text-stone-700', bg: 'bg-stone-100' },
    { id: 'active' as StatusFilter, label: 'Activos', value: stats.active, icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    { id: 'low_stock' as StatusFilter, label: 'Stock bajo', value: stats.lowStock, icon: TrendingDown, color: 'text-amber-700', bg: 'bg-amber-100' },
    { id: 'out_of_stock' as StatusFilter, label: 'Sin stock', value: stats.outOfStock, icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-100' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = activeFilter === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onFilter(c.id)}
            className={cn(
              'p-4 rounded-xl border text-left transition-all group',
              isActive
                ? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
                : 'bg-white border-stone-200 hover:border-emerald-300 hover:shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={cn('text-xs font-medium', isActive ? 'text-emerald-200' : 'text-stone-500')}>
                {c.label}
              </p>
              <span className={cn('p-1.5 rounded-lg', isActive ? 'bg-emerald-600' : c.bg)}>
                <Icon size={13} className={isActive ? 'text-emerald-200' : c.color} />
              </span>
            </div>
            <p className={cn('text-2xl font-bold', isActive ? 'text-white' : 'text-stone-900')}>
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
  listing, onToggleActive, onEdit, isSaving,
}: {
  listing: Listing;
  onToggleActive: () => void;
  onEdit: () => void;
  isSaving: boolean;
}) {
  const stockBadge =
    listing.stockStatus === 'in_stock' ? 'bg-emerald-100 text-emerald-700' :
    listing.stockStatus === 'low_stock' ? 'bg-amber-100 text-amber-700' :
    listing.stockStatus === 'out_of_stock' ? 'bg-red-100 text-red-700' :
    'bg-stone-100 text-stone-500';

  return (
    <tr className={cn(
      'group hover:bg-stone-50/60 transition-colors',
      !listing.active && 'opacity-50'
    )}>
      {/* Product */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 shrink-0">
            {listing.product.images[0] ? (
              <img
                src={listing.product.images[0]}
                alt={listing.product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-base">🎲</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-stone-900 truncate max-w-[220px]">{listing.product.name}</p>
            {listing.sellerSku && (
              <p className="text-xs text-stone-400 mt-0.5 font-mono">SKU: {listing.sellerSku}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium capitalize">
          {listing.product.category}
        </span>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right">
        <span className="font-semibold text-stone-900">
          {fmtPrice(listing.priceMinorUnits, listing.currency)}
        </span>
      </td>

      {/* Stock */}
      <td className="px-4 py-3 text-center">
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', stockBadge)}>
          {listing.stockStatus === 'out_of_stock' ? 'Sin stock' :
           listing.stockStatus === 'low_stock' ? `${listing.stock} (bajo)` :
           listing.stock >= 999 ? '∞' : listing.stock}
        </span>
      </td>

      {/* Active toggle */}
      <td className="px-4 py-3 text-center">
        <button
          onClick={onToggleActive}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-60"
          title={listing.active ? 'Desactivar' : 'Activar'}
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin text-stone-400" />
          ) : listing.active ? (
            <ToggleRight size={22} className="text-emerald-600" />
          ) : (
            <ToggleLeft size={22} className="text-stone-400" />
          )}
        </button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            title="Editar"
          >
            <Edit3 size={14} />
          </button>
          {listing.product.slug && (
            <a
              href={`${MARKETPLACE}/product/${listing.product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Ver en marketplace"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {listing.sellerUrl && (
            <a
              href={listing.sellerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              title="Ver en tu tienda"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  listing, sellerId, onClose, onSaved,
}: {
  listing: Listing;
  sellerId: string;
  onClose: () => void;
  onSaved: (updated: Partial<Listing>) => void;
}) {
  const [price, setPrice] = useState(String(listing.priceMinorUnits / 100));
  const [stock, setStock] = useState(String(listing.stock));
  const [active, setActive] = useState(listing.active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
            priceMinorUnits: isNaN(priceMinorUnits) ? listing.priceMinorUnits : priceMinorUnits,
            stock: isNaN(stockNum) ? listing.stock : stockNum,
            active,
            stockStatus: stockNum === 0 ? 'out_of_stock' : stockNum <= 3 ? 'low_stock' : 'in_stock',
          });
        }, 600);
      }
    } finally {
      setSaving(false);
    }
  }

  // Close on backdrop click or Escape
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className="flex items-start gap-4 p-5 border-b border-stone-100">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 shrink-0">
            {listing.product.images[0] ? (
              <img src={listing.product.images[0]} alt={listing.product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🎲</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-stone-900 leading-tight">{listing.product.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {listing.sellerSku && (
                <span className="text-xs font-mono text-stone-400">SKU: {listing.sellerSku}</span>
              )}
              <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full capitalize">
                {listing.product.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-5 space-y-4">
          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">
              Precio ({listing.currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0"
                className="w-full pl-7 pr-4 py-2.5 border border-stone-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Precio actual: {fmtPrice(listing.priceMinorUnits, listing.currency)}
            </p>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">
              Stock disponible
            </label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min="0"
              className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-stone-400 mt-1">Ponete 999 si no manejás stock exacto.</p>
          </div>

          {/* Active */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
            <div>
              <p className="text-sm font-semibold text-stone-900">Producto activo</p>
              <p className="text-xs text-stone-500">Visible en el marketplace</p>
            </div>
            <button
              onClick={() => setActive((a) => !a)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200',
                active ? 'bg-emerald-600' : 'bg-stone-300'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                active ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>

          {/* Links */}
          <div className="flex gap-2">
            {listing.sellerUrl && (
              <a
                href={listing.sellerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 underline-offset-2 hover:underline"
              >
                <ExternalLink size={11} /> Ver en Tiendanube
              </a>
            )}
            {listing.product.slug && (
              <a
                href={`${MARKETPLACE}/product/${listing.product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 underline-offset-2 hover:underline"
              >
                <ExternalLink size={11} /> Ver en marketplace
              </a>
            )}
          </div>

          {listing.product.description && (
            <details className="text-xs text-stone-500 cursor-pointer">
              <summary className="font-medium text-stone-700 hover:text-stone-900 select-none">Descripción del producto</summary>
              <div
                className="mt-2 p-3 bg-stone-50 rounded-lg max-h-32 overflow-y-auto leading-relaxed"
                dangerouslySetInnerHTML={{ __html: listing.product.description }}
              />
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-100 bg-stone-50/50">
          <p className="text-xs text-stone-400">
            Últ. sync: {timeAgo(listing.lastSyncedAt)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg
                         hover:bg-stone-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={cn(
                'px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all',
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-60'
              )}
            >
              {saved ? (
                <><Check size={14} /> Guardado</>
              ) : saving ? (
                <><Loader2 size={14} className="animate-spin" /> Guardando…</>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
