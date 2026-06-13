import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  DockviewReact,
  type DockviewApi,
  type IDockviewHeaderActionsProps,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview';
import { AppRegistry, type AppMetadata, type AppCategory } from '@retail-os/app-registry';
import appDirectory from '@config/app-directory.json';
import {
  getPreloadPath,
  getWorkspaceWindowPayload,
  onWorkspaceWindowClosed,
  openApp,
  openWorkspaceWindow,
  recallWorkspaceWindow,
  updateWorkspaceWindowPayload,
  type DetachedWorkspacePayload,
} from './shell-bridge.js';
import 'dockview/dist/styles/dockview.css';
import { SettingsPanel } from './settings/SettingsPanel.js';
import { OnboardingWizard } from './onboarding/OnboardingWizard.js';
import { VirtualTerminalPanel } from './virtual-terminal/VirtualTerminalPanel.js';
import {
  virtualTerminalSessionStore,
  type VirtualTerminalSessionSnapshot,
} from './virtual-terminal/session-store.js';

type PanelParams = { appId: string };
type ShellMode = 'workspace' | 'launcher';

const SIDEBAR_KEY = 'retail-os.shell.sidebar.expanded.v1';
const INSPECTOR_KEY = 'retail-os.shell.inspector.expanded.v1';
const THEME_KEY = 'retail-os.shell.theme.v1';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.dataset['theme'] = theme === 'light' ? 'light' : '';
}
const CATEGORY_ICONS: Record<(typeof CATEGORIES)[number], string> = {
  all: '⊞', sales: '🛒', inventory: '📦', customers: '👤',
  reporting: '📊', finance: '💰', channels: '🔌', administration: '⚙️',
};

const ONBOARDING_DONE_KEY = 'retail-os.onboarding.done';

interface EmbeddedWorkspaceContext {
  apps: AppMetadata[];
  preloadPath: string;
}

interface WorkspaceTemplate {
  id: string;
  name: string;
  appIds: string[];
}

interface WorkspaceSnapshot {
  layout: unknown | null;
  openPanelIds: string[];
  activeTemplateId: string;
}

const registry = new AppRegistry(appDirectory as AppMetadata[]);
const WORKSPACE_KEY = 'retail-os.shell.workspace.v1';
const FAVORITES_KEY = 'retail-os.shell.favorites.v1';
const RECENTS_KEY = 'retail-os.shell.recents.v1';
const CATEGORIES = ['all', 'sales', 'inventory', 'customers', 'reporting', 'finance', 'channels', 'administration'] as const;

const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  { id: 'store-floor', name: 'Punto de Venta', appIds: ['pos', 'customers', 'inventory'] },
  { id: 'daily-control', name: 'Control diario', appIds: ['pos', 'reports', 'inventory'] },
  { id: 'crm-service', name: 'Atencion cliente', appIds: ['customers', 'pos', 'reports'] },
];

const DEFAULT_SNAPSHOT: WorkspaceSnapshot = {
  layout: null,
  openPanelIds: ['pos'],
  activeTemplateId: 'store-floor',
};

const WorkspaceContext = createContext<EmbeddedWorkspaceContext>({ apps: [], preloadPath: '' });

interface RetailIntentContext {
  type: string;
  session?: VirtualTerminalSessionSnapshot;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
}

function categoryLabel(category: AppCategory | 'all'): string {
  const labels: Record<AppCategory | 'all', string> = {
    all: 'Todas',
    sales: 'Ventas',
    inventory: 'Inventario',
    customers: 'Clientes',
    reporting: 'Reportes',
    administration: 'Admin',
    finance: 'Finanzas',
    channels: 'Canales',
  };
  return labels[category];
}

function panelTitle(app: AppMetadata): string {
  return `${app.icon} ${app.name}`;
}

