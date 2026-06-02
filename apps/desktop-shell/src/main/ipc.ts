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
  ipcMain.handle(RWP_IPC.REGISTER, (event, source: string) => {
    broker.register(toBrokerTarget(event.sender), source);
    event.sender.once('destroyed', () => broker.unregister(event.sender.id));
    return true;
  });

  ipcMain.on(RWP_IPC.PUBLISH, (event, envelope: RwpEnvelope) => {
    broker.publish(envelope, event.sender.id);
  });
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
