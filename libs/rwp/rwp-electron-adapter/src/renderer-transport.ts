import { Subject, type Observable } from 'rxjs';
import type { RwpEnvelope } from '@retail-os/rwp-core';
import type { RwpTransport } from '@retail-os/rwp-bus';
import type { WindowRwpBridge } from './ipc-channels.js';

/**
 * RendererBridgeTransport — an {@link RwpTransport} that relays envelopes over
 * the secure `window.rwp` contextBridge surface to the main-process broker, and
 * receives broker deliveries back. Drop this into an `RwpBus` inside any hosted
 * app and its events/intents/context flow across every window.
 */
export class RendererBridgeTransport implements RwpTransport {
  private readonly subject = new Subject<RwpEnvelope>();
  readonly incoming$: Observable<RwpEnvelope> = this.subject.asObservable();

  constructor(private readonly bridge: WindowRwpBridge) {
    this.bridge.onMessage((env) => this.subject.next(env as RwpEnvelope));
  }

  send(envelope: RwpEnvelope): void {
    queueMicrotask(() => this.subject.next(envelope));
    this.bridge.send(envelope);
  }
}

/** Build a bus transport from `window.rwp`, or null when not in the shell. */
export function transportFromWindow(): RendererBridgeTransport | null {
  if (typeof window === 'undefined' || !window.rwp) return null;
  return new RendererBridgeTransport(window.rwp);
}
