import { useState, useEffect, useCallback } from 'react';
import type { SellerSession } from '../App.js';
import { ConnectorCredentialForm } from '../onboarding/OnboardingWizard.js';
import type { ConnectorType } from '../onboarding/OnboardingWizard.js';
import ListingsPage from './ListingsPage.js';
import ProductMappingPage from './ProductMappingPage.js';
import OrdersPage from './OrdersPage.js';
import AnalyticsPage from './AnalyticsPage.js';
import { SettingsPage } from './SettingsPage.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/index.js';
import { Badge } from '../components/ui/index.js';
import { Button } from '../components/ui/index.js';
import { Progress } from '../components/ui/index.js';
import { Separator } from '../components/ui/index.js';
import { ToastProvider, useToast } from '../components/ui/index.js';

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
  { label: 'Visión general',     id: 'dashboard' },
  { label: 'Productos',          id: 'listings'  },
  { label: 'Vincular productos', id: 'mapping'   },
  { label: 'Pedidos',            id: 'orders'    },
  { label: 'Sincronización',     id: 'sync'      },
  { label: 'Analíticas',         id: 'analytics' },
  { label: 'Configuración',      id: 'settings'  },
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

  useEffect(() => {
    function onPop() { setActiveNav(parseNavFromPath()); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshPendingMappings = useCallback(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/product-mappings?status=pending_review&limit=1`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => r.json())
      .then((d: { total?: number }) => setPendingMappings(d.total ?? 0))
      .catch(() => null);
  }, [session.seller.id, session.token]);

  useEffect(() => { refreshPendingMappings(); }, [refreshPendingMappings, activeNav]);

  function navigate(id: NavId) {
    setActiveNav(id);
    window.history.pushState({}, '', id === 'dashboard' ? '/' : `/${id}`);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        {/* Logo area */}
        <div className="px-5 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">BG</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">BGMarket</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Retail OS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto sidebar-scroll">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2 relative
                ${activeNav === item.id
                  ? 'text-white font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
            >
              {activeNav === item.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-full -ml-3" />
              )}
              <span className="flex-1">{item.label}</span>
              {item.id === 'mapping' && pendingMappings > 0 && (
                <span className="shrink-0 text-[10px] font-bold bg-amber-400 text-slate-900 rounded-full px-1.5 py-0.5 tabular">
                  {pendingMappings}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom user area */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-semibold">
                {session.seller.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{session.seller.name}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${session.seller.connectorType ? 'text-emerald-400' : 'text-slate-500'}`}>
                {session.seller.connectorType ? `● ${session.seller.connectorType}` : '○ Sin conector'}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-600 hover:text-slate-300 transition-colors"
          >
            Cerrar sesión →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {activeNav === 'dashboard'  && <DashboardHome session={session} />}
        {activeNav === 'listings'   && <ListingsPage session={session} />}
        {activeNav === 'mapping'    && <ProductMappingPage session={session} />}
        {activeNav === 'orders'     && <OrdersPage session={session} />}
        {activeNav === 'analytics'  && <AnalyticsPage session={session} />}
        {activeNav === 'sync'       && <SyncHealth session={session} onNavigate={navigate} />}
        {activeNav === 'settings'   && (
          <div className="space-y-0">
            <SettingsPage session={session} onSessionUpdate={onSessionUpdate} />
            <div className="px-8 pb-8 max-w-2xl">
              <ConnectorSettings session={session} onSessionUpdate={onSessionUpdate} />
            </div>
          </div>
        )}
        {activeNav !== 'dashboard' && activeNav !== 'listings' && activeNav !== 'mapping' && activeNav !== 'orders' &&
         activeNav !== 'analytics' && activeNav !== 'sync' && activeNav !== 'settings' && (
          <ComingSoon section={NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? ''} />
        )}
      </main>
    </div>
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
      .then((r) => r.json())
      .then((s) => setStats(s as ListingStats))
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
    <div className="p-8 max-w-6xl page-enter">
      {/* Greeting header */}
      <div className="space-y-1 mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {session.seller.connectorType
            ? `Sincronizado con ${session.seller.connectorType}`
            : 'Configurá un conector para empezar a vender'}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                <div className="grid grid-cols-4 gap-3">
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
      <div className="grid lg:grid-cols-2 gap-4">
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
      <div className="px-5 pt-4 pb-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-none">{label}</p>
        <p className={`text-4xl font-bold tabular tracking-tight mt-2.5 ${valueColor}`}>{value}</p>
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
      .then((r) => r.json())
      .then((d) => setSyncStatus(d as SyncStatusRow[]))
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
        .then((r) => r.json())
        .then((d) => setSyncStatus(d as SyncStatusRow[]))
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
    <div className="p-8 max-w-3xl page-enter">
      {/* Page header */}
      <div className="space-y-1 mb-8">
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
                  <div key={s.key} className="py-3.5 grid grid-cols-[7rem_1fr_auto] items-center gap-4 text-sm">
                    <span className="text-slate-700 font-medium">{s.label}</span>

                    <div className="space-y-0.5">
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

                    <div className="flex items-center gap-2">
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
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
      .then((r) => r.json())
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
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
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
