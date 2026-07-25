import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';

export type UiLocale = 'es' | 'en';

// Known categories get a friendlier label/description than the raw DB value —
// but the tiles themselves are only ever built from real categories (see
// getCategoryOptions), never shown just because they're listed here.
//
// The browse-taxonomy keys (strategy, two-player, family…) are the API's real
// category axis, shared with the SEO app's `lib/themes.ts`. Labels must match
// that module's, or the same shelf reads "Para 2 jugadores" on juegospedia.com
// and "Two Player" here.
const CATEGORY_LABELS: Record<UiLocale, Record<string, string>> = {
  es: {
    'board-game': 'Juegos de mesa',
    // Without this the tile fell through to the raw DB value and rendered the
    // English "Expansion" on the Spanish storefront.
    expansion: 'Expansiones',
    'Tipo de Juego': 'Tipo de juego',
    Preventas: 'Preventas',
    Inventario: 'Disponibles ahora',
    Jugadores: 'Por jugadores',
    strategy: 'Estrategia',
    euro: 'Eurogames',
    coop: 'Cooperativos',
    family: 'Familiares y niños',
    'two-player': 'Para 2 jugadores',
    card: 'De cartas',
    deckbuilding: 'Construcción de mazos',
    solo: 'En solitario',
    thematic: 'Temáticos y aventura',
    horror: 'Terror',
    fantasy: 'Fantasía',
    scifi: 'Ciencia ficción',
    dice: 'De dados',
    party: 'Fiesta y party',
    abstract: 'Abstractos',
    wargame: 'Wargames',
    campaign: 'Campañas y legacy',
    deduction: 'Deducción y faroleo',
    sports: 'Deportes y carreras',
    trains: 'Trenes y transporte',
    history: 'Históricos',
    other: 'Otros juegos',
  },
  en: {
    'board-game': 'Board games',
    expansion: 'Expansions',
    'Tipo de Juego': 'Game type',
    Preventas: 'Pre-orders',
    Inventario: 'Available now',
    Jugadores: 'By player count',
    strategy: 'Strategy',
    euro: 'Eurogames',
    coop: 'Cooperative',
    family: 'Family & kids',
    'two-player': 'For 2 players',
    card: 'Card games',
    deckbuilding: 'Deck building',
    solo: 'Solo',
    thematic: 'Thematic & adventure',
    horror: 'Horror',
    fantasy: 'Fantasy',
    scifi: 'Sci-fi',
    dice: 'Dice games',
    party: 'Party',
    abstract: 'Abstract',
    wargame: 'Wargames',
    campaign: 'Campaign & legacy',
    deduction: 'Deduction & bluffing',
    sports: 'Sports & racing',
    trains: 'Trains & transport',
    history: 'Historical',
    other: 'Other games',
  },
};

const CATEGORY_DESCRIPTIONS: Record<UiLocale, Record<string, string>> = {
  es: {
    'board-game': 'Clásicos modernos, estrategia, party games y familiares.',
    expansion: 'Amplía los juegos que ya están en tu mesa.',
    'Tipo de Juego': 'Explora por mecánica, estilo de partida y ocasión.',
    Preventas: 'Reserva novedades antes de que lleguen a tienda.',
    Inventario: 'Opciones con disponibilidad activa para compra rápida.',
    Jugadores: 'Encuentra juegos por tamaño de mesa.',
    strategy: 'Gestión, colocación de trabajadores y control de área.',
    euro: 'Economía y gestión de recursos: poca suerte, muchas decisiones.',
    coop: 'Jugar en equipo contra el propio juego.',
    family: 'Se explican en cinco minutos y funcionan con toda la mesa.',
    'two-player': 'Ideales para parejas y duelos cara a cara.',
    card: 'Rápidos de sacar, fáciles de transportar, muy rejugables.',
    deckbuilding: 'Empieza con pocas cartas y forja tu motor.',
    solo: 'Pensados para disfrutar de una buena partida tú solo.',
    thematic: 'Aventura y exploración: inmersivos y narrativos.',
    horror: 'Tensión, zombis y sustos para las noches más oscuras.',
    fantasy: 'Mundos medievales con magia, héroes y criaturas.',
    scifi: 'Espacio, tecnología y futuros por conquistar.',
    dice: 'Tienta tu suerte y gestiona el azar en cada tirada.',
    party: 'Para grupos grandes: reglas que se explican en un minuto.',
    abstract: 'Sin azar ni tema, pura táctica sobre el tablero.',
    wargame: 'Conflicto, táctica militar y control del territorio.',
    campaign: 'Aventuras con progresión que evolucionan partida a partida.',
    deduction: 'Leer a los demás importa más que la tirada.',
    sports: 'Fútbol, ciclismo, motor y la última curva antes de meta.',
    trains: 'Conecta ciudades, reparte mercancías y construye tu red.',
    history: 'Roma, el Renacimiento, el Oeste y otras épocas reales.',
    other: 'Juegos que aún no tienen ficha completa.',
  },
  en: {
    'board-game': 'Modern classics, strategy, party games, and family favorites.',
    expansion: 'Expand games already on your table.',
    'Tipo de Juego': 'Browse by mechanic, play style, and occasion.',
    Preventas: 'Reserve new releases before they hit the store.',
    Inventario: 'Options with active stock for a quick purchase.',
    Jugadores: 'Find games by table size.',
    strategy: 'Management, worker placement and area control.',
    euro: 'Economy and resource management: low luck, high decisions.',
    coop: 'Play as a team against the game itself.',
    family: 'Five minutes to teach and they work for the whole table.',
    'two-player': 'Ideal for couples and head-to-head duels.',
    card: 'Quick to set up, easy to carry, endlessly replayable.',
    deckbuilding: 'Start with a few cards and forge your engine.',
    solo: 'Built for a great session on your own.',
    thematic: 'Adventure and exploration: immersive and narrative.',
    horror: 'Tension, zombies and scares for the darkest nights.',
    fantasy: 'Medieval worlds of magic, heroes and creatures.',
    scifi: 'Space, technology and futures to conquer.',
    dice: 'Push your luck and manage randomness on every roll.',
    party: 'For big groups: rules you explain in a minute.',
    abstract: 'No luck, no theme — pure tactics on the board.',
    wargame: 'Conflict, military tactics and territorial control.',
    campaign: 'Evolving adventures that carry over session to session.',
    deduction: 'Reading the table matters more than the roll.',
    sports: 'Football, cycling, motorsport and the final corner.',
    trains: 'Connect cities, deliver goods and build your network.',
    history: 'Rome, the Renaissance, the Old West and other real eras.',
    other: 'Games without a complete record yet.',
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
