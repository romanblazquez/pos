import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { MarketsService } from './markets.service.js';
import { TenantMarketDto, CreateTenantMarketDto, UpdateTenantMarketDto } from './markets.dto.js';
import { Roles } from '../auth/auth.guard.js';

// Single-tenant today (DEFAULT_TENANT_ID) — every call implicitly scopes to
// that tenant. See default-market.constants.ts for the stub-tenant note.
@ApiTags('tenant-markets')
@Roles('admin')
@Controller('api/v1/admin/tenant-markets')
export class TenantMarketsController {
  constructor(@Inject(MarketsService) private readonly svc: MarketsService) {}

  @Get()
  @ApiOperation({ summary: "List the platform tenant's configured markets" })
  @ApiOkResponse({ type: TenantMarketDto, isArray: true })
  list(): Promise<TenantMarketDto[]> {
    return this.svc.listTenantMarkets();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new market (country/currency/language/timezone) for the platform tenant' })
  @ApiBody({ type: CreateTenantMarketDto })
  @ApiOkResponse({ type: TenantMarketDto })
  create(@Body() dto: CreateTenantMarketDto): Promise<TenantMarketDto> {
    return this.svc.createTenantMarket(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tenant market (currency, language, timezone, active flag)' })
  @ApiParam({ name: 'id', description: 'TenantMarket CUID' })
  @ApiBody({ type: UpdateTenantMarketDto })
  @ApiOkResponse({ type: TenantMarketDto })
  update(@Param('id') id: string, @Body() dto: UpdateTenantMarketDto): Promise<TenantMarketDto> {
    return this.svc.updateTenantMarket(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a tenant market' })
  @ApiParam({ name: 'id', description: 'TenantMarket CUID' })
  delete(@Param('id') id: string): Promise<void> {
    return this.svc.deleteTenantMarket(id);
  }
}
