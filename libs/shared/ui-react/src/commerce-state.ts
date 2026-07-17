export type CommerceState =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'preorder'
  | 'backorder'
  | 'out-of-print'
  | 'used'
  | 'rare'
  | 'sale'
  | 'best-price'
  | 'top-ranked'
  | 'community-pick'
  | 'new'
  | 'hot'
  | 'expansion';

/**
 * Visual weight (design system §04, "Badges & chips"). Only states that must
 * interrupt scanning go `solid`; `outline` is the quiet tier for states that are
 * informative but never a selling point. Everything else stays `soft` — if more
 * than one badge per card is solid, none of them read as loud.
 */
export type BadgeEmphasis = 'soft' | 'solid' | 'outline';

const EMPHASIS: Partial<Record<CommerceState, BadgeEmphasis>> = {
  sale: 'solid',
  hot: 'solid',
  'best-price': 'solid',
  'out-of-print': 'outline',
};

export function commerceStateEmphasis(state: CommerceState): BadgeEmphasis {
  return EMPHASIS[state] ?? 'soft';
}

const TAG_STATES: Array<[CommerceState, RegExp]> = [
  ['hot', /\b(hot|trending|en tendencia)\b/],
  ['preorder', /\b(pre[ -]?order|preventa)\b/],
  ['backorder', /\b(back[ -]?order|pedido pendiente)\b/],
  ['out-of-print', /\b(out of print|oop|descatalogad[oa])\b/],
  ['used', /\b(used|usad[oa]|seminuev[oa])\b/],
  ['rare', /\b(rare|rar[oa]|collectible|coleccionable)\b/],
  ['sale', /\b(sale|oferta|discount|descuento)\b/],
  ['best-price', /\b(best price|mejor precio)\b/],
  ['top-ranked', /\b(top ranked|top rated|mejor valorad[oa])\b/],
  ['community-pick', /\b(community pick|recomendad[oa])\b/],
  ['new', /\b(new|nuevo|nueva|novedad)\b/],
  ['low-stock', /\b(low stock|pocas unidades|ultimas unidades)\b/],
];

export function resolveCommerceState(tags: string[] | undefined, inStockListings: number): CommerceState {
  const normalizedTags = (tags ?? [])
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  for (const [state, pattern] of TAG_STATES) {
    if (pattern.test(normalizedTags)) return state;
  }
  return inStockListings > 0 ? 'in-stock' : 'out-of-stock';
}

const LABELS: Record<CommerceState, { es: string; en: string }> = {
  'in-stock': { es: 'En stock', en: 'In stock' },
  'low-stock': { es: 'Pocas unidades', en: 'Low stock' },
  'out-of-stock': { es: 'Sin stock', en: 'Out of stock' },
  preorder: { es: 'Preventa', en: 'Preorder' },
  backorder: { es: 'Bajo pedido', en: 'Backorder' },
  'out-of-print': { es: 'Descatalogado', en: 'Out of print' },
  used: { es: 'Usado', en: 'Used' },
  rare: { es: 'Raro', en: 'Rare' },
  sale: { es: 'Oferta', en: 'Sale' },
  'best-price': { es: 'Mejor precio', en: 'Best price' },
  'top-ranked': { es: 'Mejor valorado', en: 'Top ranked' },
  'community-pick': { es: 'Recomendado', en: 'Community pick' },
  new: { es: 'Nuevo', en: 'New' },
  hot: { es: 'En tendencia', en: 'Hot' },
  expansion: { es: 'Expansión', en: 'Expansion' },
};

export function commerceStateLabel(state: CommerceState, locale: 'es' | 'en' = 'es') {
  return LABELS[state][locale];
}

/**
 * Label plus its data suffix, e.g. "Sale −19%", "Low · 3 left", "Used · VG".
 * The design system specifies these detail-carrying badges, but the catalogue
 * doesn't yet expose discount %, unit counts or condition grades — that arrives
 * with the back office. Until then callers pass no `detail` and get the bare
 * label, so nothing here invents a number.
 */
export function commerceStateText(
  state: CommerceState,
  locale: 'es' | 'en' = 'es',
  detail?: string,
): string {
  const label = LABELS[state][locale];
  if (!detail) return label;
  // Discounts read as a modifier ("Sale −19%"); everything else as a clause.
  return detail.startsWith('−') || detail.startsWith('-') ? `${label} ${detail}` : `${label} · ${detail}`;
}
