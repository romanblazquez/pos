import { RwpBus } from '@retail-os/rwp-bus';
import { RendererBridgeTransport } from '@retail-os/rwp-electron-adapter';

const transport =
  typeof window !== 'undefined' && window.rwp
    ? new RendererBridgeTransport(window.rwp)
    : undefined;

export const bus = new RwpBus({
  source: 'app:customer-display',
  transport,
});
