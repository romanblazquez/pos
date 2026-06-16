import {
  Body, Controller, Get, Inject, Param, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MktCatalogService } from './mkt-catalog.service.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('admin')
@Public()
@Controller('api/v1/admin/catalog')
export class MktCatalogController {
  constructor(
    @Inject(MktCatalogService) private readonly svc: MktCatalogService,
  ) {}

  /** List all marketplace products (admin view). */
  @Get('products')
  @ApiOperation({
    summary: 'List all marketplace products (admin)',
    description:
      'Returns all MktProduct records. Use `status` to filter: `pending` products need admin review and BGG matching before appearing in the public catalog. `approved` products are live.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by canonicalStatus: pending | approved | rejected', example: 'pending' })
  @ApiResponse({ status: 200, description: 'Paginated product list' })
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      status,
    });
  }

  /** Import a single game by BGG ID. */
  @Post('import/bgg/:id')
  @ApiOperation({
    summary: 'Import a board game from BoardGameGeek by BGG ID',
    description:
      'Fetches game metadata from the BGG XML API2, creates or updates an MktProduct with name, description, images, player count, play time, BGG rating, and weight complexity. Sets canonicalStatus to `approved`. Idempotent — re-importing the same ID updates the record.',
  })
  @ApiParam({ name: 'id', description: 'BoardGameGeek game ID (numeric)', example: '13' })
  @ApiResponse({ status: 201, description: 'Product created or updated from BGG data' })
  @ApiResponse({ status: 400, description: 'BGG ID not found or BGG API error' })
  importOne(@Param('id') bggId: string) {
    return this.svc.importByBggId(bggId);
  }

  /** Bulk import from a list of BGG IDs. */
  @Post('import/bgg/bulk')
  @ApiOperation({
    summary: 'Bulk-import board games from BGG',
    description:
      'Imports multiple games in sequence. Returns an array of results with success/failure per ID. Partial failures do not abort the batch.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['bggIds'],
      properties: {
        bggIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['13', '30549', '167791'],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Array of import results — one entry per BGG ID' })
  bulk(@Body() body: { bggIds: string[] }) {
    return this.svc.bulkImport(body.bggIds);
  }

  /** Search BGG for games to import. */
  @Get('bgg/search')
  @ApiOperation({
    summary: 'Search BoardGameGeek for games to import',
    description:
      'Queries the BGG search API and returns matching game titles with their BGG IDs. Use the returned IDs with the import endpoints.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search term', example: 'Catan' })
  @ApiResponse({ status: 200, description: 'Array of { bggId, name, yearPublished } matches' })
  searchBgg(@Query('q') q: string) {
    return this.svc.searchBgg(q);
  }

  /** Re-sync a product to the search index. */
  @Post('products/:id/reindex')
  @ApiOperation({
    summary: 'Re-sync a product to the Typesense search index',
    description:
      'Forces a full reindex of the product in Typesense, updating rank scores and listing counts. Use after manually editing a product or if a product is missing from search results.',
  })
  @ApiParam({ name: 'id', description: 'MktProduct CUID', example: 'clxproduct456' })
  @ApiResponse({ status: 200, description: 'Returns { ok: true } when reindex completes' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  reindex(@Param('id') id: string) {
    return this.svc.syncToSearch(id).then(() => ({ ok: true }));
  }
}
