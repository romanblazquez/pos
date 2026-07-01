// Monthly AI-enrichment call budget per seller tier — `null` means unlimited.
// starter (free) tier is blocked entirely: AI enrichment is a paid-tier perk.
// Manual trigger only (a click in seller-portal) — nothing here auto-runs.
export const AI_ENHANCE_MONTHLY_LIMITS: Record<string, number | null> = {
  starter: 0,
  growth: 15,
  pro: 50,
  platform: null,
};

export function monthlyLimitForTier(tier: string): number | null {
  return AI_ENHANCE_MONTHLY_LIMITS[tier] ?? 0;
}

export function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
