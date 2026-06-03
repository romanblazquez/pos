import { ipcMain, type WebContents } from 'electron';
import { RwpBroker, RWP_IPC, type BrokerTarget } from '@retail-os/rwp-electron-adapter';
import type { RwpEnvelope } from '@retail-os/rwp-core';
import type { LocalStore } from './local-store.js';

/**
 * Wires the main-process IPC surface:
 *  - `retail:*` — the data bridge the POS uses to reach SQLite (list products,
 *    commit a sale, read sync status, get terminal identity).
 *  - `rwp:*`    — the RWP broker relay that fans envelopes across windows.
 */
export function registerIpc(store: LocalStore, broker: RwpBroker): void {
  // ── Data bridge ─────────────────────────────────────────────────────────
  ipcMain.handle('retail:listProducts', () => store.listProducts());
  ipcMain.handle('retail:commitSale', (_e, snapshot) => store.commitSale(snapshot));
  ipcMain.handle('retail:syncStatus', () => store.getSyncStatus());
  ipcMain.handle('retail:getTerminal', () => store.terminal);

  // ── RWP broker relay ──────────────────────────────────────────────────────
  const registeredWebContents = new Set<number>();

  ipcMain.handle(RWP_IPC.REGISTER, (event, source: string) => {
    broker.register(toBrokerTarget(event.sender), source);
    if (!registeredWebContents.has(event.sender.id)) {
      registeredWebContents.add(event.sender.id);
      event.sender.once('destroyed', () => {
        registeredWebContents.delete(event.sender.id);
        broker.unregister(event.sender.id);
      });
    }
    return true;
  });

  ipcMain.on(RWP_IPC.PUBLISH, (event, envelope: RwpEnvelope) => {
    broker.publish(envelope, event.sender.id);
  });

  // ── Tiendanube integration ──────────────────────────────────────────────
  ipcMain.handle('retail:tiendanube:connect', async (_e, appId: string, clientSecret: string) =>
    store.tiendanube.connect(appId, clientSecret),
  );
  ipcMain.handle('retail:tiendanube:sync', async () => store.tiendanube.syncProducts());
  ipcMain.handle('retail:tiendanube:disconnect', () => store.tiendanube.disconnect());
  ipcMain.handle('retail:tiendanube:state', () => store.tiendanube.getState());

  // ── Mercado Pago Point integration ─────────────────────────────────────
  ipcMain.handle('retail:mercadopago:connect', (_e, clientId: string, clientSecret: string) =>
    store.mercadopago.connect(clientId, clientSecret),
  );
  ipcMain.handle('retail:mercadopago:connectDev', (_e, accessToken: string) =>
    store.mercadopago.connectDev(accessToken),
  );
  ipcMain.handle('retail:mercadopago:disconnect', () => store.mercadopago.disconnect());
  ipcMain.handle('retail:mercadopago:discoverTerminals', () => store.mercadopago.discoverTerminals());
  ipcMain.handle('retail:mercadopago:state', () => store.mercadopago.getState());
}

function toBrokerTarget(sender: WebContents): BrokerTarget {
  return {
    id: sender.id,
    send: (channel, payload) => {
      if (!sender.isDestroyed()) sender.send(channel, payload);
    },
    isDestroyed: () => sender.isDestroyed(),
  };
}
