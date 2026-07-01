import { useState, useEffect, useCallback } from 'react';
import type { SellerSession } from '../App.js';
import { ConnectorCredentialForm } from '../onboarding/OnboardingWizard.js';
import type { ConnectorType } from '../onboarding/OnboardingWizard.js';
import ListingsPage from './ListingsPage.js';
import ProductMappingPage from './ProductMappingPage.js';
import OrdersPage from './OrdersPage.js';
import AnalyticsPage from './AnalyticsPage.js';
import { SettingsPage } from './SettingsPage.js';
import { MarketsPage } from './MarketsPage.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/index.js';
import { Badge } from '../components/ui/index.js';
import { Button } from '../components/ui/index.js';
import { ToastProvider, useToast } from '../components/ui/index.js';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/index.js';
import {
  BarChart3,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const CONNECTORS = [
  { type: 'tiendanube',   label: 'Tiendanube'   },
  { type: 'shopify',      label: 'Shopify'       },
  { type: 'mercadolibre', label: 'Mercado Libre' },
  { type: 'woocommerce',  label: 'WooCommerce'   },
  { type: 'csv',          label: 'CSV / Excel'   },
  { type: 'manual',       label: 'Manual'        },
] as const;

const OAUTH_CONNECTORS = new Set(['tiendanube', 'shopify', 'mercadolibre', 'woocommerce']);

const NAV_ITEMS = [
  { label: 'Visión general',     id: 'dashboard', icon: LayoutDashboard, group: 'Principal' },
  { label: 'Productos',          id: 'listings',  icon: Package,         group: 'Operación' },
  { label: 'Vincular productos', id: 'mapping',   icon: Link2,           group: 'Operación' },
  { label: 'Pedidos',            id: 'orders',    icon: ShoppingBag,     group: 'Operación' },
  { label: 'Analíticas',         id: 'analytics', icon: BarChart3,       group: 'Operación' },
  { label: 'Sincronización',     id: 'sync',      icon: RefreshCw,       group: 'Gestión' },
  { label: 'Mercados',           id: 'markets',   icon: Globe2,          group: 'Gestión' },
  { label: 'Configuración',      id: 'settings',  icon: Settings,        group: 'Gestión' },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

const NAV_IDS = new Set(NAV_ITEMS.map((n) => n.id));

function parseNavFromPath(): NavId {
  const segment = window.location.pathname.replace(/^\//, '');
  return NAV_IDS.has(segment as NavId) ? (segment as NavId) : 'dashboard';
}

interface DashboardProps {
  session: SellerSession;
  onLogout: () => void;
  onSessionUpdate: (updates: Partial<SellerSession['seller']>) => void;
}

export default function Dashboard({ session, onLogout, onSessionUpdate }: DashboardProps) {
  return (
    <ToastProvider>
      <DashboardInner session={session} onLogout={onLogout} onSessionUpdate={onSessionUpdate} />
    </ToastProvider>
  );
}

function DashboardInner({ session, onLogout, onSessionUpdate }: DashboardProps) {
  const [activeNav, setActiveNav] = useState<NavId>(parseNavFromPath);
  const [pendingMappings, setPendingMappings] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    function onPop() { setActiveNav(parseNavFromPath()); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshPendingMappings = useCallback(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/product-mappings?status=pending_review&limit=1`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.ok ? r.json() : { total: 0 })
      .then((d: { total?: number }) => setPendingMappings(d.total ?? 0))
      .catch(() => null);
  }, [session.seller.id, session.token]);

  useEffect(() => { refreshPendingMappings(); }, [refreshPendingMappings, activeNav]);

  function navigate(id: NavId) {
    setActiveNav(id);
    setMobileNavOpen(false);
    window.history.pushState({}, '', id === 'dashboard' ? '/' : `/${id}`);
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === activeNav) ?? NAV_ITEMS[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden bg-slate-50">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-slate-950 text-slate-300 lg:flex">
        <SidebarContent
          session={session}
          activeNav={activeNav}
          pendingMappings={pendingMappings}
          onNavigate={navigate}
          onLogout={onLogout}
        />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent className="p-0 lg:hidden">
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SheetDescription className="sr-only">Secciones del portal de vendedores</SheetDescription>
          <SidebarContent
            session={session}
            activeNav={activeNav}
            pendingMappings={pendingMappings}
            onNavigate={navigate}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="-ml-1 inline-flex size-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ActiveIcon className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{activeItem.label}</p>
              <p className="truncate text-[11px] text-slate-500">{session.seller.name}</p>
            </div>
          </div>
          {activeNav === 'mapping' && pendingMappings > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold tabular text-amber-800">{pendingMappings}</span>
          )}
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {activeNav === 'dashboard'  && <DashboardHome session={session} />}
          {activeNav === 'listings'   && <ListingsPage session={session} />}
          {activeNav === 'mapping'    && <ProductMappingPage session={session} />}
          {activeNav === 'orders'     && <OrdersPage session={session} />}
          {activeNav === 'analytics'  && <AnalyticsPage session={session} />}
          {activeNav === 'sync'       && <SyncHealth session={session} onNavigate={navigate} />}
          {activeNav === 'markets'    && <MarketsPage session={session} />}
          {activeNav === 'settings'   && (
            <div className="space-y-0">
              <SettingsPage session={session} onSessionUpdate={onSessionUpdate} />
              <div className="max-w-2xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
                <ConnectorSettings session={session} onSessionUpdate={onSessionUpdate} />
              </div>
            </div>
          )}
          {activeNav !== 'dashboard' && activeNav !== 'listings' && activeNav !== 'mapping' && activeNav !== 'orders' &&
           activeNav !== 'analytics' && activeNav !== 'sync' && activeNav !== 'settings' && activeNav !== 'markets' && (
            <ComingSoon section={NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? ''} />
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ session, activeNav, pendingMappings, onNavigate, onLogout }: {
  session: SellerSession;
  activeNav: NavId;
  pendingMappings: number;
  onNavigate: (id: NavId) => void;
  onLogout: () => void;
}) {
  const groups = ['Principal', 'Operación', 'Gestión'] as const;

  return (
    <>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-950/30">
          <span className="text-xs font-black tracking-tight text-white">BG</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none text-white">BGMarket</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Portal vendedor</p>
        </div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        {groups.map((group) => (
          <div key={group} className="mb-5 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{group}</p>
            <div className="space-y-1">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      active
                        ? 'bg-white/[0.09] font-medium text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-400" />}
                    <Icon className={`size-[18px] shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.id === 'mapping' && pendingMappings > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tabular text-slate-950">
                        {pendingMappings}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/5 p-3">
        <a
          href={import.meta.env.VITE_MARKETPLACE_URL ?? 'http://localhost:4300'}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="size-4" />
          Ver marketplace
        </a>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/20">
            {session.seller.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-100">{session.seller.name}</p>
            <p className={`mt-0.5 truncate text-[10px] ${session.seller.connectorType ? 'text-emerald-400' : 'text-slate-500'}`}>
              {session.seller.connectorType ? `Conectado a ${session.seller.connectorType}` : 'Sin conector'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}

interface ListingStats {
  total: number;
  active: number;
  outOfStock: number;
  lowStock: number;
}

function DashboardHome({ session }: { session: SellerSession }) {
  const [stats, setStats] = useState<ListingStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/listings/stats`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((s) => setStats(s as ListingStats | null))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [session.seller.id, session.token]);

  const activeRate = stats && stats.total > 0
    ? Math.round((stats.active / stats.total) * 100)
    : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = session.seller.name.split(' ')[0];

  return (
    <div className="max-w-6xl p-4 sm:p-6 lg:p-8 page-enter">
      {/* Greeting header */}
      <div className="mb-6 space-y-1 lg:mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {session.seller.connectorType
            ? `Sincronizado con ${session.seller.connectorType}`
            : 'Configurá un conector para empezar a vender'}
        </p>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 lg:grid-cols-4">
        <MetricCard
          label="Total de productos"
          value={loadingStats ? '—' : String(stats?.total ?? 0)}
          sub={activeRate !== null ? `${activeRate}% activos` : undefined}
        />
        <MetricCard
          label="Activos en catálogo"
          value={loadingStats ? '—' : String(stats?.active ?? 0)}
          sub={stats && stats.total > 0 ? `de ${stats.total} totales` : undefined}
          highlight={stats ? stats.active > 0 : false}
        />
        <MetricCard
          label="Sin stock"
          value={loadingStats ? '—' : String(stats?.outOfStock ?? 0)}
          sub="requieren reposición"
          alert={stats ? stats.outOfStock > 0 : false}
        />
        <MetricCard
          label="Stock bajo"
          value={loadingStats ? '—' : String(stats?.lowStock ?? 0)}
          sub="por debajo del umbral"
          warn={stats ? stats.lowStock > 0 : false}
        />
      </div>

      {/* Catalog health */}
      {stats && stats.total > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Salud del catálogo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="flex h-2 rounded-full overflow-hidden gap-px bg-slate-100">
                  {stats.active > 0 && (
                    <div style={{ flex: stats.active }} className="bg-emerald-500 rounded-full" />
                  )}
                  {stats.lowStock > 0 && (
                    <div style={{ flex: stats.lowStock }} className="bg-amber-400 rounded-full" />
                  )}
                  {stats.outOfStock > 0 && (
                    <div style={{ flex: stats.outOfStock }} className="bg-red-400 rounded-full" />
                  )}
                </div>
                {/* Legend — 4 numbers */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Total',      value: stats.total,        color: 'text-slate-900',  dot: 'bg-slate-300'  },
                    { label: 'Activos',    value: stats.active,       color: 'text-emerald-700', dot: 'bg-emerald-500' },
                    { label: 'Stock bajo', value: stats.lowStock,     color: 'text-amber-600',  dot: 'bg-amber-400'  },
                    { label: 'Sin stock',  value: stats.outOfStock,   color: 'text-red-600',    dot: 'bg-red-400'    },
                  ].map(({ label, value, color, dot }) => (
                    <div key={label}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs text-slate-400">{label}</span>
                      </div>
                      <p className={`text-2xl font-bold tabular ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two-column bottom row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connector status */}
        <Card>
          <CardHeader>
            <CardTitle>Conector</CardTitle>
          </CardHeader>
          <CardContent>
            {session.seller.connectorType ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="text-emerald-700 font-bold text-sm uppercase">
                    {session.seller.connectorType.slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 capitalize">{session.seller.connectorType}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Activo · Cifrado AES-256</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Activo</span>
              </div>
            ) : (
              <div className="py-2 space-y-3">
                <p className="text-sm text-slate-500">No hay conector configurado.</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Configurá un conector en Ajustes para comenzar a sincronizar tu catálogo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-4 text-center space-y-3">
              <p className="text-3xl">📦</p>
              <div>
                <p className="text-sm font-medium text-slate-600">Sin pedidos aún</p>
                <p className="text-xs text-slate-400 mt-0.5">Los pedidos del marketplace aparecerán aquí cuando empieces a vender.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, sub, highlight, alert, warn,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  alert?: boolean;
  warn?: boolean;
}) {
  const accent = alert ? 'bg-red-400' : warn ? 'bg-amber-400' : highlight ? 'bg-emerald-500' : 'bg-slate-100';
  const valueColor = alert ? 'text-red-600' : warn ? 'text-amber-600' : highlight ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={`h-1 w-full ${accent}`} />
      <div className="px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-none">{label}</p>
        <p className={`mt-2 text-3xl font-bold tabular tracking-tight sm:mt-2.5 sm:text-4xl ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

interface SyncStatusRow {
  type: string;
  lastRun: string | null;
  status: string | null;
  itemsSynced: number;
  itemsFailed: number;
}

function relTime(iso: string | null): string {
  if (!iso) return 'nunca';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function SyncHealth({ session, onNavigate }: { session: SellerSession; onNavigate: (id: NavId) => void }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusRow[]>([]);
  const [runResults, setRunResults] = useState<Record<string, { items: number; ok: boolean }>>({});

  const connectorName = session.seller.connectorType ?? 'manual';
  const hasConnector = !!session.seller.connectorType;

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/connector/sync/status`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSyncStatus(Array.isArray(d) ? d as SyncStatusRow[] : []))
      .catch(() => null);
  }, [session.seller.id, session.token]);

  async function triggerSync(type: 'catalog' | 'inventory' | 'prices', force = false) {
    setSyncing(type);
    try {
      const url = `${API}/api/v1/sellers/${session.seller.id}/connector/sync/${type}${force ? '?force=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const body = await res.json().catch(() => ({})) as { itemsSynced?: number };
      const ok = res.ok;
      setRunResults((r) => ({ ...r, [type]: { items: body.itemsSynced ?? 0, ok } }));
      if (ok) {
        toast(`Sincronización de ${type} completada — ${body.itemsSynced ?? 0} items`, 'success');
      } else {
        toast(`Error al sincronizar ${type}`, 'error');
      }
      // refresh status after sync
      fetch(`${API}/api/v1/sellers/${session.seller.id}/connector/sync/status`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setSyncStatus(Array.isArray(d) ? d as SyncStatusRow[] : []))
        .catch(() => null);
    } catch {
      setRunResults((r) => ({ ...r, [type]: { items: 0, ok: false } }));
      toast(`Error de conexión al sincronizar ${type}`, 'error');
    } finally {
      setSyncing(null);
    }
  }

  const SYNC_ROWS = [
    { key: 'catalog'   as const, label: 'Catálogo',   freq: 'cada 4 horas', canForce: true  },
    { key: 'inventory' as const, label: 'Inventario', freq: 'cada 5 min',   canForce: false },
    { key: 'prices'    as const, label: 'Precios',    freq: 'cada 15 min',  canForce: false },
  ];

  return (
    <div className="max-w-3xl p-4 sm:p-6 lg:p-8 page-enter">
      {/* Page header */}
      <div className="mb-6 space-y-1 lg:mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sincronización</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Estado del conector</h1>
        <p className="text-sm text-slate-400">Sincronización automática de catálogo, inventario y precios.</p>
      </div>

      <div className="mb-6">
        <Button
          variant="primary"
          onClick={() => triggerSync('catalog')}
          disabled={syncing !== null || !hasConnector}
        >
          {syncing === 'catalog' ? 'Sincronizando…' : 'Sincronizar ahora'}
        </Button>
      </div>

      {!hasConnector && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Sin conector configurado.{' '}
          <button className="underline font-medium hover:text-amber-900" onClick={() => onNavigate('settings')}>
            Ir a Configuración
          </button>
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{connectorName}</CardTitle>
              <Badge variant={hasConnector ? 'success' : 'secondary'}>
                {hasConnector ? 'Conectado' : 'Sin configurar'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-slate-100">
              {SYNC_ROWS.map((s) => {
                const status = syncStatus.find((r) => r.type === s.key);
                const run = runResults[s.key];
                return (
                  <div key={s.key} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 py-4 text-sm sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-4">
                    <span className="text-slate-700 font-medium">{s.label}</span>

                    <div className="col-span-2 space-y-0.5 sm:col-span-1">
                      {run ? (
                        run.ok
                          ? <span className="text-emerald-700">{run.items} ítems sincronizados</span>
                          : <span className="text-red-600">Error en la última ejecución</span>
                      ) : status ? (
                        <div>
                          <span className={status.status === 'success' ? 'text-emerald-700' : 'text-red-600'}>
                            {status.status === 'success'
                              ? `${status.itemsSynced.toLocaleString('es-AR')} ítems`
                              : 'Error'}
                          </span>
                          <span className="text-slate-400 text-xs ml-2">{relTime(status.lastRun)}</span>
                          {status.itemsFailed > 0 && (
                            <span className="text-amber-600 text-xs ml-2">{status.itemsFailed} fallidos</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin ejecuciones previas</span>
                      )}
                      <p className="text-xs text-slate-400">{s.freq}</p>
                    </div>

                    <div className="col-start-2 row-start-1 flex items-center gap-3 sm:col-auto sm:row-auto">
                      <button
                        onClick={() => triggerSync(s.key)}
                        disabled={syncing !== null || !hasConnector}
                        className="text-xs text-slate-600 underline hover:text-slate-900 disabled:opacity-40"
                      >
                        {syncing === s.key ? '…' : 'Ejecutar'}
                      </button>
                      {s.canForce && (
                        <button
                          onClick={() => triggerSync(s.key, true)}
                          disabled={syncing !== null || !hasConnector}
                          className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40"
                          title="Ignorar sincronización incremental y descargar todo el catálogo"
                        >
                          Completa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Modo de sincronización</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              El catálogo usa <strong className="text-slate-700">sincronización incremental</strong> — solo se descargan los productos modificados desde la última ejecución exitosa, reduciendo el tiempo y el uso de la API.
              Usá <em>Completa</em> para forzar una descarga de todos los productos cuando sea necesario.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectorSettings({
  session,
  onSessionUpdate,
}: {
  session: SellerSession;
  onSessionUpdate: (updates: Partial<SellerSession['seller']>) => void;
}) {
  const [selected, setSelected] = useState<string>(session.seller.connectorType ?? '');
  const [connected, setConnected] = useState(!!session.seller.connectorType);

  const current = CONNECTORS.find((c) => c.type === session.seller.connectorType);
  const needsCreds = selected && OAUTH_CONNECTORS.has(selected);

  function pickConnector(type: string) {
    setSelected(type);
    setConnected(type === session.seller.connectorType);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1 mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conectores y pagos</h1>
        <p className="text-sm text-slate-400">Administrá tu conector de inventario y métodos de pago.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conector activo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {current ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm text-slate-900">{current.label}</p>
                <p className="text-xs text-emerald-700 mt-0.5">Credenciales cifradas en reposo</p>
              </div>
              <Badge variant="success">Activo</Badge>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-1">Ningún conector configurado.</p>
          )}
        </CardContent>
      </Card>

      <MpConnectCard session={session} onSessionUpdate={onSessionUpdate} />

      {session.seller.connectorType && (
        <WebhookRegisterCard session={session} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{current ? 'Cambiar conector' : 'Conectar tienda'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
            {CONNECTORS.map((c) => (
              <button
                key={c.type}
                onClick={() => pickConnector(c.type)}
                className={`text-left px-3 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  selected === c.type
                    ? 'border-slate-800 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {selected && needsCreds && (
            <ConnectorCredentialForm
              sellerId={session.seller.id}
              connectorType={selected as ConnectorType}
              connected={connected}
              onConnected={() => {
                setConnected(true);
                onSessionUpdate({ connectorType: selected });
              }}
            />
          )}

          {selected && !needsCreds && selected !== session.seller.connectorType && (
            <SaveManualConnector
              sellerId={session.seller.id}
              connectorType={selected}
              token={session.token}
              onSaved={() => onSessionUpdate({ connectorType: selected })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MpConnectCard({
  session,
}: {
  session: SellerSession;
  onSessionUpdate: (updates: Partial<SellerSession['seller']>) => void;
}) {
  const [status, setStatus] = useState<{ connected: boolean; merchantId?: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/payments/mp/status`)
      .then((r) => r.ok ? r.json() : { connected: false })
      .then((s) => setStatus(s as { connected: boolean; merchantId?: string }))
      .catch(() => setStatus({ connected: false }));
  }, [session.seller.id]);

  async function connectMp() {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API}/api/v1/sellers/${session.seller.id}/payments/mp/connect`);
      const body = (await res.json()) as { authUrl: string };
      if (body.authUrl.includes('mp=error')) {
        const msg = new URL(body.authUrl).searchParams.get('msg') ?? 'Error desconocido';
        setConnectError(decodeURIComponent(msg));
        setConnecting(false);
        return;
      }
      window.location.href = body.authUrl;
    } catch (e) {
      setConnectError(String(e));
      setConnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MercadoPago</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Conectá tu cuenta MP para recibir pagos directamente. La comisión de la plataforma se descuenta automáticamente.
        </p>

        {status === null ? (
          <p className="text-sm text-slate-400">Verificando…</p>
        ) : status.connected ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800">Cuenta conectada</p>
              {status.merchantId && (
                <p className="text-xs text-emerald-600 mt-0.5">ID: {status.merchantId}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={connectMp} disabled={connecting}>
              Reconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Sin conectar — los pagos no se acreditarán hasta que conectes tu cuenta MP.
            </div>
            {connectError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {connectError.includes('CLIENT_ID')
                  ? 'MercadoPago no está configurado en esta instalación. Contactá al administrador.'
                  : connectError}
              </div>
            )}
            <Button variant="outline" onClick={connectMp} disabled={connecting}>
              {connecting ? 'Redirigiendo a MercadoPago…' : 'Conectar cuenta de MercadoPago'}
            </Button>
            <p className="text-xs text-slate-400">
              Solo necesitás hacerlo una vez. Serás redirigido al sitio de MercadoPago.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookRegisterCard({ session }: { session: SellerSession }) {
  const { toast } = useToast();
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; webhookId?: string } | null>(null);

  async function register() {
    setRegistering(true);
    setResult(null);
    try {
      const res = await fetch(
        `${API}/api/v1/sellers/${session.seller.id}/connector/webhook/register`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } },
      );
      const body = await res.json() as { ok: boolean; message?: string; webhookId?: string };
      setResult(body);
      if (body.ok) {
        toast('Webhook registrado correctamente', 'success');
      } else {
        toast(body.message ?? 'Error al registrar webhook', 'error');
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
      toast('Error de conexión al registrar webhook', 'error');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks en tiempo real</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-slate-500 leading-relaxed">
          Registrá un webhook en tu tienda para recibir actualizaciones de stock y precio
          en tiempo real, sin esperar al ciclo de sincronización.
        </p>
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.ok
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {result.ok
              ? `Webhook registrado${result.webhookId ? ` (ID: ${result.webhookId})` : ''}`
              : (result.message ?? 'Error al registrar el webhook')}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={register} disabled={registering}>
          {registering ? 'Registrando…' : 'Registrar webhook'}
        </Button>
      </CardContent>
    </Card>
  );
}

function SaveManualConnector({
  sellerId, connectorType, token, onSaved,
}: { sellerId: string; connectorType: string; token: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`${API}/api/v1/sellers/${sellerId}/connector/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ connectorType }),
      });
      setDone(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (done) return <p className="text-sm text-emerald-700 font-medium">Guardado correctamente</p>;

  return (
    <Button variant="primary" onClick={save} disabled={saving}>
      {saving ? 'Guardando…' : 'Guardar selección'}
    </Button>
  );
}

function ComingSoon({ section }: { section: string }) {
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">{section}</p>
        <p className="text-xs text-slate-400">Próximamente disponible</p>
      </div>
    </div>
  );
}
