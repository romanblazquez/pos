import { Body, Controller, Get, Inject, Param, Post, Query, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConnectorSyncService } from './sync.service.js';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { SellersService } from '../sellers/sellers.service.js';
import { Public } from '../auth/auth.guard.js';

const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

@ApiTags('connectors')
@Public()
@Controller('api/v1/sellers/:sellerId/connector')
export class ConnectorsController {
  constructor(
    @Inject(ConnectorSyncService)     private readonly sync: ConnectorSyncService,
    @Inject(ConnectorRegistryService) private readonly registry: ConnectorRegistryService,
    @Inject(SellersService)           private readonly sellers: SellersService,
  ) {}

  /** Save connector type to seller record, then return OAuth start URL. */
  @Get('oauth/start')
  async oauthStart(
    @Param('sellerId') sellerId: string,
    @Query('type') connectorType?: string,
  ) {
    // Persist the chosen connector type before building the connector instance
    if (connectorType) {
      await this.sellers.setConnectorType(sellerId, connectorType);
    }

    const connector = await this.registry.forSeller(sellerId);
    const redirectUri = `${API_BASE_URL}/api/v1/sellers/${sellerId}/connector/oauth/callback`;
    const result = await connector.startOAuth(sellerId, redirectUri);
    return result; // { authUrl, state }
  }

  /**
   * OAuth callback — Tiendanube (and other connectors) redirect here after the
   * seller authorises the app. Exchanges the code for credentials, persists them,
   * then sends the seller back to the portal with a success flag.
   */
  @Get('oauth/callback')
  @Redirect()
  async oauthCallback(
    @Param('sellerId') sellerId: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      const connector = await this.registry.forSeller(sellerId);
      const creds = await connector.exchangeCode(sellerId, code, state);
      await this.registry.saveCredentials(sellerId, creds);

      return {
        url: `${SELLER_PORTAL_URL}?oauth=success&seller=${sellerId}`,
        statusCode: 302,
      };
    } catch (err) {
      const msg = encodeURIComponent(String(err));
      return {
        url: `${SELLER_PORTAL_URL}?oauth=error&msg=${msg}`,
        statusCode: 302,
      };
    }
  }

  /** Last sync result per type (catalog / inventory / prices). */
  @Get('sync/status')
  syncStatus(@Param('sellerId') sellerId: string) {
    return this.sync.getSyncStatus(sellerId);
  }

  /** Manual trigger: sync catalog. Pass ?force=true to skip incremental and pull full catalog. */
  @Post('sync/catalog')
  syncCatalog(
    @Param('sellerId') sellerId: string,
    @Query('force') force?: string,
  ) {
    return this.sync.syncCatalog(sellerId, { force: force === 'true' });
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

  /**
   * Register a webhook with the seller's connector so we get real-time
   * push events (e.g. stock/price changes) without constant polling.
   */
  @Post('webhook/register')
  async registerWebhook(@Param('sellerId') sellerId: string) {
    const connector = await this.registry.forSeller(sellerId);
    if (!connector.subscribeInventory) {
      return { ok: false, message: 'Connector does not support webhooks' };
    }
    const callbackUrl = `${API_BASE_URL}/api/v1/webhooks/${connector.connectorType}/${sellerId}`;
    const result = await connector.subscribeInventory(sellerId, callbackUrl);
    return { ok: true, ...result };
  }

  /** Remove the registered webhook from the seller's connector. */
  @Post('webhook/unregister')
  async unregisterWebhook(
    @Param('sellerId') sellerId: string,
    @Query('webhookId') webhookId: string,
  ) {
    const connector = await this.registry.forSeller(sellerId);
    if (!connector.unsubscribeInventory) {
      return { ok: false, message: 'Connector does not support webhooks' };
    }
    await connector.unsubscribeInventory(sellerId, webhookId);
    return { ok: true };
  }

  /** Save connector credentials directly (dev / non-OAuth connectors). */
  @Post('credentials')
  saveCredentials(
    @Param('sellerId') sellerId: string,
    @Body() body: Record<string, string>,
  ) {
    return this.registry.saveCredentials(sellerId, body);
  }
}
