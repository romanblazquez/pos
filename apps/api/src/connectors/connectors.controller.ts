import { Body, Controller, Get, Inject, Param, Post, Query, Redirect } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConnectorSyncService } from './sync.service.js';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { SellersService } from '../sellers/sellers.service.js';
import { Public, Roles } from '../auth/auth.guard.js';
import { OAuthStateService } from '../auth/oauth-state.service.js';

const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

@ApiTags('connectors')
@ApiBearerAuth('seller-jwt')
@Roles('seller', 'admin')
@Controller('api/v1/sellers/:sellerId/connector')
export class ConnectorsController {
  constructor(
    @Inject(ConnectorSyncService)     private readonly sync: ConnectorSyncService,
    @Inject(ConnectorRegistryService) private readonly registry: ConnectorRegistryService,
    @Inject(SellersService)           private readonly sellers: SellersService,
    @Inject(OAuthStateService)        private readonly oauthState: OAuthStateService,
  ) {}

  /** Save connector type to seller record, then return OAuth start URL. */
  @Get('oauth/start')
  @ApiOperation({
    summary: 'Initiate OAuth flow for a seller connector',
    description:
      'Optionally persists the connector type on the seller record (via the `type` query param), ' +
      'then returns an `{ authUrl, state }` object. ' +
      'Redirect the seller\'s browser to `authUrl` to begin the authorization flow. ' +
      'The `state` value is an opaque CSRF token that the connector platform will return in the callback.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({
    name: 'type',
    required: false,
    description:
      'Connector type to persist on the seller before building the OAuth URL. ' +
      'Valid values: tiendanube | shopify | mercadolibre | woocommerce',
    example: 'tiendanube',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth start URLs. Redirect the seller to `authUrl`.',
    schema: {
      type: 'object',
      properties: {
        authUrl: { type: 'string', example: 'https://www.tiendanube.com/apps/authorize?...' },
        state:   { type: 'string', example: 'abc123-csrf-token' },
      },
    },
  } as any)
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
    const state = await this.oauthState.create(`connector:${connector.connectorType}`, sellerId);
    const result = await connector.startOAuth(sellerId, redirectUri, state);
    return result; // { authUrl, state }
  }

  /**
   * OAuth callback — Tiendanube (and other connectors) redirect here after the
   * seller authorises the app. Exchanges the code for credentials, persists them,
   * then sends the seller back to the portal with a success flag.
   */
  @Get('oauth/callback')
  @Public()
  @Redirect()
  @ApiOperation({
    summary: 'OAuth redirect callback (called by connector platform)',
    description:
      'This endpoint is the redirect URI registered with the external connector platform. ' +
      'Do not call this endpoint directly — the connector platform (e.g. Tiendanube) redirects ' +
      'the seller here after they approve access. ' +
      'The endpoint exchanges the authorization code for credentials, saves them encrypted, ' +
      'and then redirects the seller\'s browser to the seller portal with an `?oauth=success` flag. ' +
      'On failure it redirects to `?oauth=error&msg=...`.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({ name: 'code',  required: true,  description: 'Authorization code returned by the connector platform.' })
  @ApiQuery({ name: 'state', required: true,  description: 'CSRF state token returned by the connector platform. Must match the value from oauth/start.' })
  @ApiResponse({ status: 302, description: 'Redirects to the seller portal with oauth=success or oauth=error.' })
  async oauthCallback(
    @Param('sellerId') sellerId: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      const connector = await this.registry.forSeller(sellerId);
      await this.oauthState.consume(`connector:${connector.connectorType}`, sellerId, state);
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
  @ApiOperation({
    summary: 'Get last sync status per sync type',
    description:
      'Returns the most recent sync log entry for each sync type (catalog, inventory, prices) ' +
      'for this seller. Use this to build a sync health dashboard or to determine when ' +
      'data was last updated. Always returns 200.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Array of sync status entries: [{ type, lastRun, status, itemsSynced, itemsFailed }]',
  })
  syncStatus(@Param('sellerId') sellerId: string) {
    return this.sync.getSyncStatus(sellerId);
  }

  /** Manual trigger: sync catalog. Pass ?force=true to skip incremental and pull full catalog. */
  @Post('sync/catalog')
  @ApiOperation({
    summary: 'Trigger a catalog sync',
    description:
      'Triggers an immediate catalog sync for the seller\'s connector. ' +
      'By default the sync is incremental — only products updated since the last successful ' +
      'catalog sync are fetched from the connector platform. ' +
      'Pass `?force=true` to bypass the incremental filter and pull the entire catalog. ' +
      'Force syncs take significantly longer for large catalogs.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({
    name: 'force',
    required: false,
    description: 'Set to "true" to pull the full catalog instead of only changed products.',
    example: 'true',
  })
  @ApiResponse({
    status: 201,
    description: 'Sync completed. Returns SyncResult: { sellerId, syncType, status, itemsSynced, itemsFailed, errors, durationMs }',
  })
  syncCatalog(
    @Param('sellerId') sellerId: string,
    @Query('force') force?: string,
  ) {
    return this.sync.syncCatalog(sellerId, { force: force === 'true' });
  }

  /** Manual trigger: sync inventory for a seller. */
  @Post('sync/inventory')
  @ApiOperation({
    summary: 'Trigger an inventory sync',
    description:
      'Triggers an immediate inventory sync for the seller, updating stock levels for all listings. ' +
      'Returns a SyncResult with counts of items synced and any errors encountered.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 201,
    description: 'Sync completed. Returns SyncResult: { sellerId, syncType, status, itemsSynced, itemsFailed, errors, durationMs }',
  })
  syncInventory(@Param('sellerId') sellerId: string) {
    return this.sync.syncInventory(sellerId);
  }

  /** Manual trigger: sync prices for a seller. */
  @Post('sync/prices')
  @ApiOperation({
    summary: 'Trigger a price sync',
    description:
      'Triggers an immediate price sync for the seller, updating prices for all listings. ' +
      'Returns a SyncResult with counts of items synced and any errors encountered.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 201,
    description: 'Sync completed. Returns SyncResult: { sellerId, syncType, status, itemsSynced, itemsFailed, errors, durationMs }',
  })
  syncPrices(@Param('sellerId') sellerId: string) {
    return this.sync.syncPrices(sellerId);
  }

  /** Ping the seller's connector. */
  @Get('ping')
  @ApiOperation({
    summary: 'Health-check the seller connector credentials',
    description:
      'Validates that the stored connector credentials are still valid by making a lightweight ' +
      'authenticated request to the external platform. Also measures round-trip latency. ' +
      'Use this to detect expired tokens or revoked access before attempting a full sync.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Ping result: { ok: boolean, latencyMs: number, message?: string }',
    schema: {
      type: 'object',
      properties: {
        ok:        { type: 'boolean', example: true },
        latencyMs: { type: 'number',  example: 142 },
        message:   { type: 'string',  example: 'Credentials valid' },
      },
    },
  } as any)
  async ping(@Param('sellerId') sellerId: string) {
    const connector = await this.registry.forSeller(sellerId);
    return connector.ping(sellerId);
  }

  /**
   * Register a webhook with the seller's connector so we get real-time
   * push events (e.g. stock/price changes) without constant polling.
   */
  @Post('webhook/register')
  @ApiOperation({
    summary: 'Register a product/updated webhook with the seller connector',
    description:
      'Registers a `product/updated` webhook with the seller\'s external store so the platform ' +
      'receives real-time stock and price change events without polling. ' +
      'The callback URL is set to `/api/v1/webhooks/{connectorType}/{sellerId}`. ' +
      'If the connector does not support webhooks, returns `{ ok: false, message }`. ' +
      'On success returns `{ ok: true, webhookId, topic, callbackUrl }`.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 201,
    description: 'Webhook registered. Returns { ok: true, webhookId, topic, callbackUrl } or { ok: false, message }',
  })
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
  @ApiOperation({
    summary: 'Remove a registered webhook from the seller connector',
    description:
      'Deletes a previously registered webhook from the external store using the `webhookId` ' +
      'returned by the register endpoint. ' +
      'If the connector does not support webhooks, returns `{ ok: false, message }`.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({
    name: 'webhookId',
    required: true,
    description: 'The webhook ID returned by the webhook/register endpoint.',
    example: 'wh_12345',
  })
  @ApiResponse({ status: 201, description: 'Webhook removed. Returns { ok: true }.' })
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
  @ApiOperation({
    summary: 'Save connector credentials directly',
    description:
      'Stores connector credentials directly on the seller record without going through OAuth. ' +
      'Used for non-OAuth connectors (e.g. CSV import, Manual connector, or development overrides). ' +
      'The body is connector-specific — pass key/value pairs as required by your connector type. ' +
      'Credentials are encrypted before storage.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiBody({
    description: 'Connector-specific credential key/value pairs.',
    schema: {
      type: 'object',
      additionalProperties: { type: 'string' },
      example: { apiKey: 'sk_live_abc123', storeId: '98765' },
    },
  })
  @ApiResponse({ status: 201, description: 'Credentials saved successfully.' })
  saveCredentials(
    @Param('sellerId') sellerId: string,
    @Body() body: Record<string, string>,
  ) {
    return this.registry.saveCredentials(sellerId, body);
  }
}
