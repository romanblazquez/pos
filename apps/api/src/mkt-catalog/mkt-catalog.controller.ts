import {
  Body, Controller, Get, Inject, Param, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MktCatalogService } from './mkt-catalog.service.js';
import { BggDiscoveryService } from './bgg-discovery.service.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('admin')
@Public()
@Controller('api/v1/admin/catalog')
export class MktCatalogController {
  constructor(
    @Inject(MktCatalogService) private readonly svc: MktCatalogService,
    @Inject(BggDiscoveryService) private readonly discovery: BggDiscoveryService,
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

  /** Bulk-import BGG's full ranks dump — the recommended way to populate the whole catalog. */
  @Post('bgg-discovery/import-full-catalog')
  @ApiOperation({
    summary: "Bulk-import BGG's full ranks dump (~178k games)",
    description:
      "Logs into BGG and downloads its daily CSV ranks dump (no registration required, unlike the per-item XML API), then upserts every game as a 'pending' MktProduct " +
      '(name, year, rank, rating, usersRated, isExpansion — no description/images/designer, since those need the registration-gated XML API). ' +
      'Runs in the background, typically finishes in minutes. Poll GET bgg-discovery/import-full-catalog/status for progress. Requires BGG_USERNAME/BGG_PASSWORD configured.',
  })
  @ApiResponse({ status: 201, description: '{ started: boolean } — false if a run is already in progress' })
  startFullCatalogImport() {
    return this.discovery.startFullCatalogImport();
  }

  /** Progress of the running (or last) full-catalog ranks-dump import. */
  @Get('bgg-discovery/import-full-catalog/status')
  @ApiOperation({
    summary: 'Full-catalog ranks-dump import progress',
    description: '{ running, total, imported, skipped, error? }',
  })
  fullCatalogImportStatus() {
    return this.discovery.fullCatalogImportStatus();
  }

  /** Start a full BGG catalog discovery + import run (per-page, per-item — see note). */
  @Post('bgg-discovery/start')
  @ApiOperation({
    summary: '[Secondary] Page-by-page BGG discovery + per-item import',
    description:
      'Logs into BGG and walks every page of the ranked browse listing, queuing every discovered game for import via BullMQ (bgg-discovery, bgg-import queues), respecting the ~1 req/sec BGG rate limit. ' +
      "NOTE: per-item enrichment calls BGG's XML API (/thing), which now requires a registered BGG application + token (BGG policy change, 2025-07-02) that this project does not have — import jobs queued by this path will fail until that's set up. " +
      'Prefer POST bgg-discovery/import-full-catalog instead, which gets rank/rating/year data for the whole catalog without hitting that wall.',
  })
  @ApiBody({
    schema: { type: 'object', properties: { startPage: { type: 'number', example: 1 } } },
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Discovery enqueued' })
  startBggDiscovery(@Body() body: { startPage?: number }) {
    return this.discovery.startDiscovery(body?.startPage ?? 1);
  }

  /** Progress of the running (or last) BGG discovery/import job. */
  @Get('bgg-discovery/status')
  @ApiOperation({
    summary: 'BGG discovery/import queue status',
    description: 'Returns BullMQ job counts (waiting/active/completed/failed/delayed) for both the discovery and import queues.',
  })
  @ApiResponse({ status: 200, description: '{ discovery: JobCounts, import: JobCounts }' })
  bggDiscoveryStatus() {
    return this.discovery.status();
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
