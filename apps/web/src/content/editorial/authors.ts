// Editorial personas — the bylines behind guides and "editor's take" reviews.
//
// These are fictional but *stable* reviewer identities with distinct regional
// voices (three Spanish, three English). They exist so editorial copy reads as
// written by real, opinionated people rather than a single anonymous machine.
//
// Everything here is PURE and SEEDED: given the same game slug you always get the
// same author, the same (optional) benign typo and the same publish date. That
// makes output reproducible, reviewable in diffs, and reversible. The module has
// no runtime dependencies so both the web app (bylines) and the content pipeline
// (tools/content) can import it.
//
// See docs/content-seo/PLAYBOOK.md §5 for the editorial standards these support.

export type EditorialLocale = 'es' | 'en';

export interface Author {
  id: string;
  /**
   * Admin-facing handle stored in `editorial_author.slug`, echoed by the API.
   * Public profile URLs do NOT read it — see `editorSlug()` in lib/guides.ts.
   */
  slug?: string;
  name: string;
  locale: EditorialLocale;
  /** Human-facing origin, e.g. "Guadalajara, México". */
  from: string;
  countryCode: string;
  /** One-line byline bio shown under the name. */
  bio: string;
  /** Editorial beat shown on the guides hub. */
  role: string;
  /** Reader-facing subjects this editor covers. */
  expertise: string[];
  /** Stable review criteria used to keep recommendations consistent. */
  reviewPrinciples: string[];
  /** Internal note on voice/register — guides how their copy should sound. */
  voice: string;
  /** BGG-style tags/genres this author gravitates to (lowercased contains-match). */
  leans: string[];
  /** Signature closing line, in their own voice/language. */
  signoff: string;
}

export const AUTHORS: readonly Author[] = [
  {
    id: 'sofia-mx',
    name: 'Sofía Herrera',
    locale: 'es',
    from: 'Guadalajara, México',
    countryCode: 'MX',
    bio: 'Ludoteca los domingos y dos peques que revisan cada caja antes que yo. Escribo sobre juegos que abren la mesa a todos.',
    role: 'Editora de juegos familiares y de iniciación',
    expertise: ['Familiares', 'Party games', 'Juegos infantiles', 'Primeras ludotecas'],
    reviewPrinciples: ['Explicación breve', 'Participación de toda la mesa', 'Buena rejugabilidad'],
    voice: 'Cálida, cercana, mexicana neutra-tapatía. Usa "ustedes", ejemplos de sobremesa familiar, cero jerga anglo innecesaria.',
    leans: ['family', 'party', 'animals', 'gateway', 'set collection', 'pattern building', 'children'],
    signoff: 'Nos leemos en la próxima partida.',
  },
  {
    id: 'mateo-ar',
    name: 'Mateo Bonavena',
    locale: 'es',
    from: 'Buenos Aires, Argentina',
    countryCode: 'AR',
    bio: 'Diez años puliendo un grupo de eurogames pesados los martes. Si tiene planilla de puntuación larga, es lo mío.',
    role: 'Editor de estrategia y eurogames',
    expertise: ['Eurogames', 'Economía', 'Colocación de trabajadores', 'Juegos exigentes'],
    reviewPrinciples: ['Decisiones con impacto', 'Escalado entre jugadores', 'Profundidad sin complejidad gratuita'],
    voice: 'Porteño, irónico, preciso con la mecánica. Usa "vos/tenés", "che" con moderación, metáforas futboleras ocasionales.',
    leans: ['economic', 'industry', 'euro', 'wargame', 'territory building', 'income', 'market', 'heavy', 'civilization'],
    signoff: 'Nos vemos del otro lado del tablero.',
  },
  {
    id: 'nuria-es',
    name: 'Núria Ferrer',
    locale: 'es',
    from: 'Barcelona, España',
    countryCode: 'ES',
    bio: 'Diseñadora gráfica de día, cazadora de abstractos de noche. Me fijo en cómo se ve y se siente una caja tanto como en cómo se juega.',
    role: 'Editora de diseño, abstractos y juegos para dos',
    expertise: ['Abstractos', 'Patrones', 'Juegos para dos', 'Diseño de componentes'],
    reviewPrinciples: ['Legibilidad visual', 'Reglas elegantes', 'Calidad táctil y accesibilidad'],
    voice: 'Peninsular culta, atenta al diseño y la estética, frases medidas. Usa "vosotros", vocabulario de diseño (retícula, paleta).',
    leans: ['abstract strategy', 'puzzle', 'tile placement', '2-player', 'card game', 'drafting', 'hexagon grid'],
    signoff: 'Que tengáis buenas partidas.',
  },
  {
    id: 'eoin-ie',
    name: 'Eoin Gallagher',
    locale: 'en',
    from: 'Galway, Ireland',
    countryCode: 'IE',
    bio: 'I run a Thursday co-op night above a pub. Give me a campaign box, a pot of tea, and four friends who read the rules.',
    role: 'Co-operative and campaign editor',
    expertise: ['Co-operative games', 'Campaigns', 'Narrative adventures', 'Legacy systems'],
    reviewPrinciples: ['Meaningful teamwork', 'Scenario variety', 'A story shaped by play'],
    voice: 'Irish English, storytelling register, dry warmth. "grand", "the craic", tea references; long thematic sentences broken by short punchy ones.',
    leans: ['cooperative', 'campaign', 'adventure', 'fantasy', 'horror', 'legacy', 'scenario', 'miniatures'],
    signoff: "That's me for now — mind how you shuffle.",
  },
  {
    id: 'kasia-pl',
    name: 'Kasia Nowak',
    locale: 'en',
    from: 'Kraków, Poland',
    countryCode: 'PL',
    bio: 'Spreadsheet brain, solo-mode devotee. I will happily lose three hours to an optimisation puzzle and call it a good evening.',
    role: 'Solo and systems editor',
    expertise: ['Solo modes', 'Deck-building', 'Engine building', 'Optimisation'],
    reviewPrinciples: ['Low upkeep', 'Strategic efficiency', 'A solo mode worth owning'],
    voice: 'Polish-inflected English (clean, occasionally slightly formal syntax), analytical, precise about numbers and efficiency.',
    leans: ['economic', 'deck building', 'engine', 'solo', 'strategy', 'trains', 'stock', 'optimization', 'income'],
    signoff: 'Play well, count carefully.',
  },
  {
    id: 'dave-us',
    name: 'Dave Ruggiero',
    locale: 'en',
    from: 'Norristown, Pennsylvania',
    countryCode: 'US',
    bio: 'Basement table off the Main Line, Friday nights, too many dice. If minis need painting, they are already primed on my desk.',
    role: 'Thematic and miniatures editor',
    expertise: ['Miniatures', 'Horror', 'Tactical combat', 'Dice systems'],
    reviewPrinciples: ['Table presence', 'Tension and pacing', 'Setup justified by the experience'],
    voice: 'Philly-area American, casual and loud, hobby-insider. "buddy", "no joke", parenthetical asides, table-talk energy.',
    leans: ['dice', 'miniatures', 'horror', 'fighting', 'ameritrash', 'dungeon', 'thematic', 'exploration', 'combat'],
    signoff: 'Roll well, and paint your minis.',
  },
];

