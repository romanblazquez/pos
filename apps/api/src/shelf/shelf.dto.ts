import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const SHELF_STATUSES = ['owned', 'wishlist', 'want-to-play', 'previously-owned', 'for-trade', 'preordered'] as const;

export class SetShelfStatusDto {
  @ApiPropertyOptional({
    type: 'string',
    description: 'Shelf status, or null to remove the product from the shelf',
    enum: [...SHELF_STATUSES, null],
    example: 'owned',
  })
  @IsOptional()
  @IsIn(SHELF_STATUSES)
  status?: string | null;
}

class GuestShelfItemDto {
  @ApiProperty({ type: 'string', description: 'Product slug' })
  @IsString()
  slug: string;

  @ApiProperty({ type: 'string', enum: SHELF_STATUSES })
  @IsIn(SHELF_STATUSES)
  status: string;
}

export class ImportGuestShelfDto {
  @ApiProperty({ type: [GuestShelfItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestShelfItemDto)
  items: GuestShelfItemDto[];
}

// Fixed lookup, not a client-supplied amount — a customer must not be able
// to submit an arbitrary XP value for their own account. Same principle as
// SHELF_XP_AWARDS in shelf.service.ts (server decides the amount).
export const XP_EVENT_TYPES = ['purchase_confirmed'] as const;

export class AwardXpDto {
  @ApiProperty({ type: 'string', enum: XP_EVENT_TYPES, example: 'purchase_confirmed' })
  @IsIn(XP_EVENT_TYPES)
  eventType: (typeof XP_EVENT_TYPES)[number];
}
