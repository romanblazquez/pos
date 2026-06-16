import {
  Controller,
  Get,
  Patch,
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
import { SellersService, CreateSellerDto } from './sellers.service.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('sellers')
@ApiBearerAuth('seller-jwt')
@Public()
@Controller('api/v1/sellers')
export class SellersController {
  constructor(@Inject(SellersService) private readonly svc: SellersService) {}

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
  getListings(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.svc.getListings(id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      q,
      status,
      sort,
    });
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
  getOrders(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.svc.getOrders(id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
    });
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
    @Body() body: { priceMinorUnits?: number; stock?: number; active?: boolean },
  ) {
    return this.svc.updateListing(id, listingId, body);
  }
}
