// Curated, search-trend-driven browse taxonomy (spec §9 hub-and-spoke SEO).
//
// The catalog's raw `category` field is only base-game vs expansion — useless as
// a browse axis. The real semantic signal lives in BGG tags/mechanics + player
// count, so we map the terms people actually search ("juegos de estrategia",
// "juegos para 2 jugadores", "cooperativos"…) onto rules over those signals.
// Each theme is one indexable landing page under /{locale}/categorias/{slug}.
//
// The DATABASE is the authority on membership: `category_rule` drives the
// materialized `mkt_product_category` bridge, and both the shelf counts and the
// category pages query the API by `key`. The rules below MIRROR that migration
// (libs/data/db-postgres/prisma/migrations/*_browse_taxonomy_full_coverage) and
// exist for one job only — naming a product's theme client-side when the API
// response predates the taxonomy. Keep the two in sync; the order of THEMES
// mirrors rule priority, so `primaryTheme` picks the same shelf the database
// marks primary. `tags` matches ANY of the listed BGG tags (OR).
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
  /**
   * Browsable but never a search landing page. Set on the catch-all shelf that
   * exists so every product has a category: its games are un-enriched stubs, so
   * the page stays out of the sitemap and carries a noindex.
   */
  noindex?: boolean;
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
    tags: ['Economic', 'Income', 'Market', 'Industry / Manufacturing', 'End Game Bonuses', 'Farming'],
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
    tags: ['Cooperative Game', 'Semi-Cooperative Game', 'Team-Based Game'],
    glyph: '🤝',
  },
  {
    key: 'family',
    slug: { es: 'juegos-de-mesa-familiares', en: 'family-board-games' },
    label: { es: 'Familiares y niños', en: 'Family & kids' },
    description: {
      es: 'Juegos de mesa familiares y para niños: se explican en cinco minutos y funcionan con toda la mesa, de los 6 a los 60.',
      en: 'Family and children’s board games: five minutes to teach and they work for the whole table, from 6 to 60.',
    },
    tags: ["Children's Game", 'Animals', 'Educational', 'Memory', 'Maze', 'Number'],
    glyph: '🧒',
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
    tags: ['Card Game', 'Trick-taking'],
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
    tags: [
      'Adventure', 'Exploration', 'Fighting', 'Miniatures', 'Novel-based',
      'Storytelling', 'Role Playing', 'Simulation', 'Pirates', 'Environmental', 'Medical',
      'Movies / TV / Radio theme', 'Video Game Theme', 'Comic Book / Strip', 'Book',
    ],
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
    tags: ['Horror', 'Zombies', 'Murder / Mystery'],
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
    // 'Real-time' and 'Real-Time' are both live BGG spellings — both are needed.
    tags: ['Party Game', 'Humor', 'Word Game', 'Real-time', 'Real-Time', 'Trivia', 'Action / Dexterity', 'Take That', 'Music'],
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
    tags: ['Abstract Strategy', 'Puzzle', 'Pattern Building', 'Pattern Recognition', 'Tile Placement', 'Paper-and-Pencil'],
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
  {
    key: 'deduction',
    slug: { es: 'juegos-de-deduccion', en: 'deduction-board-games' },
    label: { es: 'Deducción y faroleo', en: 'Deduction & bluffing' },
    description: {
      es: 'Juegos de deducción, faroleo y roles ocultos: leer a los demás importa más que la tirada.',
      en: 'Deduction, bluffing and hidden-role games: reading the table matters more than the roll.',
    },
    tags: ['Deduction', 'Bluffing', 'Betting and Bluffing', 'Murder / Mystery', 'Spies / Secret Agents', 'Hidden Movement', 'Negotiation', 'Voting', 'Mafia'],
    glyph: '🕵️',
  },
  {
    key: 'sports',
    slug: { es: 'juegos-de-deportes-y-carreras', en: 'sports-and-racing-board-games' },
    label: { es: 'Deportes y carreras', en: 'Sports & racing' },
    description: {
      es: 'Juegos de mesa de deportes y carreras: fútbol, ciclismo, motor y la última curva antes de meta.',
      en: 'Sports and racing board games: football, cycling, motorsport and the final corner.',
    },
    tags: ['Sports', 'Racing', 'Race'],
    glyph: '🏁',
  },
  {
    key: 'trains',
    slug: { es: 'juegos-de-trenes-y-transporte', en: 'train-and-transport-board-games' },
    label: { es: 'Trenes y transporte', en: 'Trains & transport' },
    description: {
      es: 'Juegos de trenes, rutas y transporte: conecta ciudades, reparte mercancías y construye tu red.',
      en: 'Train, route and transport games: connect cities, deliver goods and build your network.',
    },
    tags: ['Trains', 'Transportation', 'Network and Route Building', 'Pick-up and Deliver', 'Nautical', 'Aviation / Flight', 'Travel'],
    glyph: '🚂',
  },
  {
    key: 'history',
    slug: { es: 'juegos-de-mesa-historicos', en: 'historical-board-games' },
    label: { es: 'Históricos', en: 'Historical' },
    description: {
      es: 'Juegos de mesa históricos: Roma, el Renacimiento, el Oeste y otras épocas reales sobre la mesa.',
      en: 'Historical board games: Rome, the Renaissance, the Old West and other real eras on the table.',
    },
    tags: ['Ancient', 'Renaissance', 'Prehistoric', 'American West', 'Napoleonic', 'Post-Napoleonic', 'Age of Reason', 'Pike and Shot', 'Arabian', 'Religious'],
    glyph: '🏛️',
  },
  {
    // The catch-all shelf. It has no rules of its own: the database assigns it
    // when nothing else matches, which is what guarantees every product is
    // browsable. Kept out of the index — its games are catalogue stubs awaiting
    // enrichment, and thin content is not a landing page.
    key: 'other',
    slug: { es: 'otros-juegos-de-mesa', en: 'other-board-games' },
    label: { es: 'Otros juegos', en: 'Other games' },
    description: {
      es: 'Juegos que aún no tienen ficha completa: sin datos de BGG no podemos colocarlos en su estante temático.',
      en: 'Games without a complete record yet: with no BGG data we cannot place them on a themed shelf.',
    },
    glyph: '🎲',
    noindex: true,
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
 * crumb. THEMES follows the database's rule priority, so genre themes
 * (Estrategia, Cooperativos, Familiares…) win over the player-count theme when
 * both apply — a genre reads as a truer "category" than "Para N jugadores", and
 * the crumb matches the membership the database marked primary. Undefined when
 * the product carries no theme signal at all (a bare catalogue stub with no
 * tags), which is precisely the case the database files under `other`.
 */
export function primaryTheme(p: ThemeMatchable): Theme | undefined {
  return THEMES.find((theme) => productMatchesTheme(p, theme));
}

export function getThemeBySlug(locale: Locale, slug: string): Theme | undefined {
  return THEMES.find((theme) => theme.slug[locale] === slug || theme.key === slug);
}

/** Shelves that may be indexed — every theme except the catch-all. */
export const INDEXABLE_THEMES: Theme[] = THEMES.filter((theme) => !theme.noindex);
