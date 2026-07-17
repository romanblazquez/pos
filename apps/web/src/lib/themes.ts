// Curated, search-trend-driven browse taxonomy (spec §9 hub-and-spoke SEO).
//
// The catalog's raw `category` field is only base-game vs expansion — useless as
// a browse axis. The real semantic signal lives in BGG tags/mechanics + player
// count, so we map the terms people actually search ("juegos de estrategia",
// "juegos para 2 jugadores", "cooperativos"…) onto rules over those signals.
// Each theme is one indexable landing page under /{locale}/categorias/{slug}.
//
// Rules stay to a SINGLE dimension (tags OR minPlayers) so the index (which
// derives counts/covers from one product batch) and the detail page (which
// queries the API) agree exactly, and so counting needs no bggWeight (absent
// from ProductSummary). `tags` matches ANY of the listed BGG tags (OR), which is
// how the API's `mechanics` filter behaves.
import type { ProductSummary } from './api';
import type { Locale } from './segments';

export interface Theme {
  key: string;
  slug: Record<Locale, string>;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  /** BGG tags — a product matches the theme if it carries ANY of them. */
  tags?: string[];
  /** Player-count themes: product must support exactly this many players. */
  players?: number;
  /** Emoji shown when a theme has no representative product cover yet. */
  glyph: string;
}

// Themes mirror BoardGameGeek's own Categories and Mechanisms (the exact strings
// the enricher stores in `product.tags`) — BGG is the authority players search
// against, so aligning to it is both the most searchable and the most accurate.
// Ordered roughly by BGG prominence; the index only surfaces themes that
// currently have games, so the tail lights up as the catalogue grows.
export const THEMES: Theme[] = [
  {
    key: 'strategy',
    slug: { es: 'juegos-de-estrategia', en: 'strategy-board-games' },
    label: { es: 'Estrategia', en: 'Strategy' },
    description: {
      es: 'Los mejores juegos de mesa de estrategia: gestión, colocación de trabajadores y control de área para quienes piensan cada jugada.',
      en: 'The best strategy board games: management, worker placement and area control for players who plan every move.',
    },
    tags: ['Economic', 'Territory Building', 'Area Majority / Influence', 'Civilization', 'Political', 'Worker Placement', 'City Building'],
    glyph: '♟️',
  },
  {
    key: 'euro',
    slug: { es: 'eurogames', en: 'eurogames' },
    label: { es: 'Eurogames', en: 'Eurogames' },
    description: {
      es: 'Eurogames de economía y gestión de recursos: poca suerte, muchas decisiones y motores de puntos.',
      en: 'Economic, resource-management eurogames: low luck, high decision density and point engines.',
    },
    tags: ['Economic', 'Income', 'Market', 'Industry / Manufacturing', 'End Game Bonuses'],
    glyph: '🏭',
  },
  {
    key: 'coop',
    slug: { es: 'juegos-cooperativos', en: 'cooperative-board-games' },
    label: { es: 'Cooperativos', en: 'Cooperative' },
    description: {
      es: 'Juegos cooperativos para jugar en equipo contra el propio juego. Ganáis o perdéis juntos.',
      en: 'Cooperative games where you play as a team against the game itself. You win or lose together.',
    },
    tags: ['Cooperative Game'],
    glyph: '🤝',
  },
  {
    key: 'two-player',
    slug: { es: 'juegos-para-2-jugadores', en: '2-player-board-games' },
    label: { es: 'Para 2 jugadores', en: 'For 2 players' },
    description: {
      es: 'Juegos de mesa para 2 jugadores ideales para parejas y duelos cara a cara.',
      en: 'Two-player board games, ideal for couples and head-to-head duels.',
    },
    players: 2,
    glyph: '👥',
  },
  {
    key: 'card',
    slug: { es: 'juegos-de-cartas', en: 'card-games' },
    label: { es: 'De cartas', en: 'Card games' },
    description: {
      es: 'Juegos de cartas: rápidos de sacar, fáciles de transportar y con enorme rejugabilidad.',
      en: 'Card games: quick to set up, easy to carry and endlessly replayable.',
    },
    tags: ['Card Game'],
    glyph: '🃏',
  },
  {
    key: 'deckbuilding',
    slug: { es: 'juegos-de-construccion-de-mazos', en: 'deck-building-games' },
    label: { es: 'Construcción de mazos', en: 'Deck building' },
    description: {
      es: 'Juegos de construcción de mazos (deckbuilding): empieza con pocas cartas y forja tu motor.',
      en: 'Deck-building games: start with a few cards and forge your engine turn after turn.',
    },
    tags: ['Deck, Bag, and Pool Building'],
    glyph: '🃏',
  },
  {
    key: 'solo',
    slug: { es: 'juegos-en-solitario', en: 'solo-board-games' },
    label: { es: 'En solitario', en: 'Solo' },
    description: {
      es: 'Juegos de mesa en solitario diseñados para disfrutar de una buena partida tú solo.',
      en: 'Solo board games designed to enjoy a great session on your own.',
    },
    tags: ['Solo / Solitaire Game'],
    glyph: '🧩',
  },
  {
    key: 'thematic',
    slug: { es: 'juegos-tematicos-y-aventura', en: 'thematic-adventure-board-games' },
    label: { es: 'Temáticos y aventura', en: 'Thematic & adventure' },
    description: {
      es: 'Juegos temáticos de aventura y exploración: inmersivos, narrativos y con miniaturas.',
      en: 'Thematic adventure and exploration games: immersive, narrative and miniatures-driven.',
    },
    tags: ['Adventure', 'Exploration', 'Fighting', 'Miniatures', 'Novel-based'],
    glyph: '🗺️',
  },
  {
    key: 'horror',
    slug: { es: 'juegos-de-terror', en: 'horror-board-games' },
    label: { es: 'Terror', en: 'Horror' },
    description: {
      es: 'Juegos de mesa de terror: tensión, zombis y sustos para las noches más oscuras.',
      en: 'Horror board games: tension, zombies and scares for the darkest game nights.',
    },
    tags: ['Horror', 'Zombies', 'Murder/Mystery'],
    glyph: '👻',
  },
  {
    key: 'fantasy',
    slug: { es: 'juegos-de-fantasia', en: 'fantasy-board-games' },
    label: { es: 'Fantasía', en: 'Fantasy' },
    description: {
      es: 'Juegos de mesa de fantasía y mundos medievales llenos de magia, héroes y criaturas.',
      en: 'Fantasy and medieval board games full of magic, heroes and creatures.',
    },
    tags: ['Fantasy', 'Medieval', 'Mythology'],
    glyph: '🐉',
  },
  {
    key: 'scifi',
    slug: { es: 'juegos-de-ciencia-ficcion', en: 'sci-fi-board-games' },
    label: { es: 'Ciencia ficción', en: 'Sci-fi' },
    description: {
      es: 'Juegos de mesa de ciencia ficción: espacio, tecnología y futuros por conquistar.',
      en: 'Science-fiction board games: space, technology and futures to conquer.',
    },
    tags: ['Science Fiction', 'Space Exploration'],
    glyph: '🚀',
  },
  {
    key: 'dice',
    slug: { es: 'juegos-de-dados', en: 'dice-games' },
    label: { es: 'De dados', en: 'Dice games' },
    description: {
      es: 'Juegos de dados: emoción, tienta tu suerte y gestión del azar en cada tirada.',
      en: 'Dice games: excitement, push-your-luck and managing randomness on every roll.',
    },
    tags: ['Dice Rolling', 'Dice', 'Push Your Luck'],
    glyph: '🎲',
  },
  {
    key: 'party',
    slug: { es: 'juegos-de-fiesta', en: 'party-games' },
    label: { es: 'Fiesta y party', en: 'Party' },
    description: {
      es: 'Party games para grupos grandes: risas garantizadas y reglas que se explican en un minuto.',
      en: 'Party games for big groups: guaranteed laughs and rules you explain in a minute.',
    },
    tags: ['Party Game', 'Humor', 'Word Game'],
    glyph: '🎉',
  },
  {
    key: 'abstract',
    slug: { es: 'juegos-abstractos', en: 'abstract-strategy-games' },
    label: { es: 'Abstractos', en: 'Abstract' },
    description: {
      es: 'Juegos abstractos: sin azar ni tema, pura táctica sobre el tablero.',
      en: 'Abstract games: no luck, no theme — pure tactics on the board.',
    },
    tags: ['Abstract Strategy'],
    glyph: '⬢',
  },
  {
    key: 'wargame',
    slug: { es: 'juegos-de-guerra-wargames', en: 'wargames' },
    label: { es: 'Wargames', en: 'Wargames' },
    description: {
      es: 'Wargames y juegos de batallas: conflicto, táctica militar y control del territorio.',
      en: 'Wargames and battle games: conflict, military tactics and territorial control.',
    },
    tags: ['Wargame', 'Wars', 'World War II', 'American Civil War'],
    glyph: '⚔️',
  },
  {
    key: 'campaign',
    slug: { es: 'juegos-de-campana', en: 'campaign-board-games' },
    label: { es: 'Campañas y legacy', en: 'Campaign & legacy' },
    description: {
      es: 'Juegos de campaña y legacy: aventuras con progresión que evolucionan partida a partida.',
      en: 'Campaign and legacy games: evolving adventures that carry over session to session.',
    },
    tags: ['Scenario / Mission / Campaign Game', 'Legacy Game', 'Campaign / Battle Card Driven'],
    glyph: '📖',
  },
];

