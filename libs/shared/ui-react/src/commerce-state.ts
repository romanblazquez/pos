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
  | 'new';

const TAG_STATES: Array<[CommerceState, RegExp]> = [
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
};

export function commerceStateLabel(state: CommerceState, locale: 'es' | 'en' = 'es') {
  return LABELS[state][locale];
}
