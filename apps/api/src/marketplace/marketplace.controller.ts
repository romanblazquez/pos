import {
  Controller, Get, Inject, Param, Query, NotFoundException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('marketplace')
@Public()
@Controller('api/v1/products')
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService) private readonly svc: MarketplaceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search products',
    description: 'Full-text and filtered product search across all active marketplace listings. Results are paginated and sortable.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search query', example: 'Catan' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category slug', example: 'strategy' })
  @ApiQuery({ name: 'minPlayers', required: false, type: Number, description: 'Minimum number of players', example: 2 })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price in minor currency units (centavos)', example: 50000 })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price in minor currency units (centavos)', example: 500000 })
  @ApiQuery({ name: 'inStock', required: false, type: String, description: 'Filter to in-stock listings only. Pass "true" to enable', example: 'true' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return per page', example: 24 })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Zero-based offset for pagination', example: 0 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort order for results', example: 'rank_score', enum: ['rank_score', 'price_asc', 'price_desc', 'name'] })
  @ApiResponse({ status: 200, description: 'Returns { results: Product[], total: number, found: number }' })
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

  @Get('categories')
  @ApiOperation({
    summary: 'List distinct categories with active listings',
    description: 'Backs the marketplace\'s category-browse tiles — only returns categories that currently have at least one published, active listing.',
  })
  @ApiResponse({ status: 200, description: 'Array of { category, count }' })
  getCategories() {
    return this.svc.getCategories();
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete catalog products, publishers, and categories' })
  @ApiQuery({ name: 'q', required: false, description: 'Typo-tolerant suggestion query; empty returns trending products' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8 })
  getSuggestions(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.svc.getSuggestions(q, limit ? parseInt(limit, 10) : 8);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get product by slug',
    description: 'Fetches a single product by its URL-friendly slug, including all active seller listings ordered by rank score.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly product slug', example: 'catan-settlers-of' })
  @ApiResponse({ status: 200, description: 'Product object with a listings array containing all active seller offers.' })
  @ApiResponse({ status: 404, description: 'No product found with this slug.' })
  async getProduct(@Param('slug') slug: string) {
    const product = await this.svc.getProduct(slug);
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }
}
