import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { monthlyLimitForTier, startOfCurrentMonthUtc } from './ai-usage.constants.js';

export interface AiUsage {
  tier: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

@Injectable()
export class AiUsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async countUsage(sellerId: string): Promise<number> {
    return this.prisma.aiEnrichmentProposal.count({
      where: { generatedBy: sellerId, createdAt: { gte: startOfCurrentMonthUtc() } },
    });
  }

  async getUsage(sellerId: string): Promise<AiUsage> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId }, select: { tier: true } });
    if (!seller) throw new NotFoundException(`Seller "${sellerId}" not found`);

    const limit = monthlyLimitForTier(seller.tier);
    const used = await this.countUsage(sellerId);
    return {
      tier: seller.tier,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: limit === null,
    };
  }

  /** Throws if the seller's tier/monthly budget doesn't allow another AI-enhance call. */
  async assertCanEnhance(sellerId: string): Promise<AiUsage> {
    const usage = await this.getUsage(sellerId);
    if (usage.limit === 0) {
      throw new ForbiddenException('AI enrichment is a paid-plan feature — upgrade from Starter to use it.');
    }
    if (usage.limit !== null && usage.used >= usage.limit) {
      throw new ForbiddenException(`Monthly AI enrichment limit reached (${usage.limit}). Resets on the 1st of next month.`);
    }
    return usage;
  }

  /** Records a completed enrichment call for budget tracking and moderation review. */
  async recordEnhancement(sellerId: string, productId: string, modelName: string, proposedValue: unknown): Promise<void> {
    await this.prisma.aiEnrichmentProposal.create({
      data: {
        entityType: 'product',
        entityId: productId,
        fieldPath: 'seo_bundle',
        proposedValue: proposedValue as object,
        confidenceScore: 0.5,
        sourceReferences: {},
        generatedBy: sellerId,
        modelName,
      },
    });
  }

  /** Admin oversight: AI usage across every seller with a paid tier this month. */
  async listAdminUsage(): Promise<(AiUsage & { sellerId: string; sellerName: string })[]> {
    const sellers = await this.prisma.seller.findMany({
      where: { tier: { not: 'starter' } },
      select: { id: true, name: true, tier: true },
      orderBy: { name: 'asc' },
    });
    return Promise.all(sellers.map(async (s) => {
      const used = await this.countUsage(s.id);
      const limit = monthlyLimitForTier(s.tier);
      return {
        sellerId: s.id,
        sellerName: s.name,
        tier: s.tier,
        used,
        limit,
        remaining: limit === null ? null : Math.max(0, limit - used),
        unlimited: limit === null,
      };
    }));
  }
}
