export const XP_TIERS = [
  { name: 'Pawn', min: 0, color: '#9A8E79', nextPerk: 'Empieza a armar tu estante' },
  { name: 'Meeple', min: 200, color: '#B4502E', nextPerk: 'Acceso anticipado a ofertas' },
  { name: 'Collector', min: 500, color: '#3F5A4A', nextPerk: 'Alertas de precio en wishlist' },
  { name: 'Curator', min: 1000, color: '#B5852F', nextPerk: 'Badge de reseñas destacadas' },
  { name: 'Loremaster', min: 2000, color: '#1E3A2E', nextPerk: 'Camino completo ★' },
] as const;

export type XPTierName = (typeof XP_TIERS)[number]['name'];

export interface XPTierInfo {
  tier: (typeof XP_TIERS)[number];
  tierIndex: number;
  nextTier: (typeof XP_TIERS)[number] | null;
  pct: number;
  xpToNext: number | null;
}

export function getXPTier(xp: number): XPTierInfo {
  let tierIndex = 0;
  for (let i = 0; i < XP_TIERS.length; i++) {
    if (xp >= XP_TIERS[i].min) tierIndex = i;
  }
  const tier = XP_TIERS[tierIndex];
  const nextTier = tierIndex < XP_TIERS.length - 1 ? XP_TIERS[tierIndex + 1] : null;

  let pct = 100;
  let xpToNext: number | null = null;
  if (nextTier) {
    const rangeStart = tier.min;
    const rangeEnd = nextTier.min;
    pct = Math.min(100, Math.round(((xp - rangeStart) / (rangeEnd - rangeStart)) * 100));
    xpToNext = rangeEnd - xp;
  }

  return { tier, tierIndex, nextTier, pct, xpToNext };
}

export function useXPInfo(xp: number): XPTierInfo {
  return getXPTier(xp);
}
