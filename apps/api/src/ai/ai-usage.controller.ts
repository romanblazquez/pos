import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { AiUsageService } from './ai-usage.service.js';
import { Roles } from '../auth/auth.guard.js';

@ApiTags('ai-usage')
@Controller('api/v1')
export class AiUsageController {
  constructor(@Inject(AiUsageService) private readonly svc: AiUsageService) {}

  @Get('sellers/:sellerId/ai-usage')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: "A seller's AI enrichment tier, monthly budget, and usage so far this month" })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID' })
  @ApiOkResponse({ description: '{ tier, used, limit, remaining, unlimited }' })
  getSellerUsage(@Param('sellerId') sellerId: string) {
    return this.svc.getUsage(sellerId);
  }

  @Get('admin/ai-usage')
  @Roles('admin')
  @ApiOperation({ summary: 'AI enrichment usage this month across every paid-tier seller' })
  @ApiOkResponse({ description: 'Array of { sellerId, sellerName, tier, used, limit, remaining, unlimited }' })
  listAdminUsage() {
    return this.svc.listAdminUsage();
  }
}
