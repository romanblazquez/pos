import type { AppMetadata } from '@retail-os/app-registry';

export interface DetachedWorkspacePayload {
  id: string;
  name: string;
  panelIds: string[];
  layout: unknown | null;
  sourceWorkspaceId?: string;
  targetX?: number;
  targetY?: number;
}

/** Shell control surface exposed by the preload (`window.retailShell`). */
declare global {
  interface Window {
    retailShell?: {
      openApp(appId: string): Promise<void>;
      getPreloadPath(): Promise<string>;
      openWorkspaceWindow(payload: DetachedWorkspacePayload): Promise<{ opened: boolean; id: string }>;
      getWorkspaceWindowPayload(workspaceWindowId: string): Promise<DetachedWorkspacePayload | null>;
      updateWorkspaceWindowPayload(payload: DetachedWorkspacePayload): Promise<boolean>;
      recallWorkspaceWindow(workspaceWindowId: string): Promise<boolean>;
      onWorkspaceWindowClosed(handler: (payload: DetachedWorkspacePayload) => void): () => void;
    };
  }
}

export function openApp(appId: string): void {
  void window.retailShell?.openApp(appId);
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
