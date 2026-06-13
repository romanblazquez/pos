import { app, BrowserWindow, ipcMain, webContents } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { RwpBroker } from '@retail-os/rwp-electron-adapter';
import { setupSecurity } from './security.js';
import { LocalStore } from './local-store.js';
import { registerIpc } from './ipc.js';
import { WindowManager } from './window-manager.js';
import type { DetachedWorkspacePayload } from './window-manager.js';
import { ShellAssetsLoader } from './shell-assets-loader.js';
import appDirectory from '@config/app-directory.json';
import type { AppMetadata } from '@retail-os/app-registry';

// Resolve the manifest relative to the bundled resources directory so it
// works both in dev (repo root) and in a packaged app (app.getAppPath()).
const MANIFEST_PATH = join(app.getAppPath(), 'config/assets/desktop-shell.manifest.json');

// Theme state — persisted to userData so it survives restarts.
function getThemeFilePath() {
  return join(app.getPath('userData'), 'retail-os.theme.json');
}

function loadPersistedTheme(): 'dark' | 'light' {
  try {
    const raw = readFileSync(getThemeFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as { theme?: string };
    return parsed.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function savePersistedTheme(theme: 'dark' | 'light') {
  try {
    writeFileSync(getThemeFilePath(), JSON.stringify({ theme }), 'utf8');
  } catch { /* non-fatal */ }
}

// Loaded inside whenReady() where app.getPath('userData') is safe to call.
let currentTheme: 'dark' | 'light' = 'dark';

app.whenReady().then(() => {
  currentTheme = loadPersistedTheme();
  setupSecurity();

  const manifest = ShellAssetsLoader.load(MANIFEST_PATH, app.getVersion());

  // Apply dock icon early to avoid a brief default Electron icon flash on macOS.
  if (process.platform === 'darwin' && manifest.iconDockPath && app.dock) {
    try { app.dock.setIcon(manifest.iconDockPath); } catch { /* icon not ready yet */ }
  }

  const store = new LocalStore();
  store.startSync();

  const broker = new RwpBroker();
  registerIpc(store, broker);

  const windows = new WindowManager(appDirectory as AppMetadata[], manifest);
  ipcMain.handle('shell:openApp', (_e, appId: string, context?: unknown) => windows.openApp(appId, context));
  ipcMain.handle('shell:getPreloadPath', () => windows.getPreloadPath());
  ipcMain.handle('shell:openWorkspaceWindow', (_e, payload: DetachedWorkspacePayload) => {
    windows.createWorkspaceWindow(payload);
    return { opened: true, id: payload.id };
  });
  ipcMain.handle('shell:getWorkspaceWindowPayload', (_e, workspaceWindowId: string) =>
    windows.getWorkspaceWindowPayload(workspaceWindowId),
  );
  ipcMain.handle('shell:updateWorkspaceWindowPayload', (_e, payload: DetachedWorkspacePayload) => {
    windows.updateWorkspaceWindowPayload(payload);
    return true;
  });
  ipcMain.handle('shell:recallWorkspaceWindow', (_e, workspaceWindowId: string) =>
    windows.recallWorkspaceWindow(workspaceWindowId),
  );

  ipcMain.handle('shell:getTheme', () => currentTheme);
  ipcMain.handle('shell:setTheme', (_e, theme: string) => {
    if (theme !== 'dark' && theme !== 'light') return currentTheme;
    currentTheme = theme;
    savePersistedTheme(theme);
    for (const wc of webContents.getAllWebContents()) {
      if (!wc.isDestroyed()) wc.send('shell:themeChanged', theme);
    }
    return currentTheme;
  });

  const startAppId = process.env.RETAIL_START_APP;
  const skipLauncher = process.env.RETAIL_SKIP_LAUNCHER === 'true';

  if (!skipLauncher) windows.createLauncher();
  if (startAppId) windows.openApp(startAppId);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length > 0) return;
    if (startAppId && skipLauncher) windows.openApp(startAppId);
    else windows.createLauncher();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
