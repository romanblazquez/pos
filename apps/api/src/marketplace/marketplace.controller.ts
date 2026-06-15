import {
  Controller, Get, Inject, Param, Query, NotFoundException,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service.js';

@Controller('api/v1/products')
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService) private readonly svc: MarketplaceService,
  ) {}

  @Get()
  search(
    @Query('q')           q?: string,
    @Query('category')    category?: string,
    @Query('minPlayers')  minPlayers?: string,
    @Query('minPrice')    minPrice?: string,
    @Query('maxPrice')    maxPrice?: string,
    @Query('inStock')     inStock?: string,
    @Query('limit')       limit?: string,
    @Query('offset')      offset?: string,
    @Query('sortBy')      sortBy?: string,
  ) {
    return this.svc.searchProducts({
      q,
      category,
      minPlayers: minPlayers ? parseInt(minPlayers, 10) : undefined,
      minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
      inStockOnly: inStock === 'true',
      limit: limit ? parseInt(limit, 10) : 24,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy,
    });
  }

  @Get(':slug')
  async getProduct(@Param('slug') slug: string) {
    const product = await this.svc.getProduct(slug);
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }
}
