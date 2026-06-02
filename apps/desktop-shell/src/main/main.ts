import { app, BrowserWindow, ipcMain } from 'electron';
import { RwpBroker } from '@retail-os/rwp-electron-adapter';
import { setupSecurity } from './security.js';
import { LocalStore } from './local-store.js';
import { registerIpc } from './ipc.js';
import { WindowManager } from './window-manager.js';
import type { DetachedWorkspacePayload } from './window-manager.js';
import appDirectory from '@config/app-directory.json';
import type { AppMetadata } from '@retail-os/app-registry';

/**
 * Retail OS desktop shell — main entry.
 *
 * Boots the secure Electron host, opens the SQLite-backed local store, starts
 * the offline sync engine, stands up the RWP broker, registers the IPC bridge,
 * and shows the Odoo-style launcher.
 */
app.whenReady().then(() => {
  setupSecurity();

  const store = new LocalStore();
  store.startSync();

  const broker = new RwpBroker();
  registerIpc(store, broker);

  const windows = new WindowManager(appDirectory as AppMetadata[]);
  ipcMain.handle('shell:openApp', (_e, appId: string) => windows.openApp(appId));
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
