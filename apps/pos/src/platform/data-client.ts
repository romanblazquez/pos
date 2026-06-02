import type { ProductSnapshot } from '@retail-os/catalog';
import type { SaleSnapshot } from '@retail-os/sales';
import seedProducts from '@config/seed-products.json';
import type { RetailDataApi } from './bridge.js';

/**
 * Browser fallback for {@link RetailDataApi}. When the POS runs outside the
 * Electron shell there is no SQLite, so we serve the seeded catalog from config
 * and keep committed sales in memory. This keeps the POS demoable in any browser
 * while the shell provides the durable, offline SQLite-backed implementation.
 */
class InMemoryDataClient implements RetailDataApi {
  private readonly committed: SaleSnapshot[] = [];

  async listProducts(): Promise<ProductSnapshot[]> {
    return seedProducts as ProductSnapshot[];
  }

  async commitSale(snapshot: SaleSnapshot): Promise<{ ok: boolean }> {
    this.committed.push(snapshot);
    // eslint-disable-next-line no-console
    console.info('[pos] (browser fallback) committed sale', snapshot.saleId);
    return { ok: true };
  }

  async getSyncStatus() {
    return { online: false, pending: this.committed.length, lastSyncedAt: null };
  }

  async getTerminal() {
    return { tenantId: 'demo-tenant', storeId: 'demo-store', deviceId: 'browser-device', currency: 'MXN' };
  }
}

/** Use the shell's SQLite-backed API when present, else the in-memory fallback. */
export const dataClient: RetailDataApi = window.retailData ?? new InMemoryDataClient();
