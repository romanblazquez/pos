import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { TiendanubeConnector } from '@retail-os/tiendanube';
import type { IConnector, ConnectorCredentials } from '@retail-os/connector-contracts';

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
      throw new Error(`Seller ${sellerId} has no connector config`);
    }

    // In production: decrypt at this point using a KMS key.
    // For now, connectorConfig is stored as-is (plaintext) for dev.
    return seller.connectorConfig as unknown as ConnectorCredentials;
  }

  async saveCredentials(sellerId: string, creds: ConnectorCredentials): Promise<void> {
    // In production: encrypt before saving.
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { connectorConfig: creds as Record<string, string> },
    });
  }
}
