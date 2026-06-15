import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure preload bridge (contextIsolation on, nodeIntegration off).
 *
 * Exposes exactly two surfaces to every hosted renderer:
 *  - `window.rwp`        — the Retail Workspace Protocol transport (send/onMessage)
 *  - `window.retailData` — the data bridge to the main-process SQLite store
 *
 * No Node globals or `require` ever reach the renderer. Channel names mirror the
 * `RWP_IPC` constants in `@retail-os/rwp-electron-adapter`; they are inlined here
 * to keep the preload bundle free of the bus/rxjs dependency graph.
 */
const RWP = { PUBLISH: 'rwp:publish', DELIVER: 'rwp:deliver', REGISTER: 'rwp:register' } as const;

function resolveSource(): string {
  const sourceArg = process.argv.find((a) => a.startsWith('--retail-source='));
  if (sourceArg) return sourceArg.split('=')[1];
  try {
    const url = new URL(globalThis.location.href);
    return url.searchParams.get('retailSource') ?? url.searchParams.get('retailAppId') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const source = resolveSource();

interface DetachedWorkspacePayload {
  id: string;
  name: string;
  panelIds: string[];
  layout: unknown | null;
  sourceWorkspaceId?: string;
  targetX?: number;
  targetY?: number;
}

// Register this window with the main-process RWP broker.
void ipcRenderer.invoke(RWP.REGISTER, source);

// Apply theme to <html> — guard against the async resolve racing document init.
function applyTheme(theme: string) {
  const el = document.documentElement;
  if (el) el.dataset['theme'] = theme === 'light' ? 'light' : '';
}

void ipcRenderer.invoke('shell:getTheme').then((theme: string) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(theme), { once: true });
  } else {
    applyTheme(theme);
  }
});
ipcRenderer.on('shell:themeChanged', (_e, theme: string) => applyTheme(theme));

contextBridge.exposeInMainWorld('rwp', {
  source,
  send: (envelope: unknown) => ipcRenderer.send(RWP.PUBLISH, envelope),
  onMessage: (handler: (envelope: unknown) => void) => {
    const listener = (_e: unknown, envelope: unknown) => handler(envelope);
    ipcRenderer.on(RWP.DELIVER, listener);
    return () => ipcRenderer.removeListener(RWP.DELIVER, listener);
  },
});

contextBridge.exposeInMainWorld('retailData', {
  listProducts: () => ipcRenderer.invoke('retail:listProducts'),
  commitSale: (snapshot: unknown) => ipcRenderer.invoke('retail:commitSale', snapshot),
  getSyncStatus: () => ipcRenderer.invoke('retail:syncStatus'),
  getTerminal: () => ipcRenderer.invoke('retail:getTerminal'),
});

contextBridge.exposeInMainWorld('retailShell', {
  openApp: (appId: string, context?: unknown) => ipcRenderer.invoke('shell:openApp', appId, context),
  getPreloadPath: () => ipcRenderer.invoke('shell:getPreloadPath'),
  openWorkspaceWindow: (payload: DetachedWorkspacePayload) =>
    ipcRenderer.invoke('shell:openWorkspaceWindow', payload),
  getWorkspaceWindowPayload: (workspaceWindowId: string) =>
    ipcRenderer.invoke('shell:getWorkspaceWindowPayload', workspaceWindowId),
  updateWorkspaceWindowPayload: (payload: DetachedWorkspacePayload) =>
    ipcRenderer.invoke('shell:updateWorkspaceWindowPayload', payload),
  recallWorkspaceWindow: (workspaceWindowId: string) =>
    ipcRenderer.invoke('shell:recallWorkspaceWindow', workspaceWindowId),
  onWorkspaceWindowClosed: (handler: (payload: DetachedWorkspacePayload) => void) => {
    const listener = (_e: unknown, payload: DetachedWorkspacePayload) => handler(payload);
    ipcRenderer.on('shell:workspaceClosed', listener);
    return () => ipcRenderer.removeListener('shell:workspaceClosed', listener);
  },
  setTheme: (theme: string) => ipcRenderer.invoke('shell:setTheme', theme),
});

contextBridge.exposeInMainWorld('retailIntegrations', {
  tiendanubeConnect: (appId: string, clientSecret: string) =>
    ipcRenderer.invoke('retail:tiendanube:connect', appId, clientSecret),
  tiendanubeConnectDirect: (storeId: string, accessToken: string) =>
    ipcRenderer.invoke('retail:tiendanube:connectDirect', storeId, accessToken),
  tiendanubeSync: () => ipcRenderer.invoke('retail:tiendanube:sync'),
  tiendanubeDisconnect: () => ipcRenderer.invoke('retail:tiendanube:disconnect'),
  tiendanubeState: () => ipcRenderer.invoke('retail:tiendanube:state'),
  tiendanubeOnCatalogUpdated: (handler: (payload: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => handler(payload);
    ipcRenderer.on('tiendanube:catalogUpdated', listener);
    return () => ipcRenderer.removeListener('tiendanube:catalogUpdated', listener);
  },
  mercadopagoConnect: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('retail:mercadopago:connect', clientId, clientSecret),
  mercadopagoConnectDev: (accessToken: string) =>
    ipcRenderer.invoke('retail:mercadopago:connectDev', accessToken),
  mercadopagoDisconnect: () => ipcRenderer.invoke('retail:mercadopago:disconnect'),
  mercadopagoDiscoverTerminals: () => ipcRenderer.invoke('retail:mercadopago:discoverTerminals'),
  mercadopagoState: () => ipcRenderer.invoke('retail:mercadopago:state'),
});

contextBridge.exposeInMainWorld('retailOdoo', {
  fetchImage: (url: string) => ipcRenderer.invoke('retail:odoo:fetchImage', url),
  connect: (config: unknown) => ipcRenderer.invoke('retail:odoo:connect', config),
  disconnect: () => ipcRenderer.invoke('retail:odoo:disconnect'),
  getState: () => ipcRenderer.invoke('retail:odoo:state'),
  syncCatalog: () => ipcRenderer.invoke('retail:odoo:syncCatalog'),
  syncInventory: () => ipcRenderer.invoke('retail:odoo:syncInventory'),
  onStateChanged: (handler: (state: unknown) => void) => {
    const listener = (_e: unknown, state: unknown) => handler(state);
    ipcRenderer.on('odoo:stateChanged', listener);
    return () => ipcRenderer.removeListener('odoo:stateChanged', listener);
  },
  onInventoryUpdated: (handler: (payload: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => handler(payload);
    ipcRenderer.on('odoo:inventoryUpdated', listener);
    return () => ipcRenderer.removeListener('odoo:inventoryUpdated', listener);
  },
  onCatalogSynced: (handler: (payload: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => handler(payload);
    ipcRenderer.on('odoo:catalogSynced', listener);
    return () => ipcRenderer.removeListener('odoo:catalogSynced', listener);
  },
});

contextBridge.exposeInMainWorld('retailEnv', { inShell: true, appId: source });
