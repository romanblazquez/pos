/**
 * IPC channel constants for bridging RWP across Electron BrowserWindows.
 *
 * The main process runs an RWP **broker**: it receives envelopes from any
 * window on {@link RWP_IPC.PUBLISH} and fans them out to every other window on
 * {@link RWP_IPC.DELIVER}. This mirrors the reference shell's `ipc-router`, but
 * carries opaque RWP envelopes instead of FDC3 contexts/intents.
 */
export const RWP_IPC = {
  /** renderer → main: an outbound RWP envelope to broker. */
  PUBLISH: 'rwp:publish',
  /** main → renderer: an inbound RWP envelope delivered to this window. */
  DELIVER: 'rwp:deliver',
  /** renderer → main (invoke): register this window's logical source id. */
  REGISTER: 'rwp:register',
} as const;

/** Surface the preload exposes on `window.rwp` for the renderer transport. */
export interface WindowRwpBridge {
  /** Send an envelope (serialized) to the main-process broker. */
  send(envelope: unknown): void;
  /** Subscribe to envelopes delivered from the broker. Returns unsubscribe. */
  onMessage(handler: (envelope: unknown) => void): () => void;
  /** This window's logical RWP source id (e.g. 'app:pos'). */
  source: string;
}

declare global {
  interface Window {
    rwp?: WindowRwpBridge;
  }
}
