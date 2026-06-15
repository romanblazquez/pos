import { useMemo, useState } from 'react';
import { AppRegistry, type AppMetadata } from '@retail-os/app-registry';
import appDirectory from '@config/app-directory.json';
import { openApp } from './shell-bridge.js';

const registry = new AppRegistry(appDirectory as AppMetadata[]);
const CATEGORIES = ['todas', 'sales', 'inventory', 'erp', 'customers', 'reporting', 'administration'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  todas: 'Todas',
  sales: 'Ventas',
  inventory: 'Inventario',
  erp: 'ERP / Odoo',
  customers: 'Clientes',
  reporting: 'Reportes',
  administration: 'Administración',
};

const STATUS_LABEL: Record<string, string> = {
  beta: 'Beta',
  roadmap: 'Roadmap',
};

export function Launcher() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('todas');

  const apps = useMemo(() => {
    let list = registry.search(query);
    if (category !== 'todas') list = list.filter((a) => a.category === category);
    return list;
  }, [query, category]);

  const gaCount = registry.getAll().filter((a) => a.status === 'ga').length;

  return (
    <div className="flex flex-col h-full bg-bg font-sans">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-6 py-5 border-b border-line bg-surface">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-lg border border-accent/40 bg-accent/10 text-accent text-base">
            ◆
          </span>
          <div>
            <strong className="block text-sm font-black text-text leading-none">Retail OS</strong>
            <span className="block text-[11px] text-muted mt-0.5">{gaCount} módulos activos</span>
          </div>
        </div>

        <div className="relative flex-1 max-w-sm ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">🔍</span>
          <input
            className="w-full h-9 pl-8 pr-3 bg-panel-2 border border-line rounded-lg text-sm text-text placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Buscar módulos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </header>

      {/* ── Category pills ────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 px-6 py-3 border-b border-line bg-panel overflow-x-auto scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={[
              'h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition border',
              c === category
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-panel-2 border-line text-muted hover:text-text hover:border-line/80',
            ].join(' ')}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </nav>

      {/* ── App grid ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto p-6">
        {apps.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl opacity-40">🔍</span>
            <p className="text-sm text-muted">Sin resultados para "{query}"</p>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {apps.map((app) => {
            const ready = app.status === 'ga';
            const badge = app.status && app.status !== 'ga' ? STATUS_LABEL[app.status] : null;

            return (
              <button
                key={app.id}
                onClick={() => ready && openApp(app.id)}
                disabled={!ready}
                className={[
                  'group relative flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition',
                  ready
                    ? 'bg-panel border-line hover:border-accent/50 hover:bg-panel-2 cursor-pointer'
                    : 'bg-panel border-line opacity-50 cursor-not-allowed',
                ].join(' ')}
              >
                {/* Icon */}
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-panel-3 text-2xl">
                  {app.icon}
                </span>

                {/* Copy */}
                <div className="min-w-0 w-full">
                  <strong className="block text-sm font-semibold text-text leading-snug">{app.name}</strong>
                  <span className="block text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{app.description}</span>
                </div>

                {/* Status badge */}
                {badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-panel-3 border border-line text-muted">
                    {badge}
                  </span>
                )}

                {/* Hover arrow on ready apps */}
                {ready && (
                  <span className="absolute top-3 right-3 text-accent opacity-0 group-hover:opacity-100 transition text-xs font-bold">
                    →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-line bg-surface text-xs text-muted">
        <span>Retail OS · modular ERP + POS</span>
        <span>{registry.getAll().length} módulos registrados</span>
      </footer>
    </div>
  );
}
