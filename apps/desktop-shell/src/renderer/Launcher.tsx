import { useMemo, useState } from 'react';
import { AppRegistry, type AppMetadata } from '@retail-os/app-registry';
import appDirectory from '@config/app-directory.json';
import { openApp } from './shell-bridge.js';

/**
 * Launcher — Odoo-style application launcher. Lists modules from the app
 * directory with search + category filtering; only the POS is production-ready,
 * the rest are discoverable placeholders that light up as modules land.
 */
const registry = new AppRegistry(appDirectory as AppMetadata[]);
const CATEGORIES = ['todas', 'sales', 'inventory', 'customers', 'reporting'] as const;

export function Launcher() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('todas');

  const apps = useMemo(() => {
    let list = registry.search(query);
    if (category !== 'todas') list = list.filter((a) => a.category === category);
    return list;
  }, [query, category]);

  return (
    <div className="launcher">
      <header className="lhead">
        <div className="brand">
          <span className="logo">◆</span> Retail OS
        </div>
        <input
          className="lsearch"
          placeholder="Buscar aplicaciones…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <nav className="lcats">
        {CATEGORIES.map((c) => (
          <button key={c} className={c === category ? 'active' : ''} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </nav>

      <main className="lgrid">
        {apps.map((app) => {
          const ready = app.id === 'pos';
          return (
            <button
              key={app.id}
              className={`app-tile${ready ? '' : ' soon'}`}
              onClick={() => ready && openApp(app.id)}
              disabled={!ready}
            >
              <span className="icon">{app.icon}</span>
              <span className="name">{app.name}</span>
              <span className="desc">{app.description}</span>
              {!ready && <span className="badge">Próximamente</span>}
            </button>
          );
        })}
      </main>

      <footer className="lfoot">
        Retail OS · modular ERP + POS · {registry.getAll().length} módulos registrados
      </footer>
    </div>
  );
}
