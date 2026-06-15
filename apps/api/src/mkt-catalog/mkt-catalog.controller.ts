import {
  Body, Controller, Get, Inject, Param, Post, Query,
} from '@nestjs/common';
import { MktCatalogService } from './mkt-catalog.service.js';

@Controller('api/v1/admin/catalog')
export class MktCatalogController {
  constructor(
    @Inject(MktCatalogService) private readonly svc: MktCatalogService,
  ) {}

  /** List all marketplace products (admin view). */
  @Get('products')
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
  importOne(@Param('id') bggId: string) {
    return this.svc.importByBggId(bggId);
  }

  /** Bulk import from a list of BGG IDs. */
  @Post('import/bgg/bulk')
  bulk(@Body() body: { bggIds: string[] }) {
    return this.svc.bulkImport(body.bggIds);
  }

  /** Search BGG for games to import. */
  @Get('bgg/search')
  searchBgg(@Query('q') q: string) {
    return this.svc.searchBgg(q);
  }

  /** Re-sync a product to the search index. */
  @Post('products/:id/reindex')
  reindex(@Param('id') id: string) {
    return this.svc.syncToSearch(id).then(() => ({ ok: true }));
  }
}
