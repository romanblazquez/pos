import {
  Controller,
  Get,
  Patch,
  Delete,
  Inject,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service.js';
import { SellerMappingService } from './seller-mapping.service.js';
import { CreateSellerDto, UpdateListingDto, UpdateSellerProfileDto } from './sellers.dto.js';
import { Public } from '../auth/auth.guard.js';
import { paginate } from '../common/pagination.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { AiService } from '../ai/ai.service.js';

@ApiTags('sellers')
@ApiBearerAuth('seller-jwt')
@Public()
@Controller('api/v1/sellers')
export class SellersController {
  constructor(
    @Inject(SellersService) private readonly svc: SellersService,
    @Inject(LoyaltyService) private readonly loyalty: LoyaltyService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(SellerMappingService) private readonly mapping: SellerMappingService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new seller account',
    description:
      'Registers a new seller in the platform. The email must be unique across all sellers. ' +
      'On success the full seller record is returned with its generated CUID. ' +
      'Returns 409 if the email is already in use.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name:          { type: 'string', example: 'Acme Store' },
        email:         { type: 'string', format: 'email', example: 'store@acme.com' },
        phone:         { type: 'string', example: '+52 55 1234 5678' },
        country:       { type: 'string', example: 'MX' },
        timezone:      { type: 'string', example: 'America/Mexico_City' },
        connectorType: {
          type: 'string',
          example: 'tiendanube',
          description: 'Connector platform this seller will use (tiendanube | shopify | mercadolibre | woocommerce)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Seller created successfully. Returns the new seller record.' })
  @ApiResponse({ status: 409, description: 'A seller with this email already exists.' })
  create(@Body() dto: CreateSellerDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all sellers',
    description:
      'Returns a paginated list of sellers, optionally filtered by status. ' +
      'Each seller object includes a computed score field. ' +
      'Use `limit` and `offset` for pagination.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by seller status. Valid values: pending | active | suspended',
    example: 'active',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results to return. Default 50, max 200.',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of records to skip for pagination. Default 0.',
    example: 0,
  })
  @ApiResponse({ status: 200, description: 'Array of seller objects with score field.' })
  list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a seller by ID',
    description:
      'Returns a single seller record by its CUID. ' +
      'Throws 404 if no seller exists with the given ID.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({ status: 200, description: 'Seller found and returned.' })
  @ApiResponse({ status: 404, description: 'Seller not found.' })
  async findOne(@Param('id') id: string) {
    const seller = await this.svc.findById(id);
    if (!seller) throw new NotFoundException(`Seller "${id}" not found`);
    return seller;
  }

  @Get(':id/sync/status')
  @ApiOperation({
    summary: 'Get sync health for a seller',
    description:
      'Returns the most recent sync log entry for each sync type (catalog, inventory, prices) ' +
      'for the given seller. Useful for dashboards to show when data was last refreshed ' +
      'and whether any sync type is failing. Always returns 200 — missing entries simply ' +
      'mean that sync type has never run.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Last sync log entry per type. Returns an object keyed by sync type.',
  })
  getSyncHealth(@Param('id') id: string) {
    return this.svc.getSyncHealth(id);
  }

  @Get(':id/listings/stats')
  @ApiOperation({
    summary: 'Get listing statistics for a seller',
    description:
      'Returns aggregated counts of all listings for the seller, broken down by stock status. ' +
      'Always returns 200 — counts will be 0 if the seller has no listings.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Listing counts: { total, active, outOfStock, lowStock }',
    schema: {
      type: 'object',
      properties: {
        total:      { type: 'number', example: 320 },
        active:     { type: 'number', example: 290 },
        outOfStock: { type: 'number', example: 15 },
        lowStock:   { type: 'number', example: 15 },
      },
    },
  } as any)
  getListingStats(@Param('id') id: string) {
    return this.svc.getListingStats(id);
  }

  @Get(':id/listings')
  @ApiOperation({
    summary: 'Get paginated listing catalog for a seller',
    description:
      'Returns a page of product listings for the seller. Supports full-text search on ' +
      'product name via the `q` parameter, status filtering, and multiple sort orders. ' +
      'All prices are stored and returned in minor currency units (cents).',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({ name: 'page',   required: false, description: 'Page number (1-based). Default 1.', example: 1 })
  @ApiQuery({ name: 'limit',  required: false, description: 'Results per page. Default 24, max 200.', example: 24 })
  @ApiQuery({ name: 'q',      required: false, description: 'Product name search term (case-insensitive partial match).', example: 'camiseta' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by listing status. Valid values: active | inactive | out_of_stock | low_stock',
    example: 'active',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sort order. Valid values: recent | price_asc | price_desc | stock_asc | stock_desc. Default recent.',
    example: 'recent',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated listings result: { listings, total, page, limit }',
  })
  async getListings(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    const result = await this.svc.getListings(id, { page: p, limit: l, q, status, sort });
    return paginate(result.listings, result.total, p, l);
  }

  // ── Product mapping inbox ───────────────────────────────────────────────
  // Items synced from a connector that couldn't be confidently matched to the
  // master catalog land here for the seller to resolve manually.

  @Get(':id/product-mappings')
  @ApiOperation({
    summary: "List items awaiting the seller's catalog match decision",
    description:
      'Items synced from a connector that the matching engine could not confidently ' +
      'link to a master catalog product. Default `status` is `pending_review` (needs seller action); ' +
      'pass `escalated` to see items already sent to admin, or `rejected` for dismissed ones.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({ name: 'status', required: false, example: 'pending_review' })
  @ApiQuery({ name: 'limit', required: false, example: 24 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  async listMappings(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.mapping.list(id, {
      status,
      limit: limit ? parseInt(limit, 10) : 24,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return paginate(result.mappings, result.total, 1, limit ? parseInt(limit, 10) : 24);
  }

  @Get(':id/product-mappings/search')
  @ApiOperation({
    summary: 'Search the master catalog to manually link a pending item',
    description: 'Free-text search by product name, for the "none of these match, let me search" flow.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({ name: 'q', required: true, example: 'Catan' })
  searchCatalog(@Param('id') _id: string, @Query('q') q: string) {
    return this.mapping.searchCatalog(q ?? '');
  }

  @Patch(':id/product-mappings/:mappingId/link')
  @ApiOperation({
    summary: 'Link a pending item to a master catalog product',
    description:
      'Creates the Listing for this seller × product (unpublished — the seller must separately ' +
      'publish it from the listings page) and marks the mapping resolved.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiParam({ name: 'mappingId', description: 'SellerProductMapping CUID', example: 'clx9xyz8wvu7tsr6qpo' })
  @ApiBody({ schema: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' } } } })
  linkMapping(
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
    @Body() body: { productId: string },
  ) {
    return this.mapping.link(id, mappingId, body.productId);
  }

  @Post(':id/product-mappings/:mappingId/escalate')
  @ApiOperation({
    summary: 'Escalate a pending item to the admin review queue',
    description: '"I can\'t find this in the catalog, please add it" — sent to admin for triage against BGG/master catalog.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiParam({ name: 'mappingId', description: 'SellerProductMapping CUID', example: 'clx9xyz8wvu7tsr6qpo' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } }, required: false })
  escalateMapping(
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
    @Body() body?: { note?: string },
  ) {
    return this.mapping.escalate(id, mappingId, body?.note);
  }

  @Delete(':id/product-mappings/:mappingId')
  @ApiOperation({
    summary: 'Dismiss a pending item without escalating',
    description: 'Use when the synced item is irrelevant/duplicate and the seller does not want it listed at all.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiParam({ name: 'mappingId', description: 'SellerProductMapping CUID', example: 'clx9xyz8wvu7tsr6qpo' })
  dismissMapping(@Param('id') id: string, @Param('mappingId') mappingId: string) {
    return this.mapping.dismiss(id, mappingId);
  }

  @Get(':id/orders/stats')
  @ApiOperation({
    summary: 'Get order KPIs for a seller',
    description:
      'Returns order summary statistics and a 7-day daily revenue breakdown for the seller. ' +
      'All monetary values are in minor currency units (cents). ' +
      'Always returns 200 — counts and revenue will be 0 if the seller has no orders.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description:
      'Order KPIs plus 7-day daily buckets. ' +
      '{ total, pending, confirmed, shipped, cancelled, revenueMinorUnits, daily: [{ date, orders, revenueMinor }] }',
  })
  getOrderStats(@Param('id') id: string) {
    return this.svc.getOrderStats(id);
  }

  @Get(':id/orders')
  @ApiOperation({
    summary: 'Get paginated orders for a seller',
    description:
      'Returns a page of orders for the seller, including line items. ' +
      'Filter by status to show only orders in a specific stage of the fulfillment flow. ' +
      'Always returns 200.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({ name: 'page',  required: false, description: 'Page number (1-based). Default 1.', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page. Default 20.', example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status. Valid values: pending | confirmed | shipped | delivered | cancelled',
    example: 'pending',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated orders result: { orders, total, page, limit }',
  })
  async getOrders(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    const result = await this.svc.getOrders(id, { page: p, limit: l, status });
    return paginate(result.orders, result.total, p, l);
  }

  @Get(':id/analytics/top-products')
  @ApiOperation({
    summary: 'Get top products by revenue for a seller',
    description:
      'Returns the top N products ranked by total revenue for this seller. ' +
      'Revenue is expressed in minor currency units (cents). ' +
      'Always returns 200 — returns an empty array if the seller has no orders.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of top products to return. Default 5.',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Array of top products: [{ name, image, units, revenueMinor }]',
  })
  getTopProducts(@Param('id') id: string, @Query('limit') limit = '5') {
    return this.svc.getTopProducts(id, parseInt(limit, 10));
  }

  @Get(':id/rewards')
  @ApiOperation({ summary: 'Get seller reward program config' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiResponse({ status: 200, description: 'Flat reward config: { sellerId, storeCashbackPct, effectiveCommissionPct, platformCashbackPct, totalBuyerCashbackPct }' })
  async getRewards(@Param('id') id: string) {
    const [config, platformCfg] = await Promise.all([
      this.loyalty.getSellerRewardConfig(id),
      this.loyalty.getPlatformConfig(),
    ]);
    const sellerPctInt = Math.round(config.storeCashbackPct * 100);
    const effectiveCommissionPct = Math.max(
      platformCfg.baseCommissionPct - Math.floor(sellerPctInt / 2) * 0.01,
      platformCfg.minCommissionPct,
    );
    return {
      sellerId: id,
      storeCashbackPct: config.storeCashbackPct,
      effectiveCommissionPct,
      platformCashbackPct: platformCfg.platformCashbackPct,
      totalBuyerCashbackPct: platformCfg.platformCashbackPct + config.storeCashbackPct,
    };
  }

  @Patch(':id/rewards')
  @ApiOperation({ summary: 'Update seller store cashback rate' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiBody({ schema: { type: 'object', properties: { storeCashbackPct: { type: 'number', example: 0.02 } } } })
  @ApiResponse({ status: 200, description: 'Updated reward config.' })
  async updateRewards(@Param('id') id: string, @Body() body: { storeCashbackPct: number }) {
    await this.loyalty.updateSellerRewardConfig(id, body.storeCashbackPct ?? 0);
    return this.getRewards(id);
  }

  @Patch(':id/profile')
  @ApiOperation({
    summary: 'Update seller profile',
    description: 'Updates the seller display name, phone, or timezone. Email and country cannot be changed here.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({ status: 200, description: 'Updated seller record.' })
  @ApiResponse({ status: 404, description: 'Seller not found.' })
  updateProfile(@Param('id') id: string, @Body() dto: UpdateSellerProfileDto) {
    return this.svc.updateProfile(id, dto);
  }

  // ── Per-listing promos ─────────────────────────────────────────────────────

  @Get(':id/listings/:listingId/promos')
  @ApiOperation({ summary: 'List promos for a listing' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiResponse({ status: 200, description: 'Array of ListingPromo objects.' })
  getListingPromos(@Param('id') id: string, @Param('listingId') listingId: string) {
    return this.svc.getListingPromos(id, listingId);
  }

  @Post(':id/listings/:listingId/promos')
  @ApiOperation({ summary: 'Create a per-listing bonus cashback promo' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bonusCashbackPct'],
      properties: {
        bonusCashbackPct: { type: 'number', description: 'Extra store-credit % (0–0.50)', example: 0.05 },
        label: { type: 'string', description: 'Display label for the promo', example: 'Semana del juego' },
        startsAt: { type: 'string', format: 'date-time', description: 'When the promo starts (null = immediately)' },
        endsAt:   { type: 'string', format: 'date-time', description: 'When the promo ends (null = indefinite)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Created ListingPromo.' })
  createListingPromo(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Body() body: { bonusCashbackPct: number; label?: string; startsAt?: string; endsAt?: string },
  ) {
    return this.svc.createListingPromo(id, listingId, body);
  }

  @Patch(':id/listings/:listingId/promos/:promoId')
  @ApiOperation({ summary: 'Update a listing promo' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiParam({ name: 'promoId', description: 'Promo CUID' })
  @ApiResponse({ status: 200, description: 'Updated ListingPromo.' })
  updateListingPromo(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Param('promoId') promoId: string,
    @Body() body: { bonusCashbackPct?: number; label?: string; startsAt?: string | null; endsAt?: string | null; active?: boolean },
  ) {
    return this.svc.updateListingPromo(id, listingId, promoId, body);
  }

  @Delete(':id/listings/:listingId/promos/:promoId')
  @ApiOperation({ summary: 'Delete a listing promo' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiParam({ name: 'promoId', description: 'Promo CUID' })
  @ApiResponse({ status: 200, description: 'Promo deleted.' })
  async deleteListingPromo(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Param('promoId') promoId: string,
  ) {
    await this.svc.deleteListingPromo(id, listingId, promoId);
    return { deleted: true };
  }

  @Patch(':id/listings/:listingId')
  @ApiOperation({
    summary: 'Update a listing price, stock, or active status',
    description:
      'Partially updates a listing that belongs to this seller. ' +
      'All fields are optional — send only the fields you want to change. ' +
      'Prices must be provided in minor currency units (e.g. 1999 = $19.99). ' +
      'Returns 404 if the listing does not exist or is not owned by this seller.',
  })
  @ApiParam({ name: 'id',        description: 'Seller CUID',  example: 'clx1abc2def3ghi4jkl' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID', example: 'clx9xyz8wvu7tsr6qpo' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        priceMinorUnits: {
          type: 'integer',
          description: 'New price in minor currency units (cents). e.g. 1999 = $19.99',
          example: 1999,
        },
        stock: {
          type: 'integer',
          description: 'New stock quantity.',
          example: 42,
        },
        active: {
          type: 'boolean',
          description: 'Whether the listing is visible/available.',
          example: true,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Listing updated successfully. Returns the updated listing record.' })
  @ApiResponse({ status: 404, description: 'Listing not found or does not belong to this seller.' })
  updateListing(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Body() body: UpdateListingDto,
  ) {
    return this.svc.updateListing(id, listingId, body);
  }

  @Patch(':id/listings/:listingId/relink')
  @ApiOperation({
    summary: 'Re-pair an already-matched listing to a different master catalog product',
    description:
      'For correcting a wrong auto/manual match after the fact — search the catalog ' +
      '(GET :id/product-mappings/search?q=) and pass the chosen productId here.',
  })
  @ApiParam({ name: 'id', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID', example: 'clx9xyz8wvu7tsr6qpo' })
  @ApiBody({ schema: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Listing re-linked to the new product. Returns the updated listing with its new product.' })
  @ApiResponse({ status: 404, description: 'Listing not found or does not belong to this seller.' })
  relinkListing(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Body() body: { productId: string },
  ) {
    return this.mapping.relinkListing(id, listingId, body.productId);
  }

  // ── AI enhancement ────────────────────────────────────────────────────────

  @Post(':id/listings/:listingId/ai-enhance')
  @ApiOperation({ summary: 'Generate AI SEO suggestions for a listing (preview only — does not save)' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiResponse({ status: 200, description: 'AI-generated SEO suggestions. Apply them with PATCH :id/listings/:listingId/product.' })
  async aiEnhanceListing(@Param('id') id: string, @Param('listingId') listingId: string) {
    return this.svc.aiEnhanceListing(id, listingId, this.ai);
  }

  @Patch(':id/listings/:listingId/product')
  @ApiOperation({ summary: 'Apply AI (or manual) edits to the underlying product fields' })
  @ApiParam({ name: 'id', description: 'Seller CUID' })
  @ApiParam({ name: 'listingId', description: 'Listing CUID' })
  @ApiBody({ schema: { type: 'object', properties: {
    name:        { type: 'string' },
    description: { type: 'string' },
    slug:        { type: 'string' },
    tags:        { type: 'array', items: { type: 'string' } },
    sellerSku:   { type: 'string' },
  }}})
  @ApiResponse({ status: 200, description: 'Product updated.' })
  applyProductPatch(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Body() body: { name?: string; description?: string; slug?: string; tags?: string[]; sellerSku?: string },
  ) {
    return this.svc.applyProductPatch(id, listingId, body);
  }
}
