import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, API_BASE } from './auth/api-client.js';
import { useAdminAuth } from './auth/AdminAuth.js';
import { AnalyticsView } from './analytics/AnalyticsView.js';

const API = API_BASE;
const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL ?? 'http://localhost:4300';

type AdminView = 'sellers' | 'catalog' | 'mapping' | 'orders' | 'bgg' | 'ranking' | 'markets' | 'ai-usage' | 'analytics';

const NAV: { id: AdminView; icon: string; label: string }[] = [
  { id: 'sellers',   icon: '🏪', label: 'Vendedores' },
  { id: 'catalog',   icon: '📚', label: 'Catálogo' },
  { id: 'mapping',   icon: '🔗', label: 'Solicitudes de mapeo' },
  { id: 'orders',    icon: '📋', label: 'Pedidos' },
  { id: 'bgg',       icon: '🎲', label: 'BGG Import' },
  { id: 'ranking',   icon: '⭐', label: 'Ranking' },
  { id: 'markets',   icon: '🌎', label: 'Mercados' },
  { id: 'ai-usage',  icon: '✦',  label: 'Uso de IA' },
  { id: 'analytics', icon: '📈', label: 'Visitor Intelligence' },
];

const ADMIN_VIEWS = new Set<AdminView>(['sellers', 'catalog', 'mapping', 'orders', 'bgg', 'ranking', 'markets', 'ai-usage', 'analytics']);