function appendQuery(url: string, query: string): string {
  const hashIndex = url.indexOf('#');
  const baseUrl = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}${hash}`;
}

function resolveAppUrl(app: AppMetadata): string {
  if (app.entryPoint.kind !== 'url') return '';
  return appendQuery(
    app.entryPoint.url,
    `retailAppId=${encodeURIComponent(app.id)}&retailSource=${encodeURIComponent(`app:${app.id}`)}`,
  );
}

function syncOpenPanelIds(api: DockviewApi, apps: AppMetadata[]): string[] {
  const appIds = new Set(apps.map((app) => app.id));
  return api.panels.map((panel) => panel.id).filter((id) => appIds.has(id));
}

function addAppPanel(
  api: DockviewApi,
  app: AppMetadata,
  options: { position?: 'right' | 'below'; referencePanel?: string } = {},
): void {
  api.addPanel<PanelParams>({
    id: app.id,
    component: 'retail-app',
    title: panelTitle(app),
    params: { appId: app.id },
    position: options.referencePanel
      ? { referencePanel: options.referencePanel, direction: options.position ?? 'right' }
      : undefined,
  });
}

export function App() {
  const allApps = useMemo(() => registry.getAll(), []);
  const snapshot = useMemo(() => readJson<WorkspaceSnapshot>(WORKSPACE_KEY, DEFAULT_SNAPSHOT), []);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const detachedWorkspaceId = searchParams.get('detachedWorkspaceId');
  const standaloneAppId = searchParams.get('standaloneAppId');
  const [mode, setMode] = useState<ShellMode>('workspace');
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) !== 'false',
  );
  const [inspectorExpanded, setInspectorExpanded] = useState(
    () => localStorage.getItem(INSPECTOR_KEY) !== 'false',
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const [preloadPath, setPreloadPath] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState(snapshot.activeTemplateId);
  const [openPanelIds, setOpenPanelIds] = useState<string[]>(snapshot.openPanelIds);
  const [detachedWorkspace, setDetachedWorkspace] = useState<DetachedWorkspacePayload | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  // Onboarding: show wizard on first run (no persisted flag).
  const [showOnboarding, setShowOnboarding] = useState(
    () => !window.localStorage.getItem(ONBOARDING_DONE_KEY),
  );
  const [favorites, setFavorites] = useState<string[]>(() => readJson<string[]>(FAVORITES_KEY, ['pos']));
  const [recents, setRecents] = useState<string[]>(() => readJson<string[]>(RECENTS_KEY, []));
  const dockApiRef = useRef<DockviewApi | null>(null);
  const savedLayoutRef = useRef(snapshot.layout);
  const listenersRef = useRef<Array<{ dispose: () => void }>>([]);
  const terminalWindowOpenedSequenceRef = useRef(virtualTerminalSessionStore.getSnapshot().sequence);

  useEffect(() => {
    void getPreloadPath().then(setPreloadPath);
  }, []);

  const visibleApps = useMemo(() => {
    let apps = registry.search(query);
    if (category !== 'all') apps = apps.filter((app) => app.category === category);
    return apps;
  }, [category, query]);

  const persistWorkspace = useCallback((api: DockviewApi, nextTemplateId = activeTemplateId) => {
    const nextOpenPanels = syncOpenPanelIds(api, allApps);
    setOpenPanelIds(nextOpenPanels);
    writeJson(WORKSPACE_KEY, {
      layout: api.toJSON(),
      openPanelIds: nextOpenPanels,
      activeTemplateId: nextTemplateId,
    } satisfies WorkspaceSnapshot);
  }, [activeTemplateId, allApps]);

  const trackRecent = useCallback((appId: string) => {
    setRecents((current) => {
      const next = unique([appId, ...current]).slice(0, 6);
      writeJson(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const addPanel = useCallback((appId: string, options: { position?: 'right' | 'below'; referencePanel?: string } = {}) => {
    const api = dockApiRef.current;
    const app = registry.getById(appId);
    if (!api || !app) return;

    const existing = api.getPanel(app.id);
    if (existing) {
      existing.api.setActive();
      trackRecent(app.id);
      return;
    }

    addAppPanel(api, app, options);
    trackRecent(app.id);
    persistWorkspace(api);
  }, [persistWorkspace, trackRecent]);

  const loadTemplate = useCallback((template: WorkspaceTemplate) => {
    const api = dockApiRef.current;
    if (!api) return;
    api.clear();
    template.appIds.forEach((appId, index) => {
      const referencePanel = index === 1 ? template.appIds[0] : index === 2 ? template.appIds[1] : undefined;
      const position = index === 2 ? 'below' : 'right';
      addPanel(appId, { referencePanel, position });
    });
    setActiveTemplateId(template.id);
    persistWorkspace(api, template.id);
    setSaveStatus('Plantilla cargada');
    setTimeout(() => setSaveStatus(''), 1400);
  }, [addPanel, persistWorkspace]);

  const resetWorkspace = useCallback(() => {
    const template = WORKSPACE_TEMPLATES[0];
    const api = dockApiRef.current;
    if (!api) return;
    api.clear();
    setActiveTemplateId(template.id);
    template.appIds.forEach((appId, index) => {
      addPanel(appId, {
        referencePanel: index === 0 ? undefined : template.appIds[index - 1],
        position: index === 2 ? 'below' : 'right',
      });
    });
    persistWorkspace(api, template.id);
  }, [addPanel, persistWorkspace]);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  const toggleInspector = useCallback(() => {
    setInspectorExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(INSPECTOR_KEY, String(next));
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      void window.retailShell?.setTheme(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((appId: string) => {
    setFavorites((current) => {
      const next = current.includes(appId) ? current.filter((id) => id !== appId) : [...current, appId];
      writeJson(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const activeTemplate = WORKSPACE_TEMPLATES.find((template) => template.id === activeTemplateId) ?? WORKSPACE_TEMPLATES[0];

  const saveWorkspace = useCallback(() => {
    const api = dockApiRef.current;
    if (!api) return;
    persistWorkspace(api);
    setSaveStatus('Guardado');
    setTimeout(() => setSaveStatus(''), 1400);
  }, [persistWorkspace]);

  const detachWorkspace = useCallback(async () => {
    const api = dockApiRef.current;
    if (!api) return;
    const panelIds = syncOpenPanelIds(api, allApps);
    if (panelIds.length === 0) return;

    const payload: DetachedWorkspacePayload = {
      id: `workspace-${Date.now().toString(36)}`,
      name: activeTemplate.name,
      panelIds,
      layout: api.toJSON(),
      sourceWorkspaceId: activeTemplateId,
    };

    await openWorkspaceWindow(payload);
    setDetachedWorkspace(payload);
    api.clear();
    persistWorkspace(api);
  }, [activeTemplate.name, activeTemplateId, allApps, persistWorkspace]);

  const recallDetachedWorkspace = useCallback(async () => {
    if (!detachedWorkspace) return;
    await recallWorkspaceWindow(detachedWorkspace.id);
  }, [detachedWorkspace]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    dockApiRef.current = api;

    if (savedLayoutRef.current) {
      try {
        api.fromJSON(savedLayoutRef.current as Parameters<DockviewApi['fromJSON']>[0]);
      } catch {
        savedLayoutRef.current = null;
      }
    }

    if (!savedLayoutRef.current || api.panels.length === 0) {
      api.clear();
      DEFAULT_SNAPSHOT.openPanelIds.forEach((appId) => addPanel(appId));
    }

    listenersRef.current.forEach((listener) => listener.dispose());
    listenersRef.current = [
      api.onDidAddPanel(() => persistWorkspace(api)),
      api.onDidRemovePanel(() => persistWorkspace(api)),
      api.onDidLayoutChange(() => persistWorkspace(api)),
      api.onDidLayoutFromJSON(() => persistWorkspace(api)),
    ];
    setOpenPanelIds(syncOpenPanelIds(api, allApps));
  }, [addPanel, allApps, persistWorkspace]);

  useEffect(() => {
    return () => {
      listenersRef.current.forEach((listener) => listener.dispose());
    };
  }, []);

  // Auto-open the Virtual Terminal when the POS starts a card payment.
  // If 'virtual-terminal' is already a Dockview panel, focus it in place.
  // Only open a new Electron window when it is not in the workspace.
  // Skip entirely in standalone/detached modes.
  useEffect(() => {
    if (standaloneAppId || detachedWorkspaceId) return;
    const off = virtualTerminalSessionStore.subscribe((session) => {
      if (!session.order || !session.paymentId) return;
      if (terminalWindowOpenedSequenceRef.current === session.sequence) return;
      terminalWindowOpenedSequenceRef.current = session.sequence;

      const existingPanel = dockApiRef.current?.getPanel('virtual-terminal');
      if (existingPanel) {
        existingPanel.api.setActive();
      } else {
        openApp('virtual-terminal', {
          type: 'retail.payment.intent',
          session,
        } satisfies RetailIntentContext);
      }
    });
    return off;
  }, [standaloneAppId, detachedWorkspaceId]);

  useEffect(() => {
    if (detachedWorkspaceId) return undefined;
    return onWorkspaceWindowClosed((payload) => {
      const api = dockApiRef.current;
      const nextTemplateId = payload.sourceWorkspaceId ?? activeTemplateId;

      setDetachedWorkspace(null);
      setMode('workspace');
      setOpenPanelIds(payload.panelIds);
      setActiveTemplateId(nextTemplateId);
      writeJson(WORKSPACE_KEY, {
        layout: payload.layout,
        openPanelIds: payload.panelIds,
        activeTemplateId: nextTemplateId,
      } satisfies WorkspaceSnapshot);

      if (!api) {
        savedLayoutRef.current = payload.layout;
        return;
      }

      api.clear();
      if (payload.layout) {
        try {
          api.fromJSON(payload.layout as Parameters<DockviewApi['fromJSON']>[0]);
        } catch {
          for (const appId of payload.panelIds) {
            const app = registry.getById(appId);
            if (app) addAppPanel(api, app);
          }
        }
      } else {
        for (const appId of payload.panelIds) {
          const app = registry.getById(appId);
          if (app) addAppPanel(api, app);
        }
      }
      persistWorkspace(api, nextTemplateId);
    });
  }, [activeTemplateId, detachedWorkspaceId, persistWorkspace]);

  const contextValue = useMemo(() => ({ apps: allApps, preloadPath }), [allApps, preloadPath]);
  const favoriteApps = favorites.map((id) => registry.getById(id)).filter((app): app is AppMetadata => Boolean(app));
  const recentApps = recents.map((id) => registry.getById(id)).filter((app): app is AppMetadata => Boolean(app));

  if (standaloneAppId) {
    return (
      <WorkspaceContext.Provider value={contextValue}>
        <StandaloneAppShell app={registry.getById(standaloneAppId)} />
      </WorkspaceContext.Provider>
    );
  }

  if (detachedWorkspaceId) {
    return (
      <WorkspaceContext.Provider value={contextValue}>
        <DetachedWorkspaceShell workspaceId={detachedWorkspaceId} apps={allApps} />
      </WorkspaceContext.Provider>
    );
  }

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="shell">
        <header className="shell-topbar">
          <div className="shell-brand">
            <span className="brand-mark">◆</span>
            <div>
              <strong>Retail OS</strong>
              <span>{activeTemplate.name}</span>
            </div>
          </div>

          <div className="workspace-tabs">
            {WORKSPACE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className={template.id === activeTemplateId ? 'active' : ''}
                onClick={() => loadTemplate(template)}
              >
                {template.name}
              </button>
            ))}
          </div>

          <div className="shell-actions">
            {saveStatus && <span className="save-status">{saveStatus}</span>}
            <button className="ghost-btn" onClick={() => setMode(mode === 'workspace' ? 'launcher' : 'workspace')}>
              {mode === 'workspace' ? 'Launcher' : 'Workspace'}
            </button>
            <button className="ghost-btn" onClick={saveWorkspace}>Guardar</button>
            {detachedWorkspace ? (
              <button className="ghost-btn" onClick={recallDetachedWorkspace}>Acoplar</button>
            ) : (
              <button className="ghost-btn" disabled={openPanelIds.length === 0} onClick={detachWorkspace}>
                Desacoplar
              </button>
            )}
            <button className="ghost-btn" onClick={resetWorkspace}>Reset</button>
            <button
              className="ghost-btn theme-toggle-btn"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="ghost-btn gear-btn"
              title="Configuración"
              aria-label="Abrir configuración"
              onClick={() => openApp('settings')}
            >
              ⚙️
            </button>
          </div>
        </header>

        <main className={`shell-main${sidebarExpanded ? '' : ' sidebar-collapsed'}${inspectorExpanded ? '' : ' inspector-collapsed'}`}>
          <aside className={`app-sidebar${sidebarExpanded ? '' : ' collapsed'}`}>
            <button
              className="sidebar-toggle"
              title={sidebarExpanded ? 'Colapsar sidebar' : 'Expandir sidebar'}
              aria-label={sidebarExpanded ? 'Colapsar sidebar' : 'Expandir sidebar'}
              onClick={toggleSidebar}
            >
              {sidebarExpanded ? '‹' : '›'}
            </button>

            {sidebarExpanded ? (
              <>
                <input
                  className="app-search"
                  placeholder="Buscar modulo"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="category-list">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>
                      {categoryLabel(cat)}
                    </button>
                  ))}
                </div>
                {favoriteApps.length > 0 && (
                  <AppGroup title="Favoritos" apps={favoriteApps} onOpen={openApp} onDock={addPanel} onFavorite={toggleFavorite} favorites={favorites} />
                )}
                {recentApps.length > 0 && (
                  <AppGroup title="Recientes" apps={recentApps} onOpen={openApp} onDock={addPanel} onFavorite={toggleFavorite} favorites={favorites} />
                )}
                <AppGroup title="Aplicaciones" apps={visibleApps} onOpen={openApp} onDock={addPanel} onFavorite={toggleFavorite} favorites={favorites} />
              </>
            ) : (
              <div className="sidebar-icons">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`sidebar-icon-btn${category === cat ? ' active' : ''}`}
                    title={categoryLabel(cat)}
                    aria-label={categoryLabel(cat)}
                    onClick={() => { setCategory(cat); toggleSidebar(); }}
                  >
                    {CATEGORY_ICONS[cat]}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="workspace-host">
            {detachedWorkspace && (
              <div className="detached-placeholder">
                <strong>{detachedWorkspace.name}</strong>
                <span>Workspace desacoplado en otra ventana</span>
                <button onClick={recallDetachedWorkspace}>Acoplar workspace</button>
              </div>
            )}
            {mode === 'launcher' && (
              <LauncherOverlay
                apps={visibleApps}
                favorites={favorites}
                onOpen={openApp}
                onDock={(appId) => {
                  addPanel(appId);
                  setMode('workspace');
                }}
                onFavorite={toggleFavorite}
              />
            )}
            <DockviewReact
              className="retail-dockview dockview-theme-abyss"
              components={{ 'retail-app': RetailAppPanel }}
              rightHeaderActionsComponent={DockviewAddAppsAction}
              onReady={onReady}
            />
          </section>

          <aside className={`workspace-inspector${inspectorExpanded ? '' : ' collapsed'}`}>
            <button
              className="inspector-toggle"
              title={inspectorExpanded ? 'Colapsar inspector' : 'Expandir inspector'}
              aria-label={inspectorExpanded ? 'Colapsar inspector' : 'Expandir inspector'}
              onClick={toggleInspector}
            >
              {inspectorExpanded ? '›' : '‹'}
            </button>

            {inspectorExpanded ? (
              <>
                <section>
                  <h2>Workspace</h2>
                  <Metric label="Paneles" value={String(openPanelIds.length)} />
                  <Metric label="Modulos" value={String(allApps.length)} />
                  <Metric label="Protocolo" value="RWP" />
                </section>
                <section>
                  <h2>Abiertos</h2>
                  <div className="open-list">
                    {openPanelIds.map((id) => {
                      const app = registry.getById(id);
                      if (!app) return null;
                      return (
                        <button key={id} onClick={() => dockApiRef.current?.getPanel(id)?.api.setActive()}>
                          <span>{app.icon}</span>
                          {app.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <h2>Canales</h2>
                  <div className="channel-pill active"><span /> Tienda centro</div>
                  <div className="channel-pill"><span /> Backoffice</div>
                </section>
              </>
            ) : (
              <div className="inspector-icons">
                {openPanelIds.map((id) => {
                  const app = registry.getById(id);
                  if (!app) return null;
                  return (
                    <button
                      key={id}
                      className="inspector-icon-btn"
                      title={app.name}
                      aria-label={app.name}
                      onClick={() => dockApiRef.current?.getPanel(id)?.api.setActive()}
                    >
                      {app.icon}
                    </button>
                  );
                })}
                <div className="inspector-channel-dots">
                  <div className="inspector-dot active" title="Tienda centro" />
                  <div className="inspector-dot" title="Backoffice" />
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
      {/* Onboarding wizard overlay — shown on first run only */}
      {showOnboarding && createPortal(
        <div className="onboarding-overlay">
          <OnboardingWizard
            onComplete={() => {
              window.localStorage.setItem(ONBOARDING_DONE_KEY, '1');
              setShowOnboarding(false);
            }}
          />
        </div>,
        document.body,
      )}
    </WorkspaceContext.Provider>
  );
}

function AppGroup({
  title,
  apps,
  favorites,
  onOpen,
  onDock,
  onFavorite,
}: {
  title: string;
  apps: AppMetadata[];
  favorites: string[];
  onOpen: (appId: string) => void;
  onDock: (appId: string) => void;
  onFavorite: (appId: string) => void;
}) {
  return (
    <section className="app-group">
      <h2>{title}</h2>
      <div className="app-list">
        {apps.map((app) => (
          <ModuleButton
            key={`${title}-${app.id}`}
            app={app}
            favorite={favorites.includes(app.id)}
            compact
            onOpen={onOpen}
            onDock={onDock}
            onFavorite={onFavorite}
          />
        ))}
      </div>
    </section>
  );
}

function LauncherOverlay({
  apps,
  favorites,
  onOpen,
  onDock,
  onFavorite,
}: {
  apps: AppMetadata[];
  favorites: string[];
  onOpen: (appId: string) => void;
  onDock: (appId: string) => void;
  onFavorite: (appId: string) => void;
}) {
  const grouped = apps.reduce<Record<string, AppMetadata[]>>((acc, app) => {
    const key = categoryLabel(app.category);
    acc[key] = [...(acc[key] ?? []), app];
    return acc;
  }, {});

  return (
    <div className="launcher-overlay">
      {Object.entries(grouped).map(([category, group]) => (
        <section key={category} className="launcher-section">
          <h2>{category}</h2>
          <div className="launcher-grid">
            {group.map((app) => (
              <ModuleButton
                key={app.id}
                app={app}
                favorite={favorites.includes(app.id)}
                onOpen={onOpen}
                onDock={onDock}
                onFavorite={onFavorite}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ModuleButton({
  app,
  favorite,
  compact = false,
  onOpen,
  onDock,
  onFavorite,
}: {
  app: AppMetadata;
  favorite: boolean;
  compact?: boolean;
  onOpen: (appId: string) => void;
  onDock: (appId: string) => void;
  onFavorite: (appId: string) => void;
}) {
  const production = app.id === 'pos';
  return (
    <div className={compact ? 'module-row' : 'module-card'}>
      <button className="module-open" onClick={() => onOpen(app.id)}>
        <span className="module-icon">{app.icon}</span>
        <span className="module-copy">
          <strong>{app.name}</strong>
          {!compact && <small>{app.description}</small>}
        </span>
        {!production && <span className="module-state">Roadmap</span>}
      </button>
      <button
        className={`favorite-btn${favorite ? ' active' : ''}`}
        aria-label={favorite ? 'Quitar favorito' : 'Agregar favorito'}
        onClick={() => onFavorite(app.id)}
      >
        ★
      </button>
      <button
        className="dock-btn"
        aria-label="Cargar en workspace"
        title="Cargar en workspace"
        onClick={() => onDock(app.id)}
      >
        Dock
      </button>
    </div>
  );
}

function StandaloneAppShell({ app }: { app: AppMetadata | undefined }) {
  // Hydrate the virtual terminal session from the URL context passed by the main workspace.
  useEffect(() => {
    if (app?.id !== 'virtual-terminal') return;
    try {
      const raw = new URLSearchParams(window.location.search).get('retailContext');
      if (!raw) return;
      const ctx = JSON.parse(raw) as RetailIntentContext;
      if (ctx.session) virtualTerminalSessionStore.hydrate(ctx.session);
    } catch { /* malformed context — ignore, terminal will wait for RWP events */ }
  }, [app?.id]);

  const resolveContent = () => {
    if (!app) {
      return <PlaceholderPanel title="Modulo desconocido" detail="Este modulo se abrira aqui cuando tenga una aplicacion propia." />;
    }
    if (app.id === 'virtual-terminal') return <VirtualTerminalPanel />;
    if (app.id === 'settings') return <SettingsPanel />;
    return <PlaceholderPanel title={app.name} detail={app.description ?? app.category} app={app} />;
  };

  return (
    <div className="standalone-shell">
      <header className="detached-topbar">
        <div className="shell-brand">
          <span className="brand-mark">◆</span>
          <div>
            <strong>{app?.name ?? 'Modulo'}</strong>
            <span>Ventana standalone</span>
          </div>
        </div>
      </header>
      <main className="standalone-main">
        {resolveContent()}
      </main>
    </div>
  );
}

function DetachedWorkspaceShell({ workspaceId, apps }: { workspaceId: string; apps: AppMetadata[] }) {
  const [payload, setPayload] = useState<DetachedWorkspacePayload | null>(null);
  const dockApiRef = useRef<DockviewApi | null>(null);
  const listenersRef = useRef<Array<{ dispose: () => void }>>([]);
  const hydratedRef = useRef<string | null>(null);
  const payloadRef = useRef<DetachedWorkspacePayload | null>(null);

  useEffect(() => {
    void getWorkspaceWindowPayload(workspaceId).then(setPayload);
  }, [workspaceId]);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const persistDetached = useCallback((api: DockviewApi, basePayload: DetachedWorkspacePayload) => {
    const next: DetachedWorkspacePayload = {
      ...basePayload,
      panelIds: syncOpenPanelIds(api, apps),
      layout: api.toJSON(),
    };
    setPayload(next);
    void updateWorkspaceWindowPayload(next);
  }, [apps]);

  const hydrate = useCallback((api: DockviewApi, nextPayload: DetachedWorkspacePayload) => {
    api.clear();
    if (nextPayload.layout) {
      try {
        api.fromJSON(nextPayload.layout as Parameters<DockviewApi['fromJSON']>[0]);
        return;
      } catch {
        api.clear();
      }
    }
    for (const appId of nextPayload.panelIds) {
      const app = registry.getById(appId);
      if (app) addAppPanel(api, app);
    }
  }, []);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    dockApiRef.current = api;
    if (payload) {
      hydrate(api, payload);
      hydratedRef.current = payload.id;
    }

    listenersRef.current.forEach((listener) => listener.dispose());
    const persistCurrent = () => {
      const current = payloadRef.current;
      if (current) persistDetached(api, current);
    };
    listenersRef.current = [
      api.onDidAddPanel(persistCurrent),
      api.onDidRemovePanel(persistCurrent),
      api.onDidLayoutChange(persistCurrent),
      api.onDidLayoutFromJSON(persistCurrent),
    ];
  }, [hydrate, payload, persistDetached]);

  useEffect(() => {
    const api = dockApiRef.current;
    if (!api || !payload || hydratedRef.current === payload.id) return;
    hydrate(api, payload);
    hydratedRef.current = payload.id;
  }, [hydrate, payload]);

  useEffect(() => {
    return () => listenersRef.current.forEach((listener) => listener.dispose());
  }, []);

  // Mirror the main workspace logic: if virtual-terminal is already a panel
  // in this detached workspace, focus it in place instead of spawning a new window.
  // Seed the ref with the current sequence so the immediate subscribe replay is skipped —
  // subscribe() calls the listener synchronously at registration time, before dockApiRef
  // is populated, which would otherwise always trigger openApp on mount.
  const terminalWindowOpenedSequenceRef = useRef(virtualTerminalSessionStore.getSnapshot().sequence);
  useEffect(() => {
    return virtualTerminalSessionStore.subscribe((session) => {
      if (!session.order || !session.paymentId) return;
      if (terminalWindowOpenedSequenceRef.current === session.sequence) return;
      terminalWindowOpenedSequenceRef.current = session.sequence;

      const existingPanel = dockApiRef.current?.getPanel('virtual-terminal');
      if (existingPanel) {
        existingPanel.api.setActive();
      } else {
        openApp('virtual-terminal', {
          type: 'retail.payment.intent',
          session,
        } satisfies RetailIntentContext);
      }
    });
  }, []);

  return (
    <div className="detached-shell">
      <header className="detached-topbar">
        <div className="shell-brand">
          <span className="brand-mark">◆</span>
          <div>
            <strong>{payload?.name ?? 'Workspace'}</strong>
            <span>Workspace desacoplado</span>
          </div>
        </div>
        <div className="shell-actions">
          <button className="ghost-btn" onClick={() => void recallWorkspaceWindow(workspaceId)}>Acoplar</button>
        </div>
      </header>
      <main className="detached-main">
        {!payload && <div className="loading-panel">Cargando workspace...</div>}
        <DockviewReact
          className="retail-dockview dockview-theme-abyss"
          components={{ 'retail-app': RetailAppPanel }}
          rightHeaderActionsComponent={DockviewAddAppsAction}
          onReady={onReady}
        />
      </main>
    </div>
  );
}

function RetailAppPanel({ params }: IDockviewPanelProps<PanelParams>) {
  const { apps, preloadPath } = useContext(WorkspaceContext);
  const app = apps.find((candidate) => candidate.id === params.appId);

  if (!app) {
    return <PlaceholderPanel title="Modulo desconocido" detail={params.appId} />;
  }

  // Built-in route panels render directly as React components inside Dockview.
  if (app.entryPoint.kind === 'route') {
    if (app.id === 'settings') return <SettingsPanel />;
    if (app.id === 'virtual-terminal') return <VirtualTerminalPanel />;
    return <PlaceholderPanel title={app.name} detail={app.description ?? app.category} app={app} />;
  }

  const src = resolveAppUrl(app);
  const preloadUrl = preloadPath ? `file://${preloadPath}` : undefined;

  return (
    <div className="embedded-panel">
      {preloadUrl ? (
        <webview
          src={src}
          preload={preloadUrl}
          partition={`persist:retail-${app.id}`}
          allowpopups={false}
          style={{ width: '100%', height: '100%', border: 'none' } as CSSProperties}
        />
      ) : (
        <PlaceholderPanel title={app.name} detail="Cargando preload" app={app} />
      )}
    </div>
  );
}

