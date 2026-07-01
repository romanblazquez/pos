import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ShelfService } from './shelf.service.js';
import { SetShelfStatusDto, ImportGuestShelfDto, AwardXpDto } from './shelf.dto.js';
import { Roles } from '../auth/auth.guard.js';

@ApiTags('shelf')
@Roles('customer', 'admin')
@Controller('api/v1/customers/:customerId/shelf')
export class ShelfController {
  constructor(@Inject(ShelfService) private readonly svc: ShelfService) {}

  @Get()
  @ApiOperation({
    summary: "Get a customer's collection shelf + XP",
    description: 'Returns shelf items (owned/wishlist/want-to-play/previously-owned/for-trade/preordered), total XP, and the 10 most recent XP events.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiResponse({ status: 200, description: '{ items: ShelfItem[], totalXp: number, recentEvents: XpEvent[] }' })
  getShelf(@Param('customerId') customerId: string) {
    return this.svc.getShelf(customerId);
  }

  // Must be declared before the ':productSlug' route below — Nest matches
  // routes in declaration order, so a literal segment after a dynamic
  // param needs to come first or it's swallowed as a slug value.
  @Put('import-guest')
  @ApiOperation({
    summary: 'One-time bulk import of a guest (localStorage) shelf on first login',
    description: 'Upserts each item by slug; never re-awards XP for products the customer already has on their shelf.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiBody({ type: ImportGuestShelfDto })
  @ApiResponse({ status: 200, description: 'Updated shelf + XP state.' })
  importGuestShelf(@Param('customerId') customerId: string, @Body() dto: ImportGuestShelfDto) {
    return this.svc.importGuestShelf(customerId, dto.items);
  }

  @Post('xp')
  @ApiOperation({
    summary: 'Award XP for a fixed, known event type (e.g. a confirmed purchase)',
    description: 'eventType is a server-side lookup key, not a client-supplied amount — prevents a customer from awarding themselves arbitrary XP.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiBody({ type: AwardXpDto })
  @ApiResponse({ status: 200, description: 'Updated shelf + XP state.' })
  awardXp(@Param('customerId') customerId: string, @Body() dto: AwardXpDto) {
    return this.svc.awardXpForEvent(customerId, dto.eventType);
  }

  @Put(':productSlug')
  @ApiOperation({
    summary: "Set (or clear) a product's shelf status",
    description: 'Awards XP server-side only the first time a product is newly marked "owned" or "wishlist" — repeated calls with the same status are a no-op for XP.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID' })
  @ApiParam({ name: 'productSlug', description: 'Product slug' })
  @ApiBody({ type: SetShelfStatusDto })
  @ApiResponse({ status: 200, description: 'Updated shelf + XP state.' })
  setStatus(
    @Param('customerId') customerId: string,
    @Param('productSlug') productSlug: string,
    @Body() dto: SetShelfStatusDto,
  ) {
    return this.svc.setStatus(customerId, productSlug, dto.status ?? null);
  }
}
