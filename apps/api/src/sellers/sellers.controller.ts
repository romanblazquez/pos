import {
  Controller,
  Get,
  Inject,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { SellersService, CreateSellerDto } from './sellers.service.js';

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
}
