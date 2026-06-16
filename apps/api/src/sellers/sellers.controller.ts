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
import { ApiTags } from '@nestjs/swagger';
import { SellersService, CreateSellerDto } from './sellers.service.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('sellers')
@Public()
@Controller('api/v1/sellers')
export class SellersController {
  constructor(@Inject(SellersService) private readonly svc: SellersService) {}

  @Post()
  create(@Body() dto: CreateSellerDto) {
    return this.svc.create(dto);
  }

  @Get()
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
  async findOne(@Param('id') id: string) {
    const seller = await this.svc.findById(id);
    if (!seller) throw new NotFoundException(`Seller "${id}" not found`);
    return seller;
  }

  @Get(':id/sync/status')
  getSyncHealth(@Param('id') id: string) {
    return this.svc.getSyncHealth(id);
  }

  @Get(':id/listings/stats')
  getListingStats(@Param('id') id: string) {
    return this.svc.getListingStats(id);
  }

  @Get(':id/listings')
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
  getOrderStats(@Param('id') id: string) {
    return this.svc.getOrderStats(id);
  }

  @Get(':id/orders')
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
  getTopProducts(@Param('id') id: string, @Query('limit') limit = '5') {
    return this.svc.getTopProducts(id, parseInt(limit, 10));
  }

  @Patch(':id/listings/:listingId')
  updateListing(
    @Param('id') id: string,
    @Param('listingId') listingId: string,
    @Body() body: { priceMinorUnits?: number; stock?: number; active?: boolean },
  ) {
    return this.svc.updateListing(id, listingId, body);
  }
}
