import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TiendanubeConnector } from '@retail-os/tiendanube';
import type { IConnector, ConnectorCredentials } from '@retail-os/connector-contracts';
import { encryptCredentials, decryptCredentials } from './credential-crypto.js';

/**
 * Central registry and credential loader for all connectors.
 * Each connector type is instantiated with a credential loader that reads
 * from the encrypted DB record — connectors never touch the DB directly.
 */
@Injectable()
export class ConnectorRegistryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Resolve the right connector for a given seller. */
  async forSeller(sellerId: string): Promise<IConnector> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { connectorType: true },
    });

    return this.forType(seller.connectorType ?? 'manual');
  }

  forType(connectorType: string): IConnector {
    const loader = (id: string) => this.loadCredentials(id);

    switch (connectorType) {
      case 'tiendanube':
        return new TiendanubeConnector(loader);
      default:
        throw new Error(`No connector registered for type "${connectorType}"`);
    }
  }

  private async loadCredentials(sellerId: string): Promise<ConnectorCredentials> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { connectorConfig: true },
    });

    if (!seller.connectorConfig) {
      throw new Error(`Seller ${sellerId} has no connector credentials configured`);
    }

    return decryptCredentials(seller.connectorConfig as Record<string, unknown>) as ConnectorCredentials;
  }

  async saveCredentials(sellerId: string, creds: ConnectorCredentials): Promise<void> {
    const raw = creds as Record<string, string>;
    // connectorType is metadata, not a credential — strip before encrypting
    const { connectorType, ...credFields } = raw;
    const encrypted = encryptCredentials(credFields);
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        connectorConfig: encrypted,
        // Also persist the connector type so forSeller() can resolve it
        ...(connectorType ? { connectorType } : {}),
      },
    });
  }

  async credentialsMatchStore(sellerId: string, storeId: string): Promise<boolean> {
    const credentials = await this.loadCredentials(sellerId);
    const configuredStoreId = (credentials as Record<string, unknown>).storeId
      ?? (credentials as Record<string, unknown>).userId;
    return String(configuredStoreId ?? '') === storeId;
  }
}