function parseView(): AdminView {
  const segment = window.location.pathname.replace(/^\//, '') as AdminView;
  return ADMIN_VIEWS.has(segment) ? segment : 'sellers';
}

export default function App() {
  const [view, setView] = useState<AdminView>(parseView);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const { user, logout } = useAdminAuth();
  const currentView = NAV.find((item) => item.id === view) ?? NAV[0];

  useEffect(() => {
    function onPop() { setView(parseView()); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(v: AdminView) {
    setView(v);
    setMobileNavOpen(false);
    window.history.pushState({}, '', `/${v}`);
  }

  return (
    <div className="min-h-dvh bg-slate-50 lg:h-dvh lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
          aria-label="Abrir navegación"
          aria-expanded={mobileNavOpen}
        >
          <span className="text-xl leading-none">☰</span>
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-sm font-semibold text-slate-900">{currentView.label}</p>
          <p className="truncate text-[11px] text-slate-500">BGM Admin</p>
        </div>
        <a
          href={`${API}/api/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
          aria-label="Swagger API Docs"
        >
          📄
        </a>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {!desktopSidebarOpen && (
        <button
          type="button"
          onClick={() => setDesktopSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:inline-flex"
          aria-label="Mostrar navegación"
        >
          <span className="text-xl leading-none">☰</span>
        </button>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,86vw)] flex-col overflow-hidden bg-slate-900 text-white transition-transform duration-200 lg:z-30 lg:w-52 ${
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
      } ${desktopSidebarOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}>
        <AdminSidebarContent
          userEmail={user.email}
          view={view}
          onNavigate={navigate}
          onLogout={() => { void logout(); }}
          onHideDesktop={() => setDesktopSidebarOpen(false)}
        />
      </aside>

      <main className={`min-w-0 overflow-x-hidden transition-[margin] duration-200 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain ${
        desktopSidebarOpen ? 'lg:ml-52' : 'lg:ml-0'
      }`}>
        {view === 'sellers'  && <SellersView />}
        {view === 'catalog'  && <CatalogView />}
        {view === 'mapping'  && <MappingRequestsView />}
        {view === 'orders'   && <OrdersView />}
        {view === 'bgg'      && <BggImportView />}
        {view === 'ranking'  && <RankingView />}
        {view === 'markets'  && <TenantMarketsView />}
        {view === 'ai-usage' && <AiUsageView />}
        {view === 'analytics' && <AnalyticsView />}
      </main>
    </div>
  );
}

function AdminSidebarContent({
  userEmail, view, onNavigate, onLogout, onHideDesktop,
}: {
  userEmail: string;
  view: AdminView;
  onNavigate: (view: AdminView) => void;
  onLogout: () => void;
  onHideDesktop: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">🎲 BGM Admin</p>
          <p className="mt-0.5 text-xs text-slate-400">Consola de administración</p>
        </div>
        <button
          type="button"
          onClick={onHideDesktop}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:inline-flex"
          aria-label="Ocultar navegación"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors lg:py-2.5 ${
              view === item.id
                ? 'bg-slate-700 font-medium text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate text-xs text-slate-400">{userEmail}</p>
        <div className="mt-2 flex flex-col gap-2">
          <button onClick={onLogout} className="text-left text-xs text-slate-500 hover:text-white">
            Cerrar sesión
          </button>
          <a
            href={`${API}/api/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            📄 Swagger API Docs
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Sellers ──────────────────────────────────────────────────────────────────

function SellersView() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', statusFilter],
    queryFn: async () => {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await adminApi.fetch(`${API}/api/v1/sellers${qs}`);
      return res.json() as Promise<Seller[]>;
    },
  });

  const sellers = data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900">Vendedores</h1>
        <div className="flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
          {(['', 'pending', 'active', 'suspended'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : sellers.length === 0 ? (
          <Empty icon="🏪" msg="No hay vendedores registrados aún." />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
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

// ─── Tenant markets ───────────────────────────────────────────────────────────

interface CountryRef { id: string; code: string; name: string }
interface CurrencyRef { id: string; code: string; name: string; symbol: string }
interface LanguageRef { id: string; code: string; name: string; nativeName: string }
interface TenantMarket {
  id: string; countryCode: string; countryName: string; currencyCode: string;
  defaultLanguageCode: string; timezone: string; active: boolean;
}

function TenantMarketsView() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: markets, isLoading } = useQuery({
    queryKey: ['admin-tenant-markets'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/tenant-markets`);
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []) as TenantMarket[];
    },
  });

  const countriesQuery = useQuery({
    queryKey: ['admin-ref-countries'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/markets/countries`);
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []) as CountryRef[];
    },
  });
  const currenciesQuery = useQuery({
    queryKey: ['admin-ref-currencies'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/markets/currencies`);
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []) as CurrencyRef[];
    },
  });
  const languagesQuery = useQuery({
    queryKey: ['admin-ref-languages'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/markets/languages`);
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []) as LanguageRef[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (body: { countryCode: string; currencyCode: string; defaultLanguageCode: string; timezone: string }) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/tenant-markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Error al crear el mercado');
      return res.json() as Promise<TenantMarket>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tenant-markets'] }); setShowNew(false); setFormError(''); },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await adminApi.fetch(`${API}/api/v1/admin/tenant-markets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenant-markets'] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.fetch(`${API}/api/v1/admin/tenant-markets/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenant-markets'] }),
  });

  const rows = markets ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900">Mercados</h1>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 text-white hover:bg-slate-800 sm:w-auto sm:py-1.5"
          >
            + Agregar mercado
          </button>
        )}
      </div>

      {showNew && (
        <TenantMarketForm
          countries={countriesQuery.data ?? []}
          currencies={currenciesQuery.data ?? []}
          languages={languagesQuery.data ?? []}
          error={formError}
          saving={createMut.isPending}
          onCancel={() => { setShowNew(false); setFormError(''); }}
          onSubmit={(body) => createMut.mutate(body)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon="🌎" msg="No hay mercados configurados aún." />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <Thead cols={['País', 'Moneda', 'Idioma', 'Zona horaria', 'Estado', '']} />
            <tbody className="divide-y divide-slate-100">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{m.countryName} ({m.countryCode})</td>
                  <td className="px-4 py-3 text-slate-500">{m.currencyCode}</td>
                  <td className="px-4 py-3 text-slate-500">{m.defaultLanguageCode}</td>
                  <td className="px-4 py-3 text-slate-500">{m.timezone}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActiveMut.mutate({ id: m.id, active: !m.active })}
                      disabled={toggleActiveMut.isPending}
                    >
                      <StatusBadge status={m.active ? 'active' : 'suspended'} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMut.mutate(m.id)}
                      disabled={deleteMut.isPending}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Eliminar
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

function TenantMarketForm({
  countries, currencies, languages, error, saving, onCancel, onSubmit,
}: {
  countries: CountryRef[];
  currencies: CurrencyRef[];
  languages: LanguageRef[];
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: { countryCode: string; currencyCode: string; defaultLanguageCode: string; timezone: string }) => void;
}) {
  const [countryCode, setCountryCode] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [defaultLanguageCode, setDefaultLanguageCode] = useState('');
  const [timezone, setTimezone] = useState('');

  const valid = countryCode && currencyCode && defaultLanguageCode && timezone.trim();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-500 space-y-1">
          <span>País</span>
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900">
            <option value="">Selecciona…</option>
            {countries.map((c) => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 space-y-1">
          <span>Moneda</span>
          <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900">
            <option value="">Selecciona…</option>
            {currencies.map((c) => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 space-y-1">
          <span>Idioma predeterminado</span>
          <select value={defaultLanguageCode} onChange={(e) => setDefaultLanguageCode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900">
            <option value="">Selecciona…</option>
            {languages.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 space-y-1">
          <span>Zona horaria (IANA)</span>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Mexico_City"
            className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <button
          onClick={() => valid && onSubmit({ countryCode, currencyCode, defaultLanguageCode, timezone: timezone.trim() })}
          disabled={!valid || saving}
          className="px-3 py-2 text-xs rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 sm:py-1.5"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-xs rounded-lg text-slate-500 hover:text-slate-800 sm:py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── AI enrichment usage (oversight only — budgets are enforced server-side) ──

interface SellerAiUsage {
  sellerId: string; sellerName: string; tier: string;
  used: number; limit: number | null; remaining: number | null; unlimited: boolean;
}

function AiUsageView() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-ai-usage'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/ai-usage`);
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []) as SellerAiUsage[];
    },
  });

  const rows = data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Uso de IA</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enriquecimiento SEO por IA este mes, por vendedor en plan pago. Los límites se aplican del lado del servidor — esta vista es solo de referencia.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon="✦" msg="Ningún vendedor en plan pago todavía." />
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <Thead cols={['Vendedor', 'Plan', 'Usados este mes', 'Límite', 'Restantes']} />
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.sellerId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.sellerName}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{r.tier}</td>
                  <td className="px-4 py-3 text-slate-500">{r.used}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unlimited ? 'Sin límite' : r.limit}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unlimited ? '—' : r.remaining}</td>
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

