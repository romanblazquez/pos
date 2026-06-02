import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import type { AppMetadata } from '@retail-os/app-registry';

const PRELOAD = join(__dirname, '../preload/preload.js');

export interface DetachedWorkspacePayload {
  id: string;
  name: string;
  panelIds: string[];
  layout: unknown | null;
  sourceWorkspaceId?: string;
  targetX?: number;
  targetY?: number;
}

/** Secure defaults applied to every window (context isolation on, no nodeIntegration). */
function secureWebPreferences(source: string, options: { webviewTag?: boolean } = {}) {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webviewTag: options.webviewTag ?? false,
    additionalArguments: [`--retail-source=${source}`],
  };
}

function appendQuery(url: string, query: string): string {
  const hashIndex = url.indexOf('#');
  const baseUrl = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}${hash}`;
}

/**
 * WindowManager — owns the launcher window and the per-app windows. Each hosted
 * app runs in its own context-isolated BrowserWindow with the shared secure
 * preload, identified to the RWP broker via an `--retail-source` argument.
 */
export class WindowManager {
  private readonly appWindows = new Map<string, BrowserWindow>();
  private readonly detachedWorkspaces = new Map<string, DetachedWorkspacePayload>();
  private readonly detachedWindows = new Map<string, BrowserWindow>();
  private shellWindow: BrowserWindow | null = null;

  constructor(private readonly apps: AppMetadata[]) {}

  createLauncher(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1280,
      height: 820,
      title: 'Retail OS',
      backgroundColor: '#0f1115',
      webPreferences: secureWebPreferences('shell', { webviewTag: true }),
    });
    this.shellWindow = win;
    win.on('closed', () => {
      if (this.shellWindow === win) this.shellWindow = null;
    });
    this.loadRenderer(win);
    return win;
  }

  getPreloadPath(): string {
    return PRELOAD;
  }

  /** Open (or focus) a hosted app by id as a standalone BrowserWindow. */
  openApp(appId: string, context?: unknown): void {
    const existing = this.appWindows.get(appId);
    if (existing && !existing.isDestroyed()) {
      const app = this.apps.find((candidate) => candidate.id === appId);
      if (app && app.entryPoint.kind === 'route') {
        void existing.loadURL(this.resolveStandaloneAppUrl(app, context));
      }
      existing.focus();
      return;
    }
    const app = this.apps.find((candidate) => candidate.id === appId);
    if (!app) return;

    const win = new BrowserWindow({
      width: app.id === 'pos' ? 1180 : 980,
      height: app.id === 'pos' ? 800 : 700,
      title: `Retail OS — ${app.name}`,
      backgroundColor: '#0f1115',
      webPreferences: secureWebPreferences(`app:${app.id}`),
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    void win.loadURL(this.resolveStandaloneAppUrl(app, context));
    this.appWindows.set(appId, win);
    win.on('closed', () => this.appWindows.delete(appId));
  }

  createWorkspaceWindow(payload: DetachedWorkspacePayload): void {
    this.detachedWorkspaces.set(payload.id, payload);
    const win = new BrowserWindow({
      width: 1320,
      height: 860,
      minWidth: 900,
      minHeight: 620,
      title: payload.name,
      backgroundColor: '#0f1115',
      webPreferences: secureWebPreferences(`workspace:${payload.id}`, { webviewTag: true }),
    });
    const url = appendQuery(this.getShellUrl(), `detachedWorkspaceId=${encodeURIComponent(payload.id)}`);
    void win.loadURL(url);
    if (payload.targetX !== undefined && payload.targetY !== undefined) {
      win.once('ready-to-show', () => win.setPosition(payload.targetX!, payload.targetY!));
    }
    this.detachedWindows.set(payload.id, win);
    win.on('closed', () => this.returnDetachedWorkspace(payload.id));
  }

  getWorkspaceWindowPayload(workspaceWindowId: string): DetachedWorkspacePayload | null {
    return this.detachedWorkspaces.get(workspaceWindowId) ?? null;
  }

  updateWorkspaceWindowPayload(payload: DetachedWorkspacePayload): void {
    this.detachedWorkspaces.set(payload.id, payload);
  }

  recallWorkspaceWindow(workspaceWindowId: string): boolean {
    const target = this.detachedWindows.get(workspaceWindowId);
    if (!target || target.isDestroyed()) return false;
    target.close();
    return true;
  }

  private loadRenderer(win: BrowserWindow): void {
    void win.loadURL(this.getShellUrl());
  }

  private getShellUrl(): string {
    return process.env.ELECTRON_RENDERER_URL ?? `file://${join(__dirname, '../renderer/index.html')}`;
  }

  private resolveStandaloneAppUrl(app: AppMetadata, context?: unknown): string {
    const contextQuery =
      context === undefined ? '' : `&retailContext=${encodeURIComponent(JSON.stringify(context))}`;
    if (app.entryPoint.kind === 'url') {
      return appendQuery(
        app.entryPoint.url,
        `retailAppId=${encodeURIComponent(app.id)}&retailSource=${encodeURIComponent(`app:${app.id}`)}${contextQuery}`,
      );
    }
    return appendQuery(this.getShellUrl(), `standaloneAppId=${encodeURIComponent(app.id)}${contextQuery}`);
  }

  private returnDetachedWorkspace(workspaceWindowId: string): void {
    const payload = this.detachedWorkspaces.get(workspaceWindowId);
    this.detachedWorkspaces.delete(workspaceWindowId);
    this.detachedWindows.delete(workspaceWindowId);
    if (!payload || !this.shellWindow || this.shellWindow.isDestroyed()) return;
    if (this.shellWindow.isMinimized()) this.shellWindow.restore();
    this.shellWindow.focus();
    this.shellWindow.webContents.send('shell:workspaceClosed', payload);
  }
}