function DockviewAddAppsAction({ containerApi, panels }: IDockviewHeaderActionsProps) {
  const { apps } = useContext(WorkspaceContext);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [panelRevision, setPanelRevision] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openIds = useMemo(
    () => new Set(containerApi.panels.map((panel) => panel.id)),
    [containerApi, panels, panelRevision],
  );
  const availableApps = useMemo(() => apps.filter((app) => !openIds.has(app.id)), [apps, openIds]);
  const availableAppIds = useMemo(() => new Set(availableApps.map((app) => app.id)), [availableApps]);

  useEffect(() => {
    const refresh = () => setPanelRevision((value) => value + 1);
    const disposables = [
      containerApi.onDidAddPanel(refresh),
      containerApi.onDidRemovePanel(refresh),
      containerApi.onDidLayoutFromJSON(refresh),
    ];
    return () => disposables.forEach((disposable) => disposable.dispose());
  }, [containerApi]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((appId) => availableAppIds.has(appId));
      return next.length === current.length ? current : next;
    });
  }, [availableAppIds]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 280;
    const menuHeight = 390;
    const gap = 6;
    const padding = 8;
    const maxLeft = window.innerWidth - menuWidth - padding;
    const left = Math.max(padding, Math.min(rect.right - menuWidth, maxLeft));
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - menuHeight - gap;
    const top = belowTop + menuHeight <= window.innerHeight - padding ? belowTop : Math.max(padding, aboveTop);
    setMenuPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    updateMenuPosition();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const toggleSelected = (appId: string) => {
    if (!availableAppIds.has(appId)) return;
    setSelectedIds((current) =>
      current.includes(appId) ? current.filter((id) => id !== appId) : [...current, appId],
    );
  };

  const addSelected = () => {
    for (const appId of selectedIds) {
      const app = apps.find((candidate) => candidate.id === appId);
      if (app && availableAppIds.has(app.id) && !containerApi.getPanel(app.id)) addAppPanel(containerApi, app);
    }
    setSelectedIds([]);
    setOpen(false);
  };

  const menu = open && menuPosition && (
    <div
      className="dock-add-menu"
      style={{ top: menuPosition.top, left: menuPosition.left }}
      onClick={(event) => event.stopPropagation()}
    >
      <header>
        <strong>Agregar apps</strong>
        <span>{availableApps.length} disponibles</span>
      </header>
      <div className="dock-add-list">
        {availableApps.map((app) => (
          <label key={app.id} className="dock-add-option">
            <input
              type="checkbox"
              checked={selectedIds.includes(app.id)}
              onChange={() => toggleSelected(app.id)}
            />
            <span className="dock-add-icon">{app.icon}</span>
            <span>
              <strong>{app.name}</strong>
              <small>{categoryLabel(app.category)}</small>
            </span>
          </label>
        ))}
        {availableApps.length === 0 && <p>Todos los modulos ya estan abiertos.</p>}
      </div>
      <footer>
        <button className="dock-add-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button className="dock-add-primary" disabled={selectedIds.length === 0} onClick={addSelected}>
          Agregar {selectedIds.length || ''}
        </button>
      </footer>
    </div>
  );

  return (
    <div className="dock-add-apps" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        className="dock-add-trigger"
        title="Agregar apps al workspace"
        aria-label="Agregar apps al workspace"
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
      >
        +
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

function PlaceholderPanel({ title, detail, app }: { title: string; detail: string; app?: AppMetadata }) {
  return (
    <div className="placeholder-panel">
      <div className="placeholder-icon">{app?.icon ?? '◆'}</div>
      <h1>{title}</h1>
      <p>{detail}</p>
      {app?.capabilities && (
        <div className="capability-list">
          {(app.capabilities.publishes ?? []).map((capability) => <span key={capability}>{capability}</span>)}
          {(app.capabilities.subscribes ?? []).map((capability) => <span key={capability}>{capability}</span>)}
        </div>
      )}
      {app?.entryPoint.kind === 'url' && (
        <button className="primary-link" onClick={() => openApp(app.id)}>Abrir ventana</button>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
