import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiBody,
} from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service.js';
import { Public } from '../auth/auth.guard.js';

class UpdatePlatformConfigDto {
  @ApiPropertyOptional({ type: 'number', description: 'Base commission rate (0–0.30)', example: 0.05 })
  @IsNumber() @Min(0) @Max(0.30)
  baseCommissionPct?: number;

  @ApiPropertyOptional({ type: 'number', description: 'Minimum commission floor (0–base)', example: 0.02 })
  @IsNumber() @Min(0) @Max(0.15)
  minCommissionPct?: number;

  @ApiPropertyOptional({ type: 'number', description: 'Platform-funded cashback given to buyers (0–0.10)', example: 0.01 })
  @IsNumber() @Min(0) @Max(0.10)
  platformCashbackPct?: number;
}

class UpdateSellerRewardsDto {
  @ApiProperty({ type: 'number', description: 'Seller-funded store cashback rate (0–0.15). Reduces commission 1:1 until floor.', example: 0.02 })
  @IsNumber() @Min(0) @Max(0.15)
  storeCashbackPct: number;
}

@ApiTags('loyalty')
@Public()
@Controller('api/v1')
export class LoyaltyController {
  constructor(@Inject(LoyaltyService) private readonly svc: LoyaltyService) {}

  // ── Platform config (admin) ──────────────────────────────────────────────

  @Get('admin/loyalty/config')
  @ApiOperation({
    summary: 'Get platform commission and cashback config',
    description:
      'Returns the current platform-wide commission and cashback rates. ' +
      'baseCommissionPct: charged to seller. minCommissionPct: floor — seller cashback reduces commission down to this. ' +
      'platformCashbackPct: earned by buyers from platform revenue.',
  })
  @ApiResponse({ status: 200, description: 'Platform config object.' })
  getPlatformConfig() {
    return this.svc.getPlatformConfig();
  }

  @Patch('admin/loyalty/config')
  @ApiOperation({
    summary: 'Update platform commission and cashback rates (admin only)',
    description:
      'Updates the global marketplace commission and cashback configuration. ' +
      'Commission reduction model: seller store cashback reduces their effective commission by 1:1, ' +
      'down to minCommissionPct. Platform keeps effectiveCommission - platformCashbackPct as net revenue.',
  })
  @ApiBody({ type: UpdatePlatformConfigDto })
  @ApiResponse({ status: 200, description: 'Updated platform config.' })
  updatePlatformConfig(@Body() dto: UpdatePlatformConfigDto) {
    return this.svc.updatePlatformConfig(dto);
  }

  // ── Seller reward config ─────────────────────────────────────────────────

  @Get('sellers/:sellerId/rewards')
  @ApiOperation({
    summary: 'Get seller reward program config',
    description:
      'Returns the seller\'s store cashback rate and the resulting effective commission. ' +
      'Sellers who offer store cashback pay lower platform commission (1:1 reduction). ' +
      'storeCashbackPct 0%→5% commission, 1%→4%, 2%→3%, 3%→2% (floor).',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({ status: 200, description: 'Seller reward config with effective commission preview.' })
  async getSellerRewards(@Param('sellerId') sellerId: string) {
    const [config, platformCfg] = await Promise.all([
      this.svc.getSellerRewardConfig(sellerId),
      this.svc.getPlatformConfig(),
    ]);
    const effectiveCommissionPct = Math.max(
      platformCfg.baseCommissionPct - config.storeCashbackPct,
      platformCfg.minCommissionPct,
    );
    return { ...config, effectiveCommissionPct, platformCfg };
  }

  @Patch('sellers/:sellerId/rewards')
  @ApiOperation({
    summary: 'Update seller store cashback rate',
    description:
      'Sets the seller\'s store-funded cashback percentage. ' +
      'Buyers earn this as store credits redeemable only at this seller. ' +
      'Each 1% of store cashback reduces the seller\'s platform commission by 1% (floor: 2%). ' +
      'Seller cost stays constant — they trade commission for a loyalty program.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiBody({ type: UpdateSellerRewardsDto })
  @ApiResponse({ status: 200, description: 'Updated reward config.' })
  updateSellerRewards(
    @Param('sellerId') sellerId: string,
    @Body() dto: UpdateSellerRewardsDto,
  ) {
    return this.svc.updateSellerRewardConfig(sellerId, dto.storeCashbackPct);
  }

  // ── Customer wallet ──────────────────────────────────────────────────────

  @Get('customers/:customerId/wallet')
  @ApiOperation({
    summary: 'Get customer wallet balances',
    description:
      'Returns the customer\'s platform credit balance (redeemable anywhere) and ' +
      'all store credit balances (redeemable only at the specific seller). ' +
      'Use at checkout to show available credits to the buyer.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID', example: 'clxcust123' })
  @ApiResponse({ status: 200, description: 'Wallet with platform credits and store credit balances.' })
  getWallet(@Param('customerId') customerId: string) {
    return this.svc.getOrCreateWallet(customerId);
  }

  @Get('customers/:customerId/wallet/transactions')
  @ApiOperation({
    summary: 'Get customer wallet transaction history',
    description: 'Returns the last 20 wallet movements — cashback earned and credits redeemed.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer CUID', example: 'clxcust123' })
  @ApiResponse({ status: 200, description: 'Array of wallet transactions, newest first.' })
  getTransactions(@Param('customerId') customerId: string) {
    return this.svc.getWalletTransactions(customerId);
  }

  // ── Fee preview (public — used by marketplace UI) ────────────────────────

  @Get('sellers/:sellerId/rewards/fee-preview')
  @ApiOperation({
    summary: 'Preview commission and cashback amounts for a given order total',
    description:
      'Returns a breakdown of fees and cashback for a hypothetical order. ' +
      'Use this to show buyers how much cashback they will earn before checkout, ' +
      'and to show sellers their effective commission and payout.',
  })
  @ApiParam({ name: 'sellerId', description: 'Seller CUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Fee breakdown: { effectiveCommissionPct, platformCashbackPct, storeCashbackPct, commissionMinor, platformCashbackMinor, storeCashbackMinor, sellerPayoutMinor }',
  })
  async getFeePreview(
    @Param('sellerId') sellerId: string,
  ) {
    // Returns rates only — callers compute amounts client-side
    const [config, platformCfg] = await Promise.all([
      this.svc.getSellerRewardConfig(sellerId),
      this.svc.getPlatformConfig(),
    ]);
    const storeCashbackPct = config.storeCashbackPct;
    const effectiveCommissionPct = Math.max(
      platformCfg.baseCommissionPct - storeCashbackPct,
      platformCfg.minCommissionPct,
    );
    return {
      effectiveCommissionPct,
      platformCashbackPct: platformCfg.platformCashbackPct,
      storeCashbackPct,
      totalBuyerCashbackPct: platformCfg.platformCashbackPct + storeCashbackPct,
    };
  }
}