const PAGE_SIZE = 50;

function CatalogView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enrichResult, setEnrichResult] = useState<{ message: string; viewUrl?: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-catalog', statusFilter, page, debouncedSearch],
    queryFn: async () => {
      const qs = new URLSearchParams({
        status: statusFilter,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/products?${qs}`);
      return res.json() as Promise<{ products: MktProduct[]; total: number }>;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-catalog'] });

  // Enriching pulls description/image/designer/publisher from BGG's game page
  // and sets canonicalStatus to 'verified' in the same call — that's what makes
  // a product show up in the public marketplace.
  const enrichOneMut = useMutation({
    mutationFn: async (bggId: string) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/import/bgg/${bggId}`, { method: 'POST' });
      return res.json() as Promise<{ name: string; slug: string }>;
    },
    onSuccess: (data) => {
      setEnrichResult({ message: `${data.name} enriquecido`, viewUrl: `${MARKETPLACE_URL}/product/${data.slug}` });
      invalidate();
    },
  });

  const enrichBulkMut = useMutation({
    mutationFn: async (bggIds: string[]) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/import/bgg/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bggIds }),
      });
      return res.json() as Promise<{ imported: unknown[]; failed: unknown[] }>;
    },
    onSuccess: (data) => {
      setEnrichResult({ message: `${data.imported.length} enriquecidos, ${data.failed.length} fallaron` });
      setSelected(new Set());
      invalidate();
    },
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelected(bggId: string | null) {
    if (!bggId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bggId)) next.delete(bggId); else next.add(bggId);
      return next;
    });
  }

  function toggleSelectAll() {
    const idsOnPage = products.map((p) => p.bggId).filter((id): id is string => !!id);
    const allSelected = idsOnPage.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) idsOnPage.forEach((id) => next.delete(id));
      else idsOnPage.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h1 className="text-xl font-bold text-slate-900">Catálogo — Cola de revisión</h1>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nombre..."
            className="w-full min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg sm:w-64 sm:py-1.5"
          />
          {(['pending', 'verified', 'duplicate'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); setSelected(new Set()); }}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors sm:py-1.5 ${
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

      {enrichResult && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-3">
          <span>✓ {enrichResult.message}</span>
          {enrichResult.viewUrl && (
            <a href={enrichResult.viewUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              Ver producto ↗
            </a>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 p-3 rounded-lg bg-slate-900 text-white text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>{selected.size} seleccionados</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => enrichBulkMut.mutate([...selected])}
              disabled={enrichBulkMut.isPending}
              className="px-3 py-2 bg-white text-slate-900 rounded-lg text-xs font-medium hover:bg-slate-100 disabled:opacity-50 sm:py-1.5"
            >
              {enrichBulkMut.isPending ? 'Enriqueciendo... (puede tardar)' : `Enriquecer ${selected.size} seleccionados`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-2 text-xs text-slate-300 hover:text-white sm:py-1.5"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : products.length === 0 ? (
          <Empty icon="📚" msg={`No hay productos con estado "${statusFilter}".`} />
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && products.every((p) => !p.bggId || selected.has(p.bggId))}
                    onChange={toggleSelectAll}
                  />
                </th>
                {['Imagen', 'Nombre', 'BGG Rank', 'Descripción', 'Listings', 'Estado', 'Acción'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const hasImage = p.images && p.images.length > 0;
                const hasDescription = !!p.description;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!p.bggId}
                        checked={!!p.bggId && selected.has(p.bggId)}
                        onChange={() => toggleSelected(p.bggId)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {hasImage ? (
                        <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <span className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">BGG #{p.bggId ?? '—'}{p.yearPublished ? ` · ${p.yearPublished}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.bggRank ?? '—'}</td>
                    <td className="px-4 py-3">
                      {hasDescription ? (
                        <span className="text-xs text-emerald-600">✓ Completa</span>
                      ) : (
                        <span className="text-xs text-amber-600">⚠ Falta</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p._count?.listings ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.canonicalStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.bggId && (
                          <button
                            onClick={() => enrichOneMut.mutate(p.bggId!)}
                            disabled={enrichOneMut.isPending}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Enriquecer
                          </button>
                        )}
                        {/* Only verified products are visible on the live marketplace. */}
                        {p.canonicalStatus === 'verified' && (
                          <a
                            href={`${MARKETPLACE_URL}/product/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline"
                          >
                            Ver producto ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{total.toLocaleString('es-MX')} productos · página {page + 1} de {pageCount.toLocaleString('es-MX')}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:opacity-40 sm:py-1.5"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:opacity-40 sm:py-1.5"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mapping requests (escalated seller items needing a master-catalog decision) ──

const MAPPING_PAGE_SIZE = 20;

function MappingRequestsView() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState('');
  const [page, setPage] = useState(0);

  const sellersQuery = useQuery({
    queryKey: ['admin-sellers-all'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/sellers?limit=200`);
      return res.json() as Promise<Seller[]>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['mapping-requests', sellerFilter, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        status: 'escalated',
        limit: String(MAPPING_PAGE_SIZE),
        offset: String(page * MAPPING_PAGE_SIZE),
        ...(sellerFilter ? { sellerId: sellerFilter } : {}),
      });
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/mapping-requests?${qs}`);
      return res.json() as Promise<{ requests: MappingRequest[]; total: number }>;
    },
  });

  const requests = data?.requests ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / MAPPING_PAGE_SIZE));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['mapping-requests'] });

  const approveExistingMut = useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/mapping-requests/${id}/approve-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      return res.json();
    },
    onSuccess: () => { setResult('✓ Vinculado al producto existente'); setExpandedId(null); invalidate(); },
  });

  const approveNewMut = useMutation({
    mutationFn: async ({ id, bggId }: { id: string; bggId: string }) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/mapping-requests/${id}/approve-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bggId }),
      });
      return res.json();
    },
    onSuccess: () => { setResult('✓ Importado de BGG y vinculado'); setExpandedId(null); invalidate(); },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/mapping-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      return res.json();
    },
    onSuccess: () => { setResult('Solicitud rechazada'); setExpandedId(null); invalidate(); },
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Solicitudes de mapeo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Productos que un vendedor sincronizó pero no pudo vincular al catálogo maestro, y escaló
            explícitamente pidiendo que se agreguen.
          </p>
        </div>
        <select
          value={sellerFilter}
          onChange={(e) => { setSellerFilter(e.target.value); setPage(0); setExpandedId(null); }}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white sm:w-64 sm:shrink-0"
        >
          <option value="">Todos los vendedores</option>
          {(sellersQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {result && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {result}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : requests.length === 0 ? (
          <Empty icon="🔗" msg="No hay solicitudes pendientes de revisión." />
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((r) => {
              const raw = r.rawPayload as { name?: string; images?: string[] };
              const topCandidate = r.candidates?.[0];
              return (
                <div key={r.id}>
                  <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0">
                      {raw.images?.[0] ? (
                        <img src={raw.images[0]} alt={raw.name} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">{raw.name ?? 'Sin nombre'}</p>
                      <p className="text-xs text-slate-400">
                        {r.seller.name} · {new Date(r.createdAt).toLocaleDateString('es-MX')}
                        {r.sellerNote ? ` · "${r.sellerNote}"` : ''}
                      </p>
                    </div>
                    {topCandidate && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 shrink-0">
                        💡 {topCandidate.name} · {Math.round(topCandidate.score * 100)}%
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="rounded-lg border border-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 sm:border-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline shrink-0"
                    >
                      {expandedId === r.id ? 'Cerrar' : 'Resolver'}
                    </button>
                  </div>
                  {expandedId === r.id && (
                    <MappingRequestDetail
                      request={r}
                      onApproveExisting={(productId) => approveExistingMut.mutate({ id: r.id, productId })}
                      onApproveNew={(bggId) => approveNewMut.mutate({ id: r.id, bggId })}
                      onReject={(reason) => rejectMut.mutate({ id: r.id, reason })}
                      busy={approveExistingMut.isPending || approveNewMut.isPending || rejectMut.isPending}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{total.toLocaleString('es-MX')} solicitudes · página {page + 1} de {pageCount}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:opacity-40 sm:py-1.5"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:opacity-40 sm:py-1.5"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SelectedProposal {
  kind: 'existing' | 'bgg';
  id: string; // productId for 'existing', bggId for 'bgg'
  name: string;
  image?: string | null;
  yearPublished?: number | null;
  publisher?: string | null;
  score?: number;
}

function MappingRequestDetail({
  request, onApproveExisting, onApproveNew, onReject, busy,
}: {
  request: MappingRequest;
  onApproveExisting: (productId: string) => void;
  onApproveNew: (bggId: string) => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [catalogQ, setCatalogQ] = useState('');
  const [bggQ, setBggQ] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<SelectedProposal | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const raw = request.rawPayload as {
    name?: string; description?: string; images?: string[]; url?: string;
    variants?: { priceMinorUnits?: number; currency?: string; stock?: number; sku?: string }[];
  };
  const variant = raw.variants?.[0];

  const catalogSearch = useQuery({
    queryKey: ['mapping-catalog-search', catalogQ],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/products?search=${encodeURIComponent(catalogQ)}&limit=8`);
      return (await res.json() as { products: MktProduct[] }).products;
    },
    enabled: !!catalogQ.trim(),
  });

  const bggSearch = useQuery({
    queryKey: ['mapping-bgg-search', bggQ],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/bgg/search?q=${encodeURIComponent(bggQ)}`);
      return res.json() as Promise<BggResult[]>;
    },
    enabled: !!bggQ.trim(),
  });

  function confirm() {
    if (!selected) return;
    if (selected.kind === 'existing') onApproveExisting(selected.id);
    else onApproveNew(selected.id);
  }

  return (
    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100 space-y-4 pt-3">
      {/* Side-by-side comparison: seller's raw data vs the selected proposal */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Datos del vendedor</p>
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded bg-slate-100 overflow-hidden shrink-0">
              {raw.images?.[0] && <img src={raw.images[0]} alt={raw.name} className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{raw.name ?? 'Sin nombre'}</p>
              {variant && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {variant.priceMinorUnits != null && fmt(variant.priceMinorUnits, variant.currency)}
                  {variant.stock != null ? ` · stock ${variant.stock}` : ''}
                </p>
              )}
              {(request.sellerSku || variant?.sku) && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">{request.sellerSku ?? variant?.sku}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowRawJson((v) => !v)}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            {showRawJson ? 'Ocultar' : 'Ver'} datos completos del conector
          </button>
          {showRawJson && (
            <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded-lg text-[10px] leading-relaxed overflow-auto max-h-48">
              {JSON.stringify(request.rawPayload, null, 2)}
            </pre>
          )}
        </div>

        <div className={`bg-white rounded-xl border p-3 ${selected ? 'border-emerald-300' : 'border-slate-200'}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Propuesta seleccionada</p>
          {!selected ? (
            <p className="text-xs text-slate-400 py-3">Elegí una opción abajo para comparar.</p>
          ) : (
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded bg-slate-100 overflow-hidden shrink-0">
                {selected.image && <img src={selected.image} alt={selected.name} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{selected.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.publisher ?? ''}{selected.publisher && selected.yearPublished ? ' · ' : ''}{selected.yearPublished ?? ''}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">
                  {selected.kind === 'existing' ? 'Catálogo existente' : 'Importar de BGG'}
                  {selected.score != null ? ` · ${Math.round(selected.score * 100)}% similitud` : ''}
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-3 sm:flex-row">
            <button
              disabled={!selected || busy}
              onClick={confirm}
              className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 sm:py-1.5"
            >
              Confirmar vínculo
            </button>
            {selected && (
              <button onClick={() => setSelected(null)} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 sm:py-1.5">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggested matches from the auto-matching engine */}
      {request.candidates && request.candidates.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Sugerencias automáticas</p>
          <div className="flex flex-wrap gap-2">
            {request.candidates.map((c) => (
              <button
                key={c.productId}
                onClick={() => setSelected({ kind: 'existing', id: c.productId, name: c.name, image: c.image, yearPublished: c.yearPublished, publisher: c.publisher, score: c.score })}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  selected?.kind === 'existing' && selected.id === c.productId
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <span className="text-slate-800">{c.name}</span>
                <span className="text-slate-400 tabular">{Math.round(c.score * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Buscar en catálogo</p>
          <input
            value={catalogQ}
            onChange={(e) => setCatalogQ(e.target.value)}
            placeholder="Buscar en catálogo..."
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg mb-2"
          />
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {catalogSearch.data?.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected({ kind: 'existing', id: p.id, name: p.name, image: p.images?.[0], yearPublished: p.yearPublished, publisher: undefined })}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg border truncate ${
                  selected?.kind === 'existing' && selected.id === p.id
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Importar de BGG</p>
          <input
            value={bggQ}
            onChange={(e) => setBggQ(e.target.value)}
            placeholder="Buscar en BGG..."
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg mb-2"
          />
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {bggSearch.data?.map((r) => (
              <button
                key={r.bggId}
                onClick={() => setSelected({ kind: 'bgg', id: r.bggId, name: r.name, yearPublished: r.yearPublished })}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg border truncate ${
                  selected?.kind === 'bgg' && selected.id === r.bggId
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300'
                }`}
              >
                {r.name}{r.yearPublished ? ` (${r.yearPublished})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Rechazar</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={2}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg mb-2"
          />
          <button
            disabled={busy}
            onClick={() => onReject(reason)}
            className="w-full px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            Rechazar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function OrdersView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/checkout/admin/orders?limit=50`);
      return res.json() as Promise<{ orders: Order[]; total: number }>;
    },
  });

  const orders = data?.orders ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-orders'] });

  const markPaidMut = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await adminApi.fetch(`${API}/api/v1/checkout/admin/orders/${orderId}/mark-paid-out`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: invalidate,
  });

  const unmarkPaidMut = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await adminApi.fetch(`${API}/api/v1/checkout/admin/orders/${orderId}/unmark-paid-out`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: invalidate,
  });

  const canPayOut = (status: string) => status === 'confirmed' || status === 'shipped' || status === 'delivered';

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Pedidos</h1>
      <p className="text-sm text-slate-500">
        El pago a vendedores es manual mientras el split por MercadoPago no esté habilitado —
        la plataforma recibe el 100% de cada pago. Marcá "Pago enviado" una vez que transferiste
        el neto del vendedor (total − comisión) por fuera de la plataforma.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <Loading />
        ) : orders.length === 0 ? (
          <Empty icon="📋" msg="Todavía no hay pedidos en el marketplace." />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <Thead cols={['ID', 'Cliente', 'Vendedor', 'Total', 'Neto vendedor', 'Estado', 'Fecha', 'Pago a vendedor']} />
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(-8)}</td>
                  <td className="px-4 py-3 text-slate-600">{o.customer?.email ?? 'guest'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.seller?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {fmt(o.totalMinorUnits, o.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {fmt(o.totalMinorUnits - o.commissionMinorUnits, o.currency)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    {!canPayOut(o.status) ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : o.paidOutAt ? (
                      <button
                        onClick={() => unmarkPaidMut.mutate(o.id)}
                        disabled={unmarkPaidMut.isPending}
                        title={`Pagado el ${new Date(o.paidOutAt).toLocaleDateString('es-MX')} — click para deshacer`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 hover:bg-emerald-100"
                      >
                        ✓ Pagado
                      </button>
                    ) : (
                      <button
                        onClick={() => markPaidMut.mutate(o.id)}
                        disabled={markPaidMut.isPending}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Marcar pago enviado
                      </button>
                    )}
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
  const [importResult, setImportResult] = useState<{ message: string; viewUrl?: string } | null>(null);

  const searchQuery = useQuery({
    queryKey: ['bgg-search', q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/bgg/search?q=${encodeURIComponent(q)}`);
      return res.json() as Promise<BggResult[]>;
    },
    enabled: !!q.trim(),
  });

  const importMut = useMutation({
    mutationFn: async (bggId: string) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/import/bgg/${bggId}`, { method: 'POST' });
      return res.json() as Promise<{ name: string; slug: string }>;
    },
    onSuccess: (data) => {
      setImportResult({ message: `Importado: ${data.name}`, viewUrl: `${MARKETPLACE_URL}/product/${data.slug}` });
      qc.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
  });

  const bulkMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/import/bgg/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bggIds: ids }),
      });
      return res.json() as Promise<{ imported: unknown[]; failed: unknown[] }>;
    },
    onSuccess: (data) => {
      setImportResult({ message: `Bulk: ${data.imported.length} importados, ${data.failed.length} fallaron` });
      setBulkIds('');
      qc.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
  });

  // Full-catalog import pulls BGG's daily ranks dump (~178k games, rank/rating
  // data only) directly — no per-item rate limit, finishes in under a minute.
  const fullImportStatus = useQuery({
    queryKey: ['bgg-full-catalog-status'],
    queryFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/bgg-discovery/import-full-catalog/status`);
      return res.json() as Promise<{ running: boolean; total: number; imported: number; skipped: number; error?: string }>;
    },
    refetchInterval: (query) => (query.state.data?.running ? 1500 : false),
  });

  const startFullImportMut = useMutation({
    mutationFn: async () => {
      const res = await adminApi.fetch(`${API}/api/v1/admin/catalog/bgg-discovery/import-full-catalog`, { method: 'POST' });
      return res.json() as Promise<{ started: boolean }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bgg-full-catalog-status'] }),
  });

  const fs = fullImportStatus.data;
  const fullImportPct = fs && fs.total > 0 ? Math.round(((fs.imported + fs.skipped) / fs.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">Importar desde BoardGameGeek</h1>

      {importResult && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-3">
          <span>✓ {importResult.message}</span>
          {importResult.viewUrl && (
            <a href={importResult.viewUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              Ver producto ↗
            </a>
          )}
        </div>
      )}

      {/* Full catalog import */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-900">Catálogo completo (ranks dump)</h2>
          <button
            onClick={() => startFullImportMut.mutate()}
            disabled={startFullImportMut.isPending || fs?.running}
            className="w-full px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
          >
            {fs?.running ? 'Importando...' : '🎲 Importar catálogo completo'}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Descarga el dump diario de BGG con rank/rating de ~178k juegos (sin descripción/imagen —
          eso se completa por juego con "Enriquecer" en la cola de Catálogo). Quedan como
          <code className="mx-1 px-1 bg-slate-100 rounded">pending</code> hasta su revisión.
        </p>
        {fs && (fs.running || fs.total > 0) && (
          <div className="space-y-1.5">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${fs.running ? fullImportPct : 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {fs.running
                ? `${fs.imported + fs.skipped} / ${fs.total} (${fullImportPct}%)`
                : `Completo: ${fs.imported} importados, ${fs.skipped} omitidos de ${fs.total}`}
            </p>
            {fs.error && <p className="text-xs text-red-600">Error: {fs.error}</p>}
          </div>
        )}
      </div>

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
              <div key={r.bggId} className="flex flex-col gap-3 p-3 rounded-lg border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-400">BGG #{r.bggId}{r.yearPublished ? ` · ${r.yearPublished}` : ''}</p>
                </div>
                <button
                  onClick={() => importMut.mutate(r.bggId)}
                  disabled={importMut.isPending}
                  className="px-3 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 sm:py-1.5 sm:shrink-0"
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
          className="w-full px-5 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
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
      const res = await adminApi.fetch(`${API}/api/v1/admin/rankings/trigger`, { method: 'POST' });
      const data = await res.json() as { jobId?: string };
      setJobResult(`Job encolado: ${data.jobId}`);
    } catch {
      setJobResult('Error al encolar el job.');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
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
        <div className="grid gap-4 text-sm sm:grid-cols-2">
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
            <div key={label as string} className="grid gap-2 sm:flex sm:items-center sm:gap-3">
              <span className="text-sm text-slate-600 sm:w-52 sm:shrink-0">{label}</span>
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
  id: string; name: string; slug: string; bggId: string | null;
  description: string | null; images: string[];
  canonicalStatus: string;
  bggRank: number | null; bggRating: number | null;
  yearPublished: number | null; isExpansion: boolean;
  _count?: { listings: number };
}

interface Order {
  id: string; status: string; currency: string;
  totalMinorUnits: number; commissionMinorUnits: number; createdAt: string;
  paidOutAt: string | null;
  customer?: { email: string } | null;
  seller?: { name: string } | null;
}

interface BggResult {
  bggId: string; name: string; yearPublished?: number;
}

interface MappingCandidate {
  productId: string;
  name: string;
  score: number;
  bggId: string | null;
  image: string | null;
  publisher: string | null;
  yearPublished: number | null;
}

interface MappingRequest {
  id: string;
  sellerSku: string | null;
  rawPayload: unknown;
  candidates: MappingCandidate[] | null;
  sellerNote: string | null;
  createdAt: string;
  seller: { id: string; name: string; slug: string };
}
