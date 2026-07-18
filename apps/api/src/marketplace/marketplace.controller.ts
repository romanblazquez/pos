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
  @ApiQuery({ name: 'publisher', required: false, description: 'Filter by publisher/editorial name or normalized slug', example: 'devir' })
  @ApiQuery({ name: 'yearPublished', required: false, type: Number, description: 'Exact publication year', example: 2025 })
  @ApiQuery({ name: 'minAge', required: false, type: Number, description: 'Exact recommended minimum age', example: 14 })
  @ApiQuery({ name: 'playTimeMinutes', required: false, type: Number, description: 'Exact advertised play time in minutes', example: 60 })
  @ApiQuery({ name: 'minPlayers', required: false, type: Number, description: 'Minimum number of players', example: 2 })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price in minor currency units (centavos)', example: 50000 })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price in minor currency units (centavos)', example: 500000 })
  @ApiQuery({ name: 'inStock', required: false, type: String, description: 'Filter to in-stock listings only. Pass "true" to enable', example: 'true' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return per page', example: 24 })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Zero-based offset for pagination', example: 0 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort order for results', example: 'rank_score', enum: ['rank_score', 'price_asc', 'price_desc', 'name'] })
  @ApiQuery({ name: 'locale', required: false, description: 'UI locale for name/description overrides (falls back to Spanish when no approved translation exists)', example: 'en' })
  @ApiQuery({ name: 'mechanics', required: false, description: 'Filter by one or more game mechanics (repeat the param for multiple)', example: 'Deck Building' })
  @ApiQuery({ name: 'complexity', required: false, description: 'Filter by BGG-weight complexity band', example: 'heavy', enum: ['light', 'medium-light', 'medium', 'heavy', 'expert'] })
  @ApiQuery({ name: 'semantic', required: false, type: String, description: 'Use meaning-based retrieval for an unfiltered natural-language query', example: 'true' })
  @ApiResponse({ status: 200, description: 'Returns { results: Product[], total: number, found: number }' })
  search(
    @Query('q')           q?: string,
    @Query('category')    category?: string,
    @Query('publisher')   publisher?: string,
    @Query('yearPublished') yearPublished?: string,
    @Query('minAge')      minAge?: string,
    @Query('playTimeMinutes') playTimeMinutes?: string,
    @Query('minPlayers')  minPlayers?: string,
    @Query('minPrice')    minPrice?: string,
    @Query('maxPrice')    maxPrice?: string,
    @Query('inStock')     inStock?: string,
    @Query('limit')       limit?: string,
    @Query('offset')      offset?: string,
    @Query('sortBy')      sortBy?: string,
    @Query('locale')      locale?: string,
    @Query('mechanics')   mechanics?: string | string[],
    @Query('complexity')  complexity?: string,
    @Query('semantic')    semantic?: string,
  ) {
    return this.svc.searchProducts({
      q,
      category,
      publisher,
      yearPublished: yearPublished ? parseInt(yearPublished, 10) : undefined,
      minAge: minAge ? parseInt(minAge, 10) : undefined,
      playTimeMinutes: playTimeMinutes ? parseInt(playTimeMinutes, 10) : undefined,
      minPlayers: minPlayers ? parseInt(minPlayers, 10) : undefined,
      minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
      inStockOnly: inStock === 'true',
      mechanics: mechanics ? (Array.isArray(mechanics) ? mechanics : [mechanics]) : undefined,
      complexity,
      limit: limit ? parseInt(limit, 10) : 24,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy,
      semantic: semantic === 'true',
    }, locale);
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

  @Get('mechanics')
  @ApiOperation({
    summary: 'List distinct game mechanics with active listings',
    description: 'Backs the marketplace\'s mechanics filter chips — only returns mechanics currently present on at least one published, active listing, ordered by popularity.',
  })
  @ApiResponse({ status: 200, description: 'Array of { mechanic, count }' })
  getMechanics() {
    return this.svc.getMechanics();
  }

  @Get('facets')
  @ApiOperation({ summary: 'List catalog facet values and counts for filter controls' })
  getFacets() {
    return this.svc.getFacets();
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete catalog products, publishers, and categories' })
  @ApiQuery({ name: 'q', required: false, description: 'Typo-tolerant suggestion query; empty returns trending products' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8 })
  getSuggestions(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.svc.getSuggestions(q, limit ? parseInt(limit, 10) : 8);
  }

  @Get('semantic')
  @ApiOperation({
    summary: 'Semantic product search',
    description: 'Meaning-based bilingual search over embedded shoppable products. Falls back to lexical search when embeddings or credentials are unavailable.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Natural-language search intent', example: 'a cooperative mystery for two players' })
  @ApiQuery({ name: 'locale', required: false, example: 'es' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 12 })
  semanticSearch(@Query('q') q = '', @Query('locale') locale?: string, @Query('limit') limit?: string) {
    return this.svc.semanticSearchProducts(q, locale, limit ? parseInt(limit, 10) : 24);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get product by slug',
    description: 'Fetches a single product by its URL-friendly slug, including all active seller listings ordered by rank score.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly product slug', example: 'catan-settlers-of' })
  @ApiQuery({ name: 'locale', required: false, description: 'UI locale for name/description overrides (falls back to Spanish when no approved translation exists)', example: 'en' })
  @ApiResponse({ status: 200, description: 'Product object with a listings array containing all active seller offers.' })
  @ApiResponse({ status: 404, description: 'No product found with this slug.' })
  async getProduct(@Param('slug') slug: string, @Query('locale') locale?: string) {
    const product = await this.svc.getProduct(slug, locale);
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  @Get(':slug/similar')
  @ApiOperation({
    summary: 'Similar products (same category, comparable complexity)',
    description: 'Ranked by the same stock/rating signal as default search sorting. Falls back to Prisma when Typesense is empty/unavailable.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly product slug', example: 'catan-settlers-of' })
  @ApiResponse({ status: 200, description: 'Array of up to 8 similar products.' })
  getSimilar(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.svc.getSimilarProducts(slug, 8, locale);
  }

  @Get(':slug/sales-by-year')
  @ApiOperation({
    summary: 'Live per-product sales count grouped by year',
    description: 'Counts confirmed/shipped/delivered orders only (excludes pending/reserved/cancelled/refunded). Computed on demand, not cached.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly product slug', example: 'catan-settlers-of' })
  @ApiResponse({ status: 200, description: 'Array of { year, count }, ascending by year.' })
  getSalesByYear(@Param('slug') slug: string) {
    return this.svc.getSalesByYear(slug);
  }
}
