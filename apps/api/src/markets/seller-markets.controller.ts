import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { MarketsService } from './markets.service.js';
import { SellerMarketDto, CreateSellerMarketDto, UpdateSellerMarketDto } from './markets.dto.js';
import { Roles } from '../auth/auth.guard.js';

@ApiTags('seller-markets')
@Roles('seller', 'admin')
@Controller('api/v1/sellers/:sellerId/markets')
export class SellerMarketsController {
  constructor(@Inject(MarketsService) private readonly svc: MarketsService) {}

  @Get()
  @ApiOperation({ summary: "List a seller's configured markets" })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID' })
  @ApiOkResponse({ type: SellerMarketDto, isArray: true })
  list(@Param('sellerId') sellerId: string): Promise<SellerMarketDto[]> {
    return this.svc.listSellerMarkets(sellerId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a market the seller operates in (country, settlement currency, shipping)' })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID' })
  @ApiBody({ type: CreateSellerMarketDto })
  @ApiOkResponse({ type: SellerMarketDto })
  create(@Param('sellerId') sellerId: string, @Body() dto: CreateSellerMarketDto): Promise<SellerMarketDto> {
    return this.svc.createSellerMarket(sellerId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a seller market' })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID' })
  @ApiParam({ name: 'id', description: 'SellerMarket CUID' })
  @ApiBody({ type: UpdateSellerMarketDto })
  @ApiOkResponse({ type: SellerMarketDto })
  update(
    @Param('sellerId') sellerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSellerMarketDto,
  ): Promise<SellerMarketDto> {
    return this.svc.updateSellerMarket(sellerId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a seller market' })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID' })
  @ApiParam({ name: 'id', description: 'SellerMarket CUID' })
  delete(@Param('sellerId') sellerId: string, @Param('id') id: string): Promise<void> {
    return this.svc.deleteSellerMarket(sellerId, id);
  }
}
