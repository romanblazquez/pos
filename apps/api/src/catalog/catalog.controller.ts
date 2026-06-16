import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type { UpsertProductDto } from './catalog.dto.js';
import { Public } from '../auth/auth.guard.js';

// Tenant resolution is a stub: in production this comes from JWT auth middleware.
const DEFAULT_TENANT = 'tenant-demo';

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('products')
  list(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('sourceType') sourceType?: string,
  ) {
    return this.catalog.listProducts(DEFAULT_TENANT, {
      category,
      search,
      sourceType,
      active: active === undefined ? true : active === 'true',
    });
  }

  @Get('products/:id')
  get(@Param('id') id: string) {
    return this.catalog.getProduct(DEFAULT_TENANT, id);
  }

  @Post('products')
  create(@Body() dto: UpsertProductDto) {
    return this.catalog.createProduct(DEFAULT_TENANT, dto);
  }

  @Patch('products/:id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertProductDto>) {
    return this.catalog.updateProduct(DEFAULT_TENANT, id, dto);
  }

  @Delete('products/:id')
  deactivate(@Param('id') id: string) {
    return this.catalog.deactivateProduct(DEFAULT_TENANT, id);
  }

  @Get('categories')
  categories() {
    return this.catalog.getCategories(DEFAULT_TENANT);
  }

  /**
   * Bulk import from any source (called by Electron after Tiendanube sync,
   * or by a CSV upload, or by Shopify webhook).
   */
  @Post('import')
  import(@Body() body: { products: UpsertProductDto[] }) {
    return this.catalog.importProducts(DEFAULT_TENANT, body.products);
  }

  /**
   * Detach all products of a given sourceType from their origin — they become
   * native Retail OS products. Use this when migrating away from Tiendanube.
   */
  @Post('detach-source')
  detach(@Body() body: { sourceType: string }) {
    return this.catalog.detachFromSource(DEFAULT_TENANT, body.sourceType);
  }
}
