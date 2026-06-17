import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../components/ui/index.js';
import { useToast } from '../components/ui/index.js';
import type { SellerSession } from '../App.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmtPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

interface RawPayload {
  name?: string;
  images?: string[];
  url?: string;
  description?: string;
  variants?: { priceMinorUnits?: number; currency?: string; stock?: number; sku?: string }[];
}

interface Candidate {
  productId: string;
  name: string;
  score: number;
  bggId: string | null;
  image: string | null;
  publisher: string | null;
  yearPublished: number | null;
}

interface SearchResult {
  id: string;
  name: string;
  yearPublished: number | null;
  publisher: string | null;
  bggId: string | null;
  images: string[];
}

interface Selected {
  productId: string;
  name: string;
  image?: string | null;
  yearPublished?: number | null;
  publisher?: string | null;
  score?: number;
}

interface Mapping {
  id: string;
  sellerSku: string | null;
  rawPayload: RawPayload;
  candidates: Candidate[] | null;
  createdAt: string;
}

export default function ProductMappingPage({ session }: { session: SellerSession }) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/v1/sellers/${session.seller.id}/product-mappings?status=pending_review&limit=50`,
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
      const data = (await res.json()) as { data?: Mapping[]; total?: number };
      setMappings(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [session.seller.id, session.token]);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  async function resolveAndRemove(mappingId: string, action: () => Promise<Response>, successMsg: string) {
    try {
      const res = await action();
      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== mappingId));
        setTotal((t) => Math.max(0, t - 1));
        toast(successMsg, 'success');
      } else {
        toast('No se pudo completar la acción', 'error');
      }
    } catch {
      toast('Error de conexión', 'error');
    }
  }

  function linkMapping(mappingId: string, productId: string) {
    return resolveAndRemove(
      mappingId,
      () => fetch(`${API}/api/v1/sellers/${session.seller.id}/product-mappings/${mappingId}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ productId }),
      }),
      'Vinculado — publicalo desde Productos cuando estés listo',
    );
  }

  function escalateMapping(mappingId: string, note: string) {
    return resolveAndRemove(
      mappingId,
      () => fetch(`${API}/api/v1/sellers/${session.seller.id}/product-mappings/${mappingId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ note }),
      }),
      'Enviado al equipo de catálogo para revisión',
    );
  }

  function dismissMapping(mappingId: string) {
    return resolveAndRemove(
      mappingId,
      () => fetch(`${API}/api/v1/sellers/${session.seller.id}/product-mappings/${mappingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      }),
      'Descartado',
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Vincular productos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total > 0
                ? `${total.toLocaleString('es-AR')} producto${total === 1 ? '' : 's'} esperando tu confirmación`
                : 'Productos sincronizados que necesitan vincularse al catálogo'}
            </p>
          </div>
          <button
            onClick={fetchMappings}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300
                       rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 overflow-auto">
        {loading && mappings.length === 0 && (
          <div className="py-20 text-center text-slate-400 text-sm">Cargando…</div>
        )}

        {!loading && mappings.length === 0 && (
          <div className="py-20 text-center space-y-2">
            <p className="text-4xl">✓</p>
            <p className="font-medium text-slate-600">Todo vinculado</p>
            <p className="text-xs text-slate-400">No hay productos pendientes de revisión.</p>
          </div>
        )}

        <div className="grid gap-4 max-w-3xl">
          {mappings.map((m) => (
            <MappingCard
              key={m.id}
              mapping={m}
              sellerId={session.seller.id}
              token={session.token}
              onLink={(productId) => linkMapping(m.id, productId)}
              onEscalate={(note) => escalateMapping(m.id, note)}
              onDismiss={() => dismissMapping(m.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MappingCard({
  mapping, sellerId, token, onLink, onEscalate, onDismiss,
}: {
  mapping: Mapping;
  sellerId: string;
  token: string;
  onLink: (productId: string) => Promise<void>;
  onEscalate: (note: string) => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Selected | null>(null);

  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API}/api/v1/sellers/${sellerId}/product-mappings/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSearchResults(res.ok ? (await res.json()) as SearchResult[] : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q, sellerId, token]);

  async function handleConfirm() {
    if (!selected) return;
    setBusy(true);
    try { await onLink(selected.productId); } finally { setBusy(false); }
  }

  async function handleEscalate() {
    setBusy(true);
    try { await onEscalate(note); } finally { setBusy(false); }
  }

  const name = mapping.rawPayload?.name ?? 'Producto sin nombre';
  const image = mapping.rawPayload?.images?.[0];
  const variant = mapping.rawPayload?.variants?.[0];
  const candidates = mapping.candidates ?? [];

  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-opacity',
      busy && 'opacity-50 pointer-events-none',
    )}>
      {/* Side-by-side comparison: your product vs the selected proposal */}
      <div className="grid sm:grid-cols-2 gap-3 p-5 pb-0">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Tu producto</p>
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              {image ? <img src={image} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
              {variant?.priceMinorUnits != null && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {fmtPrice(variant.priceMinorUnits, variant.currency)}
                  {variant.stock != null ? ` · stock ${variant.stock}` : ''}
                </p>
              )}
              {mapping.sellerSku && <p className="text-xs text-slate-400 font-mono mt-0.5">{mapping.sellerSku}</p>}
            </div>
          </div>
        </div>

        <div className={cn('rounded-lg border p-3', selected ? 'border-emerald-300' : 'border-slate-200')}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Propuesta</p>
          {!selected ? (
            <p className="text-xs text-slate-400 py-2.5">Elegí una opción abajo para comparar ↓</p>
          ) : (
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                {selected.image ? <img src={selected.image} alt={selected.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{selected.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.publisher ?? ''}{selected.publisher && selected.yearPublished ? ' · ' : ''}{selected.yearPublished ?? ''}
                </p>
                {selected.score != null && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{Math.round(selected.score * 100)}% similitud</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="flex gap-2 px-5 pt-3">
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            Confirmar vínculo
          </button>
          <button
            onClick={() => setSelected(null)}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="px-5 pb-5 pt-3 space-y-3">
        {candidates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              ¿Es alguno de estos?
            </p>
            <div className="space-y-1.5">
              {candidates.map((c) => (
                <button
                  key={c.productId}
                  onClick={() => setSelected({ productId: c.productId, name: c.name, image: c.image, yearPublished: c.yearPublished, publisher: c.publisher, score: c.score })}
                  disabled={busy}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors text-left',
                    selected?.productId === c.productId
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300',
                  )}
                >
                  <span className="text-sm text-slate-800 truncate">{c.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5 tabular">
                    {Math.round(c.score * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          {candidates.length > 0 && (
            <p className="text-xs text-slate-400 mb-1.5">Ninguno coincide — buscá manualmente:</p>
          )}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en el catálogo…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white
                       focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent placeholder-slate-400"
          />
          {searching && <p className="text-xs text-slate-400 mt-1.5">Buscando…</p>}
          {searchResults && searchResults.length === 0 && !searching && (
            <p className="text-xs text-slate-400 mt-1.5">Sin resultados.</p>
          )}
          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected({ productId: r.id, name: r.name, image: r.images?.[0], yearPublished: r.yearPublished, publisher: r.publisher })}
                  disabled={busy}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors text-left',
                    selected?.productId === r.id
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300',
                  )}
                >
                  <span className="text-sm text-slate-800 truncate">{r.name}</span>
                  {r.yearPublished && (
                    <span className="shrink-0 text-xs text-slate-400 tabular">{r.yearPublished}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          {!showEscalate ? (
            <button
              onClick={() => setShowEscalate(true)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              No lo encuentro, pedir nuevo producto
            </button>
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota para el equipo de catálogo (opcional)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                onClick={handleEscalate}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
              >
                Enviar
              </button>
            </div>
          )}
          <button
            onClick={onDismiss}
            disabled={busy}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-3 shrink-0"
            title="Descartar — no listar este producto"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
}
