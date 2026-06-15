export interface RankingWeights {
  // All weights must sum to 1.0
  availability: number;          // default 0.25
  priceCompetitiveness: number;  // default 0.20
  delivery: number;              // default 0.20
  sellerReliability: number;     // default 0.20
  sellerQuality: number;         // default 0.10
  integrationHealth: number;     // default 0.05
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  availability: 0.25,
  priceCompetitiveness: 0.20,
  delivery: 0.20,
  sellerReliability: 0.20,
  sellerQuality: 0.10,
  integrationHealth: 0.05,
};

export interface RankingInput {
  listingId: string;
  sellerId: string;
  productId: string;
  stock: number;
  stockStatus: string;
  stockConfidence: number;
  priceMinorUnits: number;
  lowestPriceForProductMinor: number;
  bestDeliveryDays: number;
  listingDeliveryDaysMin: number;
  coverageScore: number;          // 0–1: how many regions covered
  fulfillmentRate: number;
  cancellationRate: number;
  customerSvcScore: number;       // 1–5, normalized to 0–1
  responseTimeHours: number;
  integrationHealth: number;
  syncAgeSeconds: number;
  sellerStatus: string;
}

export interface RankingResult {
  listingId: string;
  rankScore: number;
  breakdown: {
    availability: number;
    priceCompetitiveness: number;
    delivery: number;
    sellerReliability: number;
    sellerQuality: number;
    integrationHealth: number;
  };
  disqualified: boolean;
  disqualifyReason?: string;
}

export function calculateRankScore(
  input: RankingInput,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
): RankingResult {
  // Hard disqualifiers — seller or data is not trustworthy
  if (input.sellerStatus !== 'active') {
    return disqualify(input.listingId, 'seller_inactive');
  }
  if (input.syncAgeSeconds > 86400) {
    return disqualify(input.listingId, 'stale_sync');
  }

  const availability = scoreAvailability(input);
  const priceCompetitiveness = scorePriceCompetitiveness(input);
  const delivery = scoreDelivery(input);
  const sellerReliability = scoreSellerReliability(input);
  const sellerQuality = scoreSellerQuality(input);
  const integrationHealth = clamp01(input.integrationHealth);

  const rankScore =
    availability * weights.availability +
    priceCompetitiveness * weights.priceCompetitiveness +
    delivery * weights.delivery +
    sellerReliability * weights.sellerReliability +
    sellerQuality * weights.sellerQuality +
    integrationHealth * weights.integrationHealth;

  return {
    listingId: input.listingId,
    rankScore: clamp01(rankScore),
    breakdown: {
      availability,
      priceCompetitiveness,
      delivery,
      sellerReliability,
      sellerQuality,
      integrationHealth,
    },
    disqualified: false,
  };
}

function scoreAvailability(i: RankingInput): number {
  if (i.stockStatus === 'out_of_stock') return 0;
  const stockFactor = i.stockStatus === 'in_stock' ? 1.0 : 0.5;
  return clamp01(stockFactor * i.stockConfidence);
}

function scorePriceCompetitiveness(i: RankingInput): number {
  if (i.lowestPriceForProductMinor === 0) return 0.5;
  // Score is 1.0 when this listing is the cheapest, scales down as it gets more expensive
  return clamp01(i.lowestPriceForProductMinor / i.priceMinorUnits);
}

function scoreDelivery(i: RankingInput): number {
  // Speed: 1.0 for same-day, 0.0 for 14+ days
  const speedScore = clamp01(1 - i.listingDeliveryDaysMin / 14);
  return clamp01((speedScore * 0.6) + (i.coverageScore * 0.4));
}

function scoreSellerReliability(i: RankingInput): number {
  return clamp01(i.fulfillmentRate * (1 - i.cancellationRate));
}

function scoreSellerQuality(i: RankingInput): number {
  const svcScore = clamp01((i.customerSvcScore - 1) / 4); // normalize 1–5 → 0–1
  // responseTimeHours: 1h → 1.0, 48h → 0.0
  const responseScore = clamp01(1 - i.responseTimeHours / 48);
  return clamp01((svcScore * 0.6) + (responseScore * 0.4));
}

function disqualify(listingId: string, reason: string): RankingResult {
  return {
    listingId,
    rankScore: 0,
    breakdown: {
      availability: 0,
      priceCompetitiveness: 0,
      delivery: 0,
      sellerReliability: 0,
      sellerQuality: 0,
      integrationHealth: 0,
    },
    disqualified: true,
    disqualifyReason: reason,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
