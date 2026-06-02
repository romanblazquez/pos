import { Subject, type Observable } from 'rxjs';
import type { RwpEnvelope } from '@retail-os/rwp-core';

/**
 * RwpTransport — the wire under the bus. The bus itself is transport-agnostic:
 * in a single renderer it uses {@link InProcessTransport}; across Electron
 * BrowserWindows the `rwp-electron-adapter` provides an IPC-backed transport
 * that relays envelopes through the main-process broker. This is the hexagonal
 * port that keeps RWP semantics independent of delivery.
 */
export interface RwpTransport {
  /** Push an envelope outward (to peers / the broker). */
  send(envelope: RwpEnvelope): void;
  /** Stream of envelopes arriving from peers / the broker. */
  readonly incoming$: Observable<RwpEnvelope>;
}

/** Loopback transport: everything sent is immediately delivered back locally. */
export class InProcessTransport implements RwpTransport {
  private readonly subject = new Subject<RwpEnvelope>();
  readonly incoming$ = this.subject.asObservable();

  send(envelope: RwpEnvelope): void {
    // Deliver asynchronously to mimic real transports and avoid re-entrancy.
    queueMicrotask(() => this.subject.next(envelope));
  }
}