// Only the three fields a theme rule reads, so both ProductSummary (index) and
// ProductDetail (product page breadcrumb) can be matched without coupling to
// either full shape.
type ThemeMatchable = Pick<ProductSummary, 'tags' | 'minPlayers' | 'maxPlayers'>;

/** True when a product belongs in the theme (same rule the API detail query uses). */
export function productMatchesTheme(p: ThemeMatchable, theme: Theme): boolean {
  if (theme.players != null) {
    return p.minPlayers != null && p.maxPlayers != null
      && p.minPlayers <= theme.players && p.maxPlayers >= theme.players;
  }
  if (theme.tags) return theme.tags.some((tag) => p.tags.includes(tag));
  return false;
}

/**
 * The single best browse theme for a product, used as the middle breadcrumb
 * crumb. THEMES is ordered by BGG prominence, so genre themes (Estrategia,
 * Cooperativos…) win over the player-count theme when both apply — a genre
 * reads as a truer "category" than "Para N jugadores". Undefined when the
 * product carries no theme signal (e.g. a bare catalogue stub with no tags).
 */
export function primaryTheme(p: ThemeMatchable): Theme | undefined {
  return THEMES.find((theme) => productMatchesTheme(p, theme));
}

export function getThemeBySlug(locale: Locale, slug: string): Theme | undefined {
  return THEMES.find((t) => t.slug[locale] === slug);
}
