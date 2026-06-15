import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ConnectorSyncService } from './sync.service.js';
import { ConnectorRegistryService } from './connector-registry.service.js';

@Controller('api/v1/sellers/:sellerId/connector')
export class ConnectorsController {
  constructor(
    @Inject(ConnectorSyncService)      private readonly sync: ConnectorSyncService,
    @Inject(ConnectorRegistryService)  private readonly registry: ConnectorRegistryService,
  ) {}

  /** Manual trigger: sync catalog for a seller. */
  @Post('sync/catalog')
  syncCatalog(@Param('sellerId') sellerId: string) {
    return this.sync.syncCatalog(sellerId);
  }

  /** Manual trigger: sync inventory for a seller. */
  @Post('sync/inventory')
  syncInventory(@Param('sellerId') sellerId: string) {
    return this.sync.syncInventory(sellerId);
  }

  /** Manual trigger: sync prices for a seller. */
  @Post('sync/prices')
  syncPrices(@Param('sellerId') sellerId: string) {
    return this.sync.syncPrices(sellerId);
  }

  /** Ping the seller's connector. */
  @Get('ping')
  async ping(@Param('sellerId') sellerId: string) {
    const connector = await this.registry.forSeller(sellerId);
    return connector.ping(sellerId);
  }

  /** Save connector credentials (called after OAuth callback). */
  @Post('credentials')
  saveCredentials(
    @Param('sellerId') sellerId: string,
    @Body() body: Record<string, string>,
  ) {
    return this.registry.saveCredentials(sellerId, body);
  }

  /** Start OAuth flow — returns redirect URL for the seller. */
  @Get('oauth/start')
  async oauthStart(
    @Param('sellerId') sellerId: string,
  ) {
    const connector = await this.registry.forSeller(sellerId);
    const redirectUri = `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/v1/sellers/${sellerId}/connector/oauth/callback`;
    return connector.startOAuth(sellerId, redirectUri);
  }
}
