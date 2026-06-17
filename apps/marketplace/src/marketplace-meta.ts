export const FALLBACK_CATEGORIES = ['board-game', 'Tipo de Juego', 'Preventas', 'Inventario', 'Jugadores'];

const CATEGORY_LABELS: Record<string, string> = {
  'board-game': 'Juegos de mesa',
  'Tipo de Juego': 'Tipo de juego',
  Preventas: 'Preventas',
  Inventario: 'Disponibles ahora',
  Jugadores: 'Por jugadores',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'board-game': 'Clásicos modernos, estrategia, party games y familiares.',
  'Tipo de Juego': 'Explora por mecánica, estilo de partida y ocasión.',
  Preventas: 'Reserva novedades antes de que lleguen a tienda.',
  Inventario: 'Opciones con disponibilidad activa para compra rápida.',
  Jugadores: 'Encuentra juegos por tamaño de mesa.',
};

export interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

export function categoryLabel(category?: string | null) {
  if (!category) return 'Todas las categorías';
  return CATEGORY_LABELS[category] ?? humanizeCategory(category);
}

export function categoryDescription(category?: string | null) {
  if (!category) return 'Todo el catálogo verificado de tiendas conectadas.';
  return CATEGORY_DESCRIPTIONS[category] ?? 'Colección curada del marketplace.';
}

export function getCategoryOptions(categories: Array<string | null | undefined> = []): CategoryOption[] {
  const seen = new Set(FALLBACK_CATEGORIES);
  const extraCategories = categories
    .filter((category): category is string => {
      if (!category || seen.has(category)) return false;
      seen.add(category);
      return true;
    })
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), 'es-MX'));

  return [...FALLBACK_CATEGORIES, ...extraCategories].map((value) => ({
    value,
    label: categoryLabel(value),
    description: categoryDescription(value),
  }));
}

export function formatMoney(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function humanizeCategory(category: string) {
  return category
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
