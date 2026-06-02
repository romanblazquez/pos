import type { RwpEnvelope } from '@retail-os/rwp-core';

/** Minimal view of an Electron webContents the broker needs (keeps electron out of this lib). */
export interface BrokerTarget {
  id: number;
  send(channel: string, payload: unknown): void;
  isDestroyed(): boolean;
}

/**
 * RwpBroker — main-process fan-out hub. The desktop-shell registers each
 * window's `webContents` here; when any window publishes an envelope the broker
 * delivers it to peer registered windows (respecting an explicit `target` when
 * present). The renderer transport handles local loopback for the sender. Last-
 * context values are cached so a window that opens late can be replayed the
 * current shared context.
 */
export class RwpBroker {
  private readonly windows = new Map<number, BrokerTarget>();
  /** logical source id → window id, for targeted delivery. */
  private readonly sources = new Map<string, number>();
  private readonly contextCache = new Map<string, RwpEnvelope>();

  register(target: BrokerTarget, source?: string): void {
    this.windows.set(target.id, target);
    if (source) this.sources.set(source, target.id);
    // Replay cached contexts to the newcomer.
    for (const env of this.contextCache.values()) {
      target.send('rwp:deliver', env);
    }
  }

  unregister(windowId: number): void {
    this.windows.delete(windowId);
    for (const [src, id] of this.sources) if (id === windowId) this.sources.delete(src);
  }

  /** Relay an envelope arriving from `fromWindowId` to its recipients. */
  publish(env: RwpEnvelope, fromWindowId: number): void {
    if (env.kind === 'event' && env.type.startsWith('rwp.context.')) {
      this.contextCache.set(env.type, env);
    }
    const targetId = env.target ? this.sources.get(env.target) : undefined;
    for (const [id, target] of this.windows) {
      if (target.isDestroyed()) {
        this.windows.delete(id);
        continue;
      }
      if (id === fromWindowId) continue; // renderer transport handles local loopback
      if (targetId !== undefined && id !== targetId) continue; // directed delivery
      target.send('rwp:deliver', env);
    }
  }
}
