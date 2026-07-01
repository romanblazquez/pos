// Single source of truth for BGG-weight complexity bands, matching
// apps/marketplace/src/pages/ProductPage.tsx's ComplexityMeter bands exactly
// (`weight < 2` light, `< 2.5` medium-light, `< 3.5` medium, `< 4.5` heavy,
// else expert) so the filter and the product-page display never disagree.
export type ComplexityBand = 'light' | 'medium-light' | 'medium' | 'heavy' | 'expert';

export const COMPLEXITY_BAND_RANGES: Record<ComplexityBand, { min: number; max: number | null }> = {
  light: { min: 0, max: 2 },
  'medium-light': { min: 2, max: 2.5 },
  medium: { min: 2.5, max: 3.5 },
  heavy: { min: 3.5, max: 4.5 },
  expert: { min: 4.5, max: null },
};

export function isComplexityBand(value: string): value is ComplexityBand {
  return value in COMPLEXITY_BAND_RANGES;
}