export const AUTHORS_BY_ID: Readonly<Record<string, Author>> = Object.fromEntries(
  AUTHORS.map((a) => [a.id, a]),
);

// ---------------------------------------------------------------------------
// Seeded, dependency-free PRNG helpers (mulberry32 + FNV-1a string hash).
// ---------------------------------------------------------------------------

function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically pick the best-fit author for a game in a given locale.
 * Scores each same-locale author by how many of the game's tags match their
 * `leans`; ties (and the tag-less case) break on a slug-seeded roll so no single
 * persona ever dominates a locale.
 */
export function pickAuthor(slug: string, locale: EditorialLocale, tags: string[] = []): Author {
  const pool = AUTHORS.filter((a) => a.locale === locale);
  const hay = tags.map((t) => t.toLowerCase());
  const roll = rng(`${slug}:${locale}`);
  let best: Author = pool[0];
  let bestScore = -1;
  for (const a of pool) {
    const score = a.leans.reduce((n, lean) => n + (hay.some((t) => t.includes(lean) || lean.includes(t)) ? 1 : 0), 0);
    const jitter = roll() * 0.9; // < 1 so a real tag match always outweighs jitter
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      best = a;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Benign typo injection — see PLAYBOOK §4.2 / §5.3.
// ~30% of pieces get exactly one non-critical typo, chosen deterministically.
// Never touches protected spans (game name, links, headings) — the caller passes
// text that already excludes those, or lists them in `protect`.
// ---------------------------------------------------------------------------

const EN_SWAPS: Array<[RegExp, string]> = [
  [/\bthe\b/, 'teh'],
  [/\byou\b/, 'yuo'],
  [/\bbecause\b/, 'becuase'],
  [/\bdefinitely\b/, 'definitly'],
  [/\breally\b/, 'realy'],
  [/\bwhich\b/, 'wich'],
];
const ES_SWAPS: Array<[RegExp, string]> = [
  [/\bque\b/, 'qeu'],
  [/\btambién\b/, 'tambien'],
  [/\brápido\b/, 'rapido'],
  [/\bpartida\b/, 'partdia'],
  [/\bestrategia\b/, 'estrategai'],
  [/\bmás\b/, 'mas'],
];

export function maybeTypo(
  text: string,
  seed: string,
  locale: EditorialLocale,
  opts: { protect?: string[]; rate?: number } = {},
): { text: string; injected: string | null } {
  const roll = rng(`typo:${seed}`);
  if (roll() > (opts.rate ?? 0.3)) return { text, injected: null };

  const swaps = (locale === 'es' ? ES_SWAPS : EN_SWAPS).filter(([re]) => {
    const m = text.match(re);
    if (!m) return false;
    // Skip if the match sits inside a protected substring.
    return !(opts.protect ?? []).some((p) => p.toLowerCase().includes(m[0].toLowerCase()));
  });
  if (!swaps.length) return { text, injected: null };

  const [re, wrong] = swaps[Math.floor(roll() * swaps.length)];
  const original = text.match(re)![0];
  return { text: text.replace(re, wrong), injected: `${original}→${wrong}` };
}

// ---------------------------------------------------------------------------
// Release-consistent editorial dates — see PLAYBOOK §4.2.
// A stable pseudo-random date in [max(release, 2024-01-01), today]. A review can
// never predate the game it reviews, and never predates the project (2024).
// ---------------------------------------------------------------------------

const PROJECT_START = Date.UTC(2024, 0, 1);

export function editorialDate(gameYear: number | null | undefined, seed: string, now = new Date()): string {
  const releaseFloor = gameYear ? Date.UTC(gameYear, 0, 1) : PROJECT_START;
  const lo = Math.max(releaseFloor, PROJECT_START);
  const hi = now.getTime();
  const span = Math.max(hi - lo, 0);
  const roll = rng(`date:${seed}`);
  const at = lo + Math.floor(roll() * span);
  return new Date(at).toISOString().slice(0, 10);
}
