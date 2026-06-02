import { RwpBus } from '@retail-os/rwp-bus';
import { transportFromWindow } from '@retail-os/rwp-electron-adapter';

/**
 * The POS's singleton RWP bus. Inside the Electron shell it bridges across
 * windows via `window.rwp`; in a plain browser it falls back to an in-process
 * bus so the POS is fully functional standalone.
 */
export const bus = new RwpBus({
  source: 'app:pos',
  transport: transportFromWindow() ?? undefined,
});
