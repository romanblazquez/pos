import type { AppMetadata } from '@retail-os/app-registry';
import type { ErpInventoryUpdatedPayload, ErpCatalogSyncedPayload } from '@retail-os/erp-core';
import type { ProductSnapshot } from '@retail-os/catalog';

export interface DetachedWorkspacePayload {
  id: string;
  name: string;
  panelIds: string[];
  layout: unknown | null;
  sourceWorkspaceId?: string;
  targetX?: number;
  targetY?: number;
}

export interface OdooBridgeState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  url: string | null;
  database: string | null;
  version: string | null;
  catalogSource: 'odoo' | 'retail';
  catalogProductCount: number;
  pendingSaleExports: number;
  failedSaleExports: number;
  lastSyncAt: string | null;
  error: string | null;
}

export interface OdooBridgeConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  pollIntervalMs: number;
  warehouseId?: number;
  catalogSource?: 'odoo' | 'retail';
}

/** Shell control surface exposed by the preload (`window.retailShell`). */
declare global {
  interface Window {
    retailOdoo?: {
      fetchImage(url: string): Promise<string | null>;
      connect(config: OdooBridgeConfig): Promise<OdooBridgeState>;
      disconnect(): Promise<OdooBridgeState>;
      getState(): Promise<OdooBridgeState>;
      syncCatalog(): Promise<OdooBridgeState>;
      syncInventory(): Promise<OdooBridgeState>;
      onStateChanged(handler: (state: OdooBridgeState) => void): () => void;
      onInventoryUpdated(handler: (payload: ErpInventoryUpdatedPayload) => void): () => void;
      onCatalogSynced(handler: (payload: ErpCatalogSyncedPayload) => void): () => void;
    };
    retailData?: {
      listProducts(): Promise<ProductSnapshot[]>;
    };
    retailShell?: {
      openApp(appId: string, context?: unknown): Promise<void>;
      getPreloadPath(): Promise<string>;
      openWorkspaceWindow(payload: DetachedWorkspacePayload): Promise<{ opened: boolean; id: string }>;
      getWorkspaceWindowPayload(workspaceWindowId: string): Promise<DetachedWorkspacePayload | null>;
      updateWorkspaceWindowPayload(payload: DetachedWorkspacePayload): Promise<boolean>;
      recallWorkspaceWindow(workspaceWindowId: string): Promise<boolean>;
      onWorkspaceWindowClosed(handler: (payload: DetachedWorkspacePayload) => void): () => void;
      setTheme(theme: string): Promise<string>;
    };
  }
}

export function openApp(appId: string, context?: unknown): void {
  void window.retailShell?.openApp(appId, context);
}

export async function getPreloadPath(): Promise<string> {
  return window.retailShell?.getPreloadPath() ?? '';
}

export async function openWorkspaceWindow(payload: DetachedWorkspacePayload) {
  return window.retailShell?.openWorkspaceWindow(payload);
}

export async function getWorkspaceWindowPayload(workspaceWindowId: string) {
  return window.retailShell?.getWorkspaceWindowPayload(workspaceWindowId) ?? null;
}

export async function updateWorkspaceWindowPayload(payload: DetachedWorkspacePayload) {
  return window.retailShell?.updateWorkspaceWindowPayload(payload) ?? false;
}

export async function recallWorkspaceWindow(workspaceWindowId: string) {
  return window.retailShell?.recallWorkspaceWindow(workspaceWindowId) ?? false;
}

export function onWorkspaceWindowClosed(handler: (payload: DetachedWorkspacePayload) => void) {
  return window.retailShell?.onWorkspaceWindowClosed(handler) ?? (() => undefined);
}

export type { AppMetadata };
