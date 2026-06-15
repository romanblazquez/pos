import type {
  ErpAdapter,
  ErpIntentHandlerInfo,
  ErpIntentMap,
  ErpIntentName,
  ErpIntentResolution,
  ErpPlatformEvent,
  ErpSource,
} from '@retail-os/erp-core';
import { ErpIntentResolutionError } from '@retail-os/erp-core';

/**
 * ERP adapter registry and intent resolver.
 *
 * It mirrors the useful part of the FDC3 intent engine: static capabilities
 * are discoverable, runtime adapters are registered separately, and callers
 * raise an intent without importing the provider implementation.
 */
export class ErpPlatform {
  private readonly adapters = new Map<ErpSource, ErpAdapter>();
  private readonly adapterUnsubscribers = new Map<ErpSource, () => void>();
  private readonly listeners = new Set<(event: ErpPlatformEvent) => void>();

  registerAdapter(adapter: ErpAdapter): () => void {
    this.unregisterAdapter(adapter.source);
    this.adapters.set(adapter.source, adapter);
    this.adapterUnsubscribers.set(
      adapter.source,
      adapter.subscribe((event) => this.emit(event)),
    );
    return () => this.unregisterAdapter(adapter.source);
  }

  unregisterAdapter(source: ErpSource): void {
    this.adapterUnsubscribers.get(source)?.();
    this.adapterUnsubscribers.delete(source);
    this.adapters.delete(source);
  }

  listSources(): ErpSource[] {
    return [...this.adapters.keys()];
  }

  findIntent(intent: ErpIntentName, source?: ErpSource): ErpIntentHandlerInfo[] {
    return [...this.adapters.values()]
      .filter((adapter) => (!source || adapter.source === source) && adapter.capabilities.intents.includes(intent))
      .map((adapter) => ({
        source: adapter.source,
        intent,
        connected: adapter.connected,
      }));
  }

  async connect(source: ErpSource): Promise<void> {
    const adapter = this.adapters.get(source);
    if (!adapter) throw new ErpIntentResolutionError('FullErpSync', source, `ERP source "${source}" is not registered`);
    await adapter.connect();
  }

  disconnect(source: ErpSource): void {
    this.adapters.get(source)?.disconnect();
  }

  async raiseIntent<K extends ErpIntentName>(
    intent: K,
    payload: ErpIntentMap[K],
  ): Promise<ErpIntentResolution<K>> {
    const adapter = this.adapters.get(payload.source);
    if (!adapter || !adapter.capabilities.intents.includes(intent)) {
      throw new ErpIntentResolutionError(intent, payload.source);
    }
    if (!adapter.connected) {
      throw new ErpIntentResolutionError(intent, payload.source, `ERP source "${payload.source}" is not connected`);
    }
    const result = await adapter.invoke(intent, payload);
    return { source: adapter.source, intent, result };
  }

  subscribe(listener: (event: ErpPlatformEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ErpPlatformEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
