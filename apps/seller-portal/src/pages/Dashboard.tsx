import { useState } from 'react';
import type { SellerSession } from '../App.js';

const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard', id: 'dashboard' },
  { icon: '📦', label: 'Productos', id: 'listings' },
  { icon: '📋', label: 'Pedidos', id: 'orders' },
  { icon: '🔄', label: 'Sincronización', id: 'sync' },
  { icon: '📈', label: 'Analíticas', id: 'analytics' },
  { icon: '⚙️', label: 'Configuración', id: 'settings' },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

interface DashboardProps {
  session: SellerSession;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: DashboardProps) {
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-emerald-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-emerald-800">
          <p className="text-sm font-bold">🎲 BoardGame Market</p>
          <p className="text-xs text-emerald-400 mt-0.5">Portal de Vendedores</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeNav === item.id
                  ? 'bg-emerald-700 text-white font-medium'
                  : 'text-emerald-300 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-emerald-800">
          <p className="text-xs text-emerald-400">{session.seller.name}</p>
          <button
            onClick={onLogout}
            className="text-xs text-emerald-500 hover:text-white mt-0.5"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-stone-50 overflow-auto">
        {activeNav === 'dashboard' && <DashboardHome sellerName={session.seller.name} />}
        {activeNav === 'sync' && <SyncHealth session={session} />}
        {activeNav !== 'dashboard' && activeNav !== 'sync' && (
          <ComingSoon section={NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? ''} />
        )}
      </main>
    </div>
  );
}

function DashboardHome({ sellerName }: { sellerName: string }) {
  const kpis = [
    { label: 'Productos activos', value: '47', icon: '📦', trend: null },
    { label: 'Pedidos hoy', value: '3', icon: '📋', trend: '+2 vs ayer' },
    { label: 'Ranking promedio', value: '#2.4', icon: '⭐', trend: null },
    { label: 'Sincronización', value: '✓ OK', icon: '🔄', trend: 'Hace 4 min' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Bienvenido, {sellerName} 👋</h1>
        <p className="text-stone-500 text-sm mt-1">
          Tu tienda está activa en el marketplace.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-500">{kpi.label}</p>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <p className="text-2xl font-bold text-stone-900">{kpi.value}</p>
            {kpi.trend && (
              <p className="text-xs text-emerald-600 mt-1">{kpi.trend}</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-semibold text-stone-900 mb-4">Acciones rápidas</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: '🔄', label: 'Sincronizar ahora', desc: 'Actualizar stock y precios' },
            { icon: '➕', label: 'Agregar producto', desc: 'Carga manual de un juego' },
            { icon: '📊', label: 'Ver ranking', desc: 'Cómo aparecés en el marketplace' },
          ].map((a) => (
            <button
              key={a.label}
              className="text-left p-4 rounded-xl border border-stone-200 hover:border-emerald-400
                         hover:bg-emerald-50/40 transition-all"
            >
              <span className="text-2xl block mb-2">{a.icon}</span>
              <p className="font-medium text-sm text-stone-900">{a.label}</p>
              <p className="text-xs text-stone-400 mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-semibold text-stone-900 mb-4">Últimos pedidos</h2>
        <div className="text-center py-8 text-stone-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Todavía no recibiste pedidos desde el marketplace.</p>
          <p className="text-xs mt-1">Aparecerán aquí en cuanto se realice una compra.</p>
        </div>
      </div>
    </div>
  );
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function SyncHealth({ session }: { session: SellerSession }) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { items: number; ok: boolean }>>({});

  const connectorName = session.seller.connectorType ?? 'manual';
  const connectorIcon = connectorName === 'tiendanube' ? '☁️' : connectorName === 'shopify' ? '🛍️' : '🔌';
  const hasConnector = !!session.seller.connectorType;

  async function triggerSync(type: 'catalog' | 'inventory' | 'prices') {
    setSyncing(type);
    try {
      const res = await fetch(
        `${API}/api/v1/sellers/${session.seller.id}/connector/sync/${type}`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } },
      );
      const body = await res.json().catch(() => ({}));
      setResults((r) => ({
        ...r,
        [type]: { items: (body as { itemsSynced?: number }).itemsSynced ?? 0, ok: res.ok },
      }));
    } catch {
      setResults((r) => ({ ...r, [type]: { items: 0, ok: false } }));
    } finally {
      setSyncing(null);
    }
  }

  const SYNC_ROWS = [
    { key: 'catalog', label: 'Catálogo', freq: 'cada 4 horas' },
    { key: 'inventory', label: 'Inventario', freq: 'cada 5 min' },
    { key: 'prices', label: 'Precios', freq: 'cada 15 min' },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Estado de sincronización</h1>
        <button
          onClick={() => triggerSync('catalog')}
          disabled={syncing !== null || !hasConnector}
          className="px-4 py-2 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
        >
          {syncing === 'catalog' ? '⏳ Sincronizando...' : '🔄 Sincronizar ahora'}
        </button>
      </div>

      {!hasConnector && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          ⚠️ No tenés un conector configurado. Completá el onboarding para conectar tu tienda.
        </div>
      )}

      {/* Connector status */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{connectorIcon}</span>
          <div>
            <p className="font-semibold text-stone-900 capitalize">{connectorName}</p>
            <p className="text-xs text-stone-400">Conector activo</p>
          </div>
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            hasConnector
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-stone-100 text-stone-500'
          }`}>
            ● {hasConnector ? 'Conectado' : 'Sin configurar'}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {SYNC_ROWS.map((s) => {
            const r = results[s.key];
            return (
              <div key={s.key} className="py-3 flex items-center gap-4 text-sm">
                <span className="text-stone-500 w-28 shrink-0">{s.label}</span>
                {r ? (
                  r.ok
                    ? <span className="text-emerald-600 font-medium">✓ {r.items} ítems</span>
                    : <span className="text-red-500 font-medium">✗ Error</span>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
                <span className="ml-auto text-stone-400 text-xs">{s.freq}</span>
                <button
                  onClick={() => triggerSync(s.key)}
                  disabled={syncing !== null || !hasConnector}
                  className="text-xs text-emerald-600 hover:underline disabled:opacity-40"
                >
                  {syncing === s.key ? '...' : 'Sincronizar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule info */}
      <div className="bg-stone-100 rounded-xl p-4 text-sm text-stone-600">
        <p className="font-medium text-stone-700 mb-1">Frecuencia de sincronización</p>
        <ul className="space-y-1 text-xs">
          <li>📦 Catálogo — cada 4 horas</li>
          <li>📊 Inventario — cada 5 minutos</li>
          <li>💰 Precios — cada 15 minutos</li>
        </ul>
      </div>
    </div>
  );
}

function ComingSoon({ section }: { section: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-96">
      <div className="text-center text-stone-400">
        <p className="text-4xl mb-3">🚧</p>
        <p className="font-medium text-stone-600">{section}</p>
        <p className="text-sm mt-1">Próximamente disponible</p>
      </div>
    </div>
  );
}
