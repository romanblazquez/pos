// Editorial guides — the informational half of the hub-and-spoke SEO model.
// Guides live on the same domain as the catalogue and interlink with product
// pages (guide → picks, product → guides that mention it).
//
// Content source is file-based today (one typed module per guide). This loader
// is the ONLY thing that knows that — swap GUIDES for a DB/CMS fetch later and
// the routing, templates, SEO and interlinking all keep working unchanged.
import { mejoresJuegos2Jugadores } from '../content/guides/mejores-juegos-2-jugadores.js';
import { mejoresJuegosParaPrincipiantes } from '../content/guides/mejores-juegos-para-principiantes.js';
import { mejoresJuegosDeEstrategia } from '../content/guides/mejores-juegos-de-estrategia.js';
import { mejoresJuegosParaTodaLaFamilia } from '../content/guides/mejores-juegos-para-toda-la-familia.js';
import { bestSoloBoardGames } from '../content/guides/best-solo-board-games.js';
import { bestCooperativeBoardGames } from '../content/guides/best-cooperative-board-games.js';
import { bestMiniaturesBoardGames } from '../content/guides/best-miniatures-board-games.js';
import { mejoresJuegosAbstractos } from '../content/guides/mejores-juegos-abstractos.js';
import generatedTranslations from '../content/editorial/translations.gen.json';
import { entityPath, type Locale } from './segments';

/** A curated product recommendation inside a guide (the guide → product link). */
export interface GuidePick {
  /** Real catalogue slug, e.g. '7-wonders-duel-173346'. */
  gameSlug: string;
  /** Editorial reason this game earns its place. */
  blurb: string;
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideContent {
  slug: string;
  title: string;
  /** Meta description + list-card subtitle. */
  description: string;
  /**
   * Byline persona id (see content/editorial/authors.ts). Lives on GuideContent
   * so a translation can carry its own locale-appropriate author — an es guide is
   * bylined by an es persona, its en translation by an en persona.
   */
  authorId?: string;
  /** Lead paragraphs shown above the picks. */
  intro: string[];
  picks: GuidePick[];
  sections?: GuideSection[];
  faq?: GuideFaq[];
}

export interface Guide extends GuideContent {
  /**
   * The language the piece was actually authored in. Every OTHER locale is
   * produced by Google Translate at build time (see tools/content/translate-guides.ts)
   * and stored in translations.gen.json — so an editorial always has a version in
   * every locale regardless of its original language. Defaults to 'es'.
   */
  originalLocale?: Locale;
  /**
   * Optional HUMAN-reviewed translations. When present for a locale they win over
   * the machine translation; when absent, the auto-translation is used.
   */
  translations?: Partial<Record<Locale, GuideContent>>;
  /** Set on the localized result when the shown text is a machine translation. */
  autoTranslated?: boolean;
  /** ISO dates — drive <article> datePublished/dateModified. */
  publishedAt: string;
  updatedAt: string;
}

// Build-time Google-Translate output, keyed by the guide's ORIGINAL-locale slug
// then by target locale. Regenerate with `pnpm tsx tools/content/translate-guides.ts`.
const GENERATED: Record<string, Partial<Record<Locale, GuideContent>>> = generatedTranslations;

const GUIDES: readonly Guide[] = [
  mejoresJuegos2Jugadores,
  mejoresJuegosParaPrincipiantes,
  mejoresJuegosDeEstrategia,
  mejoresJuegosParaTodaLaFamilia,
  bestSoloBoardGames,
  bestCooperativeBoardGames,
  bestMiniaturesBoardGames,
  mejoresJuegosAbstractos,
];

/** Raw, un-localized guides — for the build-time translation tool only. */
export function allGuidesRaw(): readonly Guide[] {
  return GUIDES;
}

function localizeGuide(guide: Guide, locale: Locale): Guide {
  const original = guide.originalLocale ?? 'es';
  if (locale === original) return guide;

  // Human-reviewed translation wins; otherwise fall back to the machine one; the
  // byline always stays the ORIGINAL author (a translation of their piece), and
  // autoTranslated is flagged so the page can disclose the machine version.
  const human = guide.translations?.[locale];
  if (human) return { ...guide, ...human, authorId: guide.authorId, autoTranslated: false };

  const machine = GENERATED[guide.slug]?.[locale];
  if (machine) return { ...guide, ...machine, authorId: guide.authorId, autoTranslated: true };

  return guide; // no translation yet — show the original text rather than 404.
}

export function listGuides(locale: Locale = 'es'): Guide[] {
  return [...GUIDES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((guide) => localizeGuide(guide, locale));
}

export function getGuide(slug: string, locale: Locale = 'es'): Guide | null {
  const guide = GUIDES.find((g) => localizeGuide(g, locale).slug === slug);
  return guide ? localizeGuide(guide, locale) : null;
}

export function guideAlternates(guide: Guide): Partial<Record<Locale, string>> {
  // Find the underlying (original-locale) guide this localized view came from, by
  // matching the requested slug against any locale's slug, then map every locale
  // to its own slug (human slug → machine slug → original slug).
  const canonical =
    GUIDES.find(
      (g) =>
        g.slug === guide.slug ||
        Object.values(g.translations ?? {}).some((t) => t?.slug === guide.slug) ||
        Object.values(GENERATED[g.slug] ?? {}).some((t) => t?.slug === guide.slug),
    ) ?? guide;
  return {
    es: entityPath('guides', 'es', localizeGuide(canonical, 'es').slug),
    en: entityPath('guides', 'en', localizeGuide(canonical, 'en').slug),
  };
}

/** Guides that recommend a given product — powers the product → guide back-link. */
export function guidesMentioning(gameSlug: string, locale: Locale = 'es'): Guide[] {
  return GUIDES
    .filter((g) => g.picks.some((p) => p.gameSlug === gameSlug))
    .map((guide) => localizeGuide(guide, locale));
}
