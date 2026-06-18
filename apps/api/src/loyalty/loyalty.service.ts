import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';

const DEFAULT_CONFIG = {
  baseCommissionPct: 0.05,
  minCommissionPct: 0.03,
  platformCashbackPct: 0.01,
};

@Injectable()
export class LoyaltyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── Platform config ──────────────────────────────────────────────────────

  async getPlatformConfig() {
    const config = await this.prisma.platformConfig.findUnique({ where: { id: 'default' } });
    return config ?? { id: 'default', ...DEFAULT_CONFIG, updatedAt: new Date() };
  }

  async updatePlatformConfig(data: {
    baseCommissionPct?: number;
    minCommissionPct?: number;
    platformCashbackPct?: number;
  }) {
    return this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...DEFAULT_CONFIG, ...data },
      update: data,
    });
  }

  // ── Seller reward config ─────────────────────────────────────────────────

  async getSellerRewardConfig(sellerId: string) {
    const config = await this.prisma.sellerRewardConfig.findUnique({ where: { sellerId } });
    return config ?? { sellerId, storeCashbackPct: 0 };
  }

  async updateSellerRewardConfig(sellerId: string, storeCashbackPct: number) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException(`Seller "${sellerId}" not found`);

    return this.prisma.sellerRewardConfig.upsert({
      where: { sellerId },
      create: { sellerId, storeCashbackPct },
      update: { storeCashbackPct },
    });
  }

  /** Compute the effective commission and cashback amounts for an order.
   *  orderTotalMinor (gross) drives commission/sellerPayout — the seller is owed for
   *  the full sale regardless of how the customer paid. netPaidMinor (gross minus any
   *  wallet/store credits redeemed on this order) drives cashback — cashback must never
   *  be earned on money that didn't actually change hands through the gateway, or a
   *  customer could compound credits into more credits for free. Defaults to
   *  orderTotalMinor when omitted (no credits applied).
   *  listingId is optional — when provided, any active per-listing promo is added to storeCashbackPct. */
  async computeOrderFees(
    sellerId: string,
    orderTotalMinor: number,
    netPaidMinor: number = orderTotalMinor,
    listingId?: string,
  ): Promise<{
    effectiveCommissionPct: number;
    platformCashbackPct: number;
    storeCashbackPct: number;
    bonusCashbackPct: number;
    commissionMinor: number;
    platformCashbackMinor: number;
    storeCashbackMinor: number;
    sellerPayoutMinor: number;
  }> {
    const [platformCfg, rewardCfg] = await Promise.all([
      this.getPlatformConfig(),
      this.getSellerRewardConfig(sellerId),
    ]);

    // Base store cashback from seller's global config
    let storeCashbackPct = rewardCfg.storeCashbackPct;

    // Add per-listing bonus if there's an active promo
    let bonusCashbackPct = 0;
    if (listingId) {
      const promo = await this.prisma.listingPromo.findFirst({
        where: {
          listingId,
          active: true,
          OR: [
            { startsAt: null, endsAt: null },
            { startsAt: { lte: new Date() }, endsAt: null },
            { startsAt: null, endsAt: { gte: new Date() } },
            { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
          ],
        },
        orderBy: { bonusCashbackPct: 'desc' },
      });
      if (promo) {
        bonusCashbackPct = promo.bonusCashbackPct;
        storeCashbackPct += bonusCashbackPct;
      }
    }
    // Only even seller cashback percentages reduce commission (1% for every 2%), never below floor
    const sellerPctInt = Math.round(storeCashbackPct * 100);
    const effectiveCommissionPct = Math.max(
      platformCfg.baseCommissionPct - Math.floor(sellerPctInt / 2) * 0.01,
      platformCfg.minCommissionPct,
    );

    const netBasis = Math.max(0, Math.min(netPaidMinor, orderTotalMinor));
    const commissionMinor = Math.round(orderTotalMinor * effectiveCommissionPct);
    const platformCashbackMinor = Math.round(netBasis * platformCfg.platformCashbackPct);
    const storeCashbackMinor = Math.round(netBasis * storeCashbackPct);
    const sellerPayoutMinor = orderTotalMinor - commissionMinor - storeCashbackMinor;

    return {
      effectiveCommissionPct,
      platformCashbackPct: platformCfg.platformCashbackPct,
      storeCashbackPct,
      bonusCashbackPct,
      commissionMinor,
      platformCashbackMinor,
      storeCashbackMinor,
      sellerPayoutMinor,
    };
  }

  // ── Customer wallet ──────────────────────────────────────────────────────

  async getOrCreateWallet(customerId: string) {
    const customer = await this.prisma.mktCustomer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    return this.prisma.customerWallet.upsert({
      where: { customerId },
      create: { customerId, platformCreditsMinor: 0 },
      update: {},
      include: {
        storeCredits: { include: { seller: { select: { id: true, name: true, slug: true } } } },
      },
    });
  }

  /** Award cashback to a customer after payment confirmed. Runs in a transaction. */
  async awardCashback(opts: {
    customerId: string;
    sellerId: string;
    orderId: string;
    platformCashbackMinor: number;
    storeCashbackMinor: number;
  }) {
    if (opts.platformCashbackMinor === 0 && opts.storeCashbackMinor === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.upsert({
        where: { customerId: opts.customerId },
        create: { customerId: opts.customerId, platformCreditsMinor: 0 },
        update: {},
      });

      if (opts.platformCashbackMinor > 0) {
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { platformCreditsMinor: { increment: opts.platformCashbackMinor } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'earn_platform',
            amountMinor: opts.platformCashbackMinor,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Cashback de compra #${opts.orderId.slice(-8)}`,
          },
        });
      }

      if (opts.storeCashbackMinor > 0) {
        await tx.storeCredit.upsert({
          where: { walletId_sellerId: { walletId: wallet.id, sellerId: opts.sellerId } },
          create: { walletId: wallet.id, sellerId: opts.sellerId, balanceMinor: opts.storeCashbackMinor },
          update: { balanceMinor: { increment: opts.storeCashbackMinor } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'earn_store',
            amountMinor: opts.storeCashbackMinor,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Crédito de tienda por compra #${opts.orderId.slice(-8)}`,
          },
        });
      }
    });
  }

  /**
   * Reserve AND deduct credits atomically at checkout-init time. Deducting
   * immediately (rather than just checking balance here and deducting later at
   * payment confirmation) prevents two concurrent/sequential checkouts from both
   * reading the same not-yet-redeemed balance and over-applying it — the wallet
   * decrement happens in the same transaction as the read, so a second call
   * always sees the already-reduced balance. Clamped at 0 in both directions so
   * a corrupted/negative balance can never inflate the amount charged.
   * Call refundCredits if the resulting order ends up cancelled/failed.
   */
  async reserveCredits(opts: {
    customerId: string;
    sellerId: string;
    orderId: string;
    platformCreditsToUse: number;
    storeCreditsToUse: number;
  }): Promise<{ platformCreditsApplied: number; storeCreditsApplied: number }> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.findUnique({
        where: { customerId: opts.customerId },
        include: { storeCredits: { where: { sellerId: opts.sellerId } } },
      });
      if (!wallet) return { platformCreditsApplied: 0, storeCreditsApplied: 0 };

      const platformAvailable = Math.max(0, wallet.platformCreditsMinor);
      const storeAvailable = Math.max(0, wallet.storeCredits[0]?.balanceMinor ?? 0);
      const platformCreditsApplied = Math.max(0, Math.min(opts.platformCreditsToUse, platformAvailable));
      const storeCreditsApplied = Math.max(0, Math.min(opts.storeCreditsToUse, storeAvailable));

      if (platformCreditsApplied > 0) {
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { platformCreditsMinor: { decrement: platformCreditsApplied } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'redeem_platform',
            amountMinor: -platformCreditsApplied,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Créditos aplicados en orden #${opts.orderId.slice(-8)}`,
          },
        });
      }

      if (storeCreditsApplied > 0) {
        await tx.storeCredit.updateMany({
          where: { walletId: wallet.id, sellerId: opts.sellerId },
          data: { balanceMinor: { decrement: storeCreditsApplied } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'redeem_store',
            amountMinor: -storeCreditsApplied,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Crédito de tienda aplicado en orden #${opts.orderId.slice(-8)}`,
          },
        });
      }

      return { platformCreditsApplied, storeCreditsApplied };
    });
  }

  /** Give back credits already reserved for an order that ended up cancelled/failed. */
  async refundCredits(opts: {
    customerId: string;
    sellerId: string;
    orderId: string;
    platformCreditsApplied: number;
    storeCreditsApplied: number;
  }) {
    if (opts.platformCreditsApplied === 0 && opts.storeCreditsApplied === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.findUniqueOrThrow({
        where: { customerId: opts.customerId },
      });

      if (opts.platformCreditsApplied > 0) {
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { platformCreditsMinor: { increment: opts.platformCreditsApplied } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'earn_platform',
            amountMinor: opts.platformCreditsApplied,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Reembolso — orden #${opts.orderId.slice(-8)} cancelada`,
          },
        });
      }

      if (opts.storeCreditsApplied > 0) {
        await tx.storeCredit.upsert({
          where: { walletId_sellerId: { walletId: wallet.id, sellerId: opts.sellerId } },
          create: { walletId: wallet.id, sellerId: opts.sellerId, balanceMinor: opts.storeCreditsApplied },
          update: { balanceMinor: { increment: opts.storeCreditsApplied } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'earn_store',
            amountMinor: opts.storeCreditsApplied,
            sellerId: opts.sellerId,
            orderId: opts.orderId,
            description: `Reembolso de crédito de tienda — orden #${opts.orderId.slice(-8)} cancelada`,
          },
        });
      }
    });
  }

  async getWalletTransactions(customerId: string, limit = 20) {
    const wallet = await this.prisma.customerWallet.findUnique({ where: { customerId } });
    if (!wallet) return [];
    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
