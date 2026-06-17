import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { RawProduct } from '@retail-os/connector-contracts';

export interface MatchCandidate {
  productId: string;
  name: string;
  score: number;
  bggId: string | null;
  image: string | null;
  publisher: string | null;
  yearPublished: number | null;
}

export interface MatchResult {
  outcome: 'cache_hit' | 'auto_matched' | 'needs_review';
  productId?: string;
  confidence?: number;
  candidates?: MatchCandidate[];
}

// Top candidate must clear this score to ever auto-match.
const AUTO_MATCH_MIN_SCORE = 0.85;
// ...and must lead the #2 candidate by at least this margin (else it's ambiguous).
const AUTO_MATCH_MIN_MARGIN = 0.15;
const CANDIDATE_LIMIT = 5;

/**
 * Resolves a seller's raw synced item to a master MktProduct.
 * Tier 1: per-seller mapping cache (skips fuzzy match entirely on repeat syncs).
 * Tier 2: pg_trgm fuzzy match against MktProduct.name, banded into auto-match vs review.
 */
@Injectable()
export class ProductMatchingService {
  private readonly log = new Logger(ProductMatchingService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async match(sellerId: string, raw: RawProduct): Promise<MatchResult> {
    const externalKey = raw.externalId;

    const cached = await this.prisma.sellerProductMapping.findUnique({
      where: { sellerId_externalKey: { sellerId, externalKey } },
    });
    if (cached && cached.productId && (cached.status === 'auto_matched' || cached.status === 'manual_matched')) {
      return { outcome: 'cache_hit', productId: cached.productId };
    }

    const candidates = await this.fuzzyCandidates(raw.name);
    const [top, second] = candidates;

    if (top && top.score >= AUTO_MATCH_MIN_SCORE && (!second || top.score - second.score >= AUTO_MATCH_MIN_MARGIN)) {
      this.log.log(`[${sellerId}] "${raw.name}" auto-matched -> ${top.name} (score ${top.score.toFixed(2)})`);
      return { outcome: 'auto_matched', productId: top.productId, confidence: top.score, candidates };
    }

    return { outcome: 'needs_review', candidates };
  }

  /** Persist a resolution (auto-match or human decision) as the cache for future syncs. */
  async recordResolution(
    sellerId: string,
    externalKey: string,
    raw: RawProduct,
    resolution: {
      status: 'auto_matched' | 'manual_matched';
      productId: string;
      matchMethod: string;
      matchConfidence?: number;
      listingId: string;
      resolvedBy?: string;
    },
  ): Promise<void> {
    await this.prisma.sellerProductMapping.upsert({
      where: { sellerId_externalKey: { sellerId, externalKey } },
      create: {
        sellerId,
        externalKey,
        sellerSku: raw.sku,
        sellerProductId: raw.externalId,
        rawPayload: raw as object,
        status: resolution.status,
        productId: resolution.productId,
        matchMethod: resolution.matchMethod,
        matchConfidence: resolution.matchConfidence,
        listingId: resolution.listingId,
        resolvedAt: new Date(),
        resolvedBy: resolution.resolvedBy ?? 'system',
      },
      update: {
        status: resolution.status,
        productId: resolution.productId,
        matchMethod: resolution.matchMethod,
        matchConfidence: resolution.matchConfidence,
        listingId: resolution.listingId,
        resolvedAt: new Date(),
        resolvedBy: resolution.resolvedBy ?? 'system',
      },
    });
  }

  /** Stage an ambiguous/no-match item for seller review — no Listing/MktProduct created. */
  async stageForReview(
    sellerId: string,
    externalKey: string,
    raw: RawProduct,
    candidates: MatchCandidate[],
  ): Promise<void> {
    await this.prisma.sellerProductMapping.upsert({
      where: { sellerId_externalKey: { sellerId, externalKey } },
      create: {
        sellerId,
        externalKey,
        sellerSku: raw.sku,
        sellerProductId: raw.externalId,
        rawPayload: raw as object,
        status: 'pending_review',
        candidates: candidates as object,
      },
      update: {
        // Re-staged on a later sync — refresh the snapshot/candidates, but don't
        // clobber a row a seller/admin already escalated or resolved in the meantime.
        rawPayload: raw as object,
        candidates: candidates as object,
      },
    });
  }

  private async fuzzyCandidates(name: string, limit = CANDIDATE_LIMIT): Promise<MatchCandidate[]> {
    const rows = await this.prisma.$queryRaw<{
      id: string; name: string; bggId: string | null; score: number;
      images: string[]; publisher: string | null; yearPublished: number | null;
    }[]>`
      SELECT id, name, "bggId", images, publisher, "yearPublished", similarity(name, ${name}) AS score
      FROM "MktProduct"
      WHERE name % ${name}
      ORDER BY score DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      productId: r.id,
      name: r.name,
      score: r.score,
      bggId: r.bggId,
      image: r.images?.[0] ?? null,
      publisher: r.publisher,
      yearPublished: r.yearPublished,
    }));
  }
}
