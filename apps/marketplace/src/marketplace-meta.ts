import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';

export type UiLocale = 'es' | 'en';

// Known categories get a friendlier label/description than the raw DB value —
// but the tiles themselves are only ever built from real categories (see
// getCategoryOptions), never shown just because they're listed here.
const CATEGORY_LABELS: Record<UiLocale, Record<string, string>> = {
  es: {
    'board-game': 'Juegos de mesa',
    'Tipo de Juego': 'Tipo de juego',
    Preventas: 'Preventas',
    Inventario: 'Disponibles ahora',
    Jugadores: 'Por jugadores',
  },
  en: {
    'board-game': 'Board games',
    'Tipo de Juego': 'Game type',
    Preventas: 'Pre-orders',
    Inventario: 'Available now',
    Jugadores: 'By player count',
  },
};

const CATEGORY_DESCRIPTIONS: Record<UiLocale, Record<string, string>> = {
  es: {
    'board-game': 'Clásicos modernos, estrategia, party games y familiares.',
    'Tipo de Juego': 'Explora por mecánica, estilo de partida y ocasión.',
    Preventas: 'Reserva novedades antes de que lleguen a tienda.',
    Inventario: 'Opciones con disponibilidad activa para compra rápida.',
    Jugadores: 'Encuentra juegos por tamaño de mesa.',
  },
  en: {
    'board-game': 'Modern classics, strategy, party games, and family favorites.',
    'Tipo de Juego': 'Browse by mechanic, play style, and occasion.',
    Preventas: 'Reserve new releases before they hit the store.',
    Inventario: 'Options with active stock for a quick purchase.',
    Jugadores: 'Find games by table size.',
  },
};

export interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

export function categoryLabel(category?: string | null, locale: UiLocale = 'es') {
  if (!category) return locale === 'en' ? 'All categories' : 'Todas las categorías';
  return CATEGORY_LABELS[locale][category] ?? humanizeCategory(category);
}

export function categoryDescription(category?: string | null, locale: UiLocale = 'es') {
  if (!category) {
    return locale === 'en'
      ? 'The full verified catalog from connected stores.'
      : 'Todo el catálogo verificado de tiendas conectadas.';
  }
  return CATEGORY_DESCRIPTIONS[locale][category]
    ?? (locale === 'en' ? 'Curated marketplace collection.' : 'Colección curada del marketplace.');
}

/** Builds category tiles strictly from real categories that currently have products — no hardcoded fallback list. */
export function getCategoryOptions(categories: Array<string | null | undefined> = [], locale: UiLocale = 'es'): CategoryOption[] {
  const seen = new Set<string>();
  const realCategories = categories
    .filter((category): category is string => {
      if (!category || seen.has(category)) return false;
      seen.add(category);
      return true;
    })
    .sort((a, b) => categoryLabel(a, locale).localeCompare(categoryLabel(b, locale), locale === 'en' ? 'en-US' : 'es-MX'));

  return realCategories.map((value) => ({
    value,
    label: categoryLabel(value, locale),
    description: categoryDescription(value, locale),
  }));
}

export function formatMoney(minor: number, currency = 'MXN', locale?: string) {
  return sharedFormatMoney({ minorUnits: minor, currency }, locale, 0);
}

function humanizeCategory(category: string) {
  return category
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
