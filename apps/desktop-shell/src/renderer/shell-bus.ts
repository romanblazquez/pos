import { RwpBus } from '@retail-os/rwp-bus';
import { transportFromWindow } from '@retail-os/rwp-electron-adapter';

/**
 * The shell renderer's RWP bus instance. Connects to the main-process broker
 * via `window.rwp` so the shell can subscribe to events from hosted apps (the
 * POS, backoffice, etc.) and emit commands back to them. This enables
 * cross-panel workflows like the Virtual Terminal auto-opening when the POS
 * requests a payment.
 */
export const shellBus = new RwpBus({
  source: 'shell',
  transport: transportFromWindow() ?? undefined,
});
