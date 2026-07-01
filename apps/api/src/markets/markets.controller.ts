import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { MarketsService } from './markets.service.js';
import { MarketDto } from './markets.dto.js';
import { Public } from '../auth/auth.guard.js';

@ApiTags('markets')
@Public()
@Controller('api/v1/markets')
export class MarketsController {
  constructor(@Inject(MarketsService) private readonly svc: MarketsService) {}

  @Get()
  @ApiOperation({ summary: 'List active countries/currencies/languages for market pickers' })
  @ApiOkResponse({ type: MarketDto, isArray: true })
  list(): Promise<MarketDto[]> {
    return this.svc.list();
  }

  @Get('default')
  @ApiOperation({ summary: "The platform's default market (falls back to MX/MXN/es if unseeded)" })
  @ApiOkResponse({ type: MarketDto })
  getDefault(): Promise<MarketDto> {
    return this.svc.getDefault();
  }
}
