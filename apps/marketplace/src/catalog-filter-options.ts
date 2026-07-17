// The catalogue filter axes, shared by HomePage (browse) and SearchPage (query).
//
// Both pages had their own copies and had already drifted: HomePage's budget
// list was missing the "Sin tope" reset and its players list the "Todos" one, so
// the same rail offered different options depending on how you arrived at it.
// One list each, so that can't recur.
//
// Values match the SEO app's SearchFilters.tsx — the two frontends must agree on
// what a filter *means*, not just what it looks like.

export const PRICE_OPTIONS: { labelId: string; value: number | undefined }[] = [
  { labelId: 'search.noLimit', value: undefined },
  { labelId: 'home.priceUpTo500', value: 50_000 },
  { labelId: 'home.priceUpTo1000', value: 100_000 },
  { labelId: 'home.priceUpTo1500', value: 150_000 },
];

/** `undefined` is the "Todos" chip — the explicit reset, not the absence of a chip. */
export const PLAYER_OPTIONS: (number | undefined)[] = [undefined, 1, 2, 3, 4, 5];

// Same bggWeight bands as ProductPage.tsx's ComplexityMeter and the API's
// complexity-bands.ts — keeps the filter, the product-page display and both
// backends (Typesense + Prisma fallback) all in agreement.
export const COMPLEXITY_OPTIONS: { value: string; labelId: string }[] = [
  { value: 'light', labelId: 'product.complexityLight' },
  { value: 'medium-light', labelId: 'product.complexityMediumLight' },
  { value: 'medium', labelId: 'product.complexityMedium' },
  { value: 'heavy', labelId: 'product.complexityHeavy' },
  { value: 'expert', labelId: 'product.complexityExpert' },
];

// Mirrors the API's sortBy enum. Search-specific labels: browsing a catalogue
// calls rank_score "Recomendados", but against a query it means best *match*.
export type SortBy = 'rank_score' | 'price_asc' | 'price_desc' | 'name';
export const SORT_OPTIONS: { value: SortBy; labelId: string }[] = [
  { value: 'rank_score', labelId: 'search.sortBestMatch' },
  { value: 'price_asc', labelId: 'search.sortPriceAsc' },
  { value: 'price_desc', labelId: 'search.sortPriceDesc' },
  { value: 'name', labelId: 'search.sortName' },
];

// Keep the rail short enough that Categorías stays reachable without scrolling
// inside the sticky panel; the tail goes behind a "Ver N más" disclosure.
export const MECHANICS_RANKED = 15;
export const MECHANICS_SHOWN = 6;
