import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type AdminView = 'sellers' | 'catalog' | 'orders' | 'bgg' | 'ranking';

const NAV: { id: AdminView; icon: string; label: string }[] = [
  { id: 'sellers',  icon: '🏪', label: 'Vendedores' },
  { id: 'catalog',  icon: '📚', label: 'Catálogo' },
  { id: 'orders',   icon: '📋', label: 'Pedidos' },
  { id: 'bgg',      icon: '🎲', label: 'BGG Import' },
  { id: 'ranking',  icon: '⭐', label: 'Ranking' },
];

export default function App() {
  const [view, setView] = useState<AdminView>('sellers');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-52 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-sm font-bold text-white">🎲 BGM Admin</p>
          <p className="text-xs text-slate-400 mt-0.5">Consola de administración</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                view === item.id
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <a
            href={`${API}/api/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            📄 Swagger API Docs
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {view === 'sellers'  && <SellersView />}
        {view === 'catalog'  && <CatalogView />}
        {view === 'orders'   && <OrdersView />}
        {view === 'bgg'      && <BggImportView />}
        {view === 'ranking'  && <RankingView />}
      </main>
    </div>
  );
}

// ─── Sellers ──────────────────────────────────────────────────────────────────

function SellersView() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', statusFilter],
    queryFn: async () => {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/api/v1/sellers${qs}`);
      return res.json() as Promise<Seller[]>;
    },
  });

  const sellers = data ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Vendedores</h1>
        <div className="flex gap-2">
          {(['', 'pending', 'active', 'suspended'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : sellers.length === 0 ? (
          <Empty icon="🏪" msg="No hay vendedores registrados aún." />
        ) : (
          <table className="w-full text-sm">
            <Thead cols={['Nombre', 'Email', 'Estado', 'Conector', 'Comisión', 'Onboarding']} />
            <tbody className="divide-y divide-slate-100">
              {sellers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{s.connectorType ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{(Number(s.commissionRate) * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{s.onboardingStep ?? 'complete'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Catalog matching queue ────────────────────────────────────────────────────

function CatalogView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-catalog', statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `${API}/api/v1/admin/catalog/products?status=${statusFilter}&limit=50`,
      );
      return res.json() as Promise<{ products: MktProduct[]; total: number }>;
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${API}/api/v1/admin/catalog/products/${id}/reindex`, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-catalog'] }),
  });

  const products = (data?.products ?? []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Catálogo — Cola de revisión</h1>
        <div className="flex gap-2 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nombre..."
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
          />
          {(['pending', 'verified', 'duplicate'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : products.length === 0 ? (
          <Empty icon="📚" msg={`No hay productos con estado "${statusFilter}".`} />
        ) : (
          <table className="w-full text-sm">
            <Thead cols={['Nombre', 'BGG ID', 'Categoría', 'Listings', 'Estado', 'Acción']} />
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.bggId ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.category}</td>
                  <td className="px-4 py-3 text-slate-500">{p._count?.listings ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.canonicalStatus} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => approveMut.mutate(p.id)}
                      disabled={approveMut.isPending}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Reindexar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function OrdersView() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/v1/checkout/admin/orders?limit=50`);
      return res.json() as Promise<{ orders: Order[]; total: number }>;
    },
  });

  const orders = data?.orders ?? [];

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Pedidos</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : orders.length === 0 ? (
          <Empty icon="📋" msg="Todavía no hay pedidos en el marketplace." />
        ) : (
          <table className="w-full text-sm">
            <Thead cols={['ID', 'Cliente', 'Vendedor', 'Total', 'Estado', 'Fecha']} />
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(-8)}</td>
                  <td className="px-4 py-3 text-slate-600">{o.customer?.email ?? 'guest'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.seller?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {fmt(o.totalMinorUnits, o.currency)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── BGG Import ───────────────────────────────────────────────────────────────

function BggImportView() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [bulkIds, setBulkIds] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ['bgg-search', q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const res = await fetch(`${API}/api/v1/admin/catalog/bgg/search?q=${encodeURIComponent(q)}`);
      return res.json() as Promise<BggResult[]>;
    },
    enabled: !!q.trim(),
  });

  const importMut = useMutation({
    mutationFn: async (bggId: string) => {
      const res = await fetch(`${API}/api/v1/admin/catalog/import/bgg/${bggId}`, { method: 'POST' });
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(`Importado: ${(data as { name?: string }).name ?? 'OK'}`);
      qc.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
  });

  const bulkMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`${API}/api/v1/admin/catalog/import/bgg/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bggIds: ids }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const d = data as { imported?: number; failed?: number };
      setImportResult(`Bulk: ${d.imported ?? 0} importados, ${d.failed ?? 0} fallaron`);
      setBulkIds('');
      qc.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">Importar desde BoardGameGeek</h1>

      {importResult && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          ✓ {importResult}
        </div>
      )}

      {/* Search BGG */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Buscar en BGG</h2>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: Catan, Terraforming Mars..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        {searchQuery.isLoading && <p className="text-sm text-slate-400">Buscando...</p>}
        {searchQuery.data && searchQuery.data.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {searchQuery.data.map((r) => (
              <div key={r.bggId} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-sm text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-400">BGG #{r.bggId}{r.yearPublished ? ` · ${r.yearPublished}` : ''}</p>
                </div>
                <button
                  onClick={() => importMut.mutate(r.bggId)}
                  disabled={importMut.isPending}
                  className="px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 shrink-0"
                >
                  Importar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk import */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Importación masiva por BGG IDs</h2>
        <textarea
          value={bulkIds}
          onChange={(e) => setBulkIds(e.target.value)}
          placeholder="IDs separados por comas o salto de línea&#10;Ej: 13,822,167791,224517"
          rows={4}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
        />
        <button
          onClick={() => {
            const ids = bulkIds
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            if (ids.length) bulkMut.mutate(ids);
          }}
          disabled={bulkMut.isPending || !bulkIds.trim()}
          className="px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {bulkMut.isPending ? `Importando... (puede tardar)` : 'Importar IDs'}
        </button>
      </div>
    </div>
  );
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

function RankingView() {
  const [jobResult, setJobResult] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  async function triggerRanking() {
    setTriggering(true);
    try {
      const res = await fetch(`${API}/api/v1/admin/rankings/trigger`, { method: 'POST' });
      const data = await res.json() as { jobId?: string };
      setJobResult(`Job encolado: ${data.jobId}`);
    } catch {
      setJobResult('Error al encolar el job.');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">Ranking</h1>

      {jobResult && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          ✓ {jobResult}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Pase de ranking</h2>
        <p className="text-sm text-slate-500">
          El ranking se recalcula automáticamente cada hora. Podés forzar un pase manual en cualquier momento.
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Frecuencia', 'Cada hora (BullMQ)'],
            ['Dimensiones', '6 (disponibilidad, precio, entrega, confiabilidad, calidad, integración)'],
            ['Descalificadores', 'Seller inactivo / sync > 24h'],
            ['Persistencia', 'rankScore + scoreBreakdown en Listing + Typesense'],
          ].map(([k, v]) => (
            <div key={k} className="col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k}</p>
              <p className="text-slate-700 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <button
          onClick={triggerRanking}
          disabled={triggering}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {triggering ? '⏳ Encolando...' : '⭐ Recalcular ranking ahora'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Pesos del ranking (actuales)</h2>
        <div className="space-y-2">
          {[
            ['Disponibilidad', 25],
            ['Precio competitivo', 20],
            ['Entrega', 20],
            ['Confiabilidad del vendedor', 20],
            ['Calidad del vendedor', 10],
            ['Salud de integración', 5],
          ].map(([label, pct]) => (
            <div key={label as string} className="flex items-center gap-3">
              <span className="text-sm text-slate-600 w-52 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${pct as number}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-700 w-10 text-right">{pct}%</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 pt-2">
          Los pesos se configuran en <code>libs/domain/rankings/src/ranking.ts</code> — Epic 8 roadmap: UI editable con guardado en DB.
        </p>
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Thead({ cols }: { cols: string[] }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        {cols.map((h) => (
          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:   'bg-emerald-100 text-emerald-700',
    pending:  'bg-amber-100 text-amber-700',
    verified: 'bg-emerald-100 text-emerald-700',
    suspended:'bg-red-100 text-red-700',
    cancelled:'bg-red-100 text-red-600',
    confirmed:'bg-blue-100 text-blue-700',
    shipped:  'bg-indigo-100 text-indigo-700',
    delivered:'bg-emerald-100 text-emerald-700',
    duplicate:'bg-slate-100 text-slate-500',
    churned:  'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function Loading() {
  return <div className="text-center py-12 text-slate-400 text-sm">Cargando...</div>;
}

function Empty({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm">{msg}</p>
    </div>
  );
}

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Seller {
  id: string; name: string; email: string; status: string;
  connectorType: string | null; commissionRate: number;
  onboardingStep: string | null;
}

interface MktProduct {
  id: string; name: string; bggId: string | null;
  category: string; canonicalStatus: string;
  _count?: { listings: number };
}

interface Order {
  id: string; status: string; currency: string;
  totalMinorUnits: number; createdAt: string;
  customer?: { email: string } | null;
  seller?: { name: string } | null;
}

interface BggResult {
  bggId: string; name: string; yearPublished?: number;
}
