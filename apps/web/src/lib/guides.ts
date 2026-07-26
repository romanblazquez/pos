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
import { editorBatchJuly2026 } from '../content/guides/editor-batch-july-2026.js';
import { trendingGuidesJuly2026 } from '../content/guides/trending-guides-july-2026.js';
import { AUTHORS, type Author } from '../content/editorial/authors.js';
import generatedTranslations from '../content/editorial/translations.gen.json';
import { entityPath, slugify, type Locale } from './segments';
import { API_BASE_URL } from './site';

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

export interface GuideSource {
  label: string;
  url: string;
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
  /** Primary sources for time-sensitive facts; all editorial prose remains original. */
  sources?: GuideSource[];
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
  /**
   * Curated 1600×900 social/OG image (language-neutral), served from /public.
   * Attached from OG_IMAGES below by the guide's canonical slug, so it survives
   * localization (translations spread over the base but never carry this key).
   */
  ogImage?: string;
  /** Localized slugs supplied by the database API. */
  alternates?: Partial<Record<Locale, string>>;
  /** Joined author profile supplied by the database API. */
  author?: Author;
}

// Per-guide OG art (public/guides/*.jpg), keyed by each guide's canonical
// (original-locale) slug. The common guides-section banner is the fallback for
// the hub and any guide without its own art (see GUIDE_OG_DEFAULT).
export const GUIDE_OG_DEFAULT = '/guides/guides-default.jpg';
const OG_IMAGES: Record<string, string> = {
  'mejores-juegos-de-mesa-2-jugadores': '/guides/2-jugadores.jpg',
  'mejores-juegos-de-mesa-para-principiantes': '/guides/principiantes.jpg',
  'mejores-juegos-de-mesa-de-estrategia': '/guides/estrategia.jpg',
  'mejores-juegos-de-mesa-para-toda-la-familia': '/guides/familia.jpg',
  'best-solo-board-games': '/guides/solitario.jpg',
  'best-cooperative-board-games': '/guides/cooperativos.jpg',
  'best-miniatures-board-games': '/guides/miniaturas.jpg',
  'mejores-juegos-de-mesa-abstractos': '/guides/abstractos.jpg',
  'mejores-party-games-para-grupos': '/categories/party-hero.webp',
  'mejores-juegos-colocacion-de-trabajadores': '/categories/strategy-hero.webp',
  'juegos-de-mesa-bonitos-colocacion-losetas': '/categories/abstract-hero.webp',
  'best-campaign-board-games-for-a-regular-group': '/categories/campaign-hero.webp',
  'best-deck-building-board-games': '/categories/deckbuilding-hero.webp',
  'best-horror-board-games-that-build-real-tension': '/categories/horror-hero.webp',
  'spiel-des-jahres-2026-ganadores-y-finalistas': '/categories/family-hero.webp',
  'best-quick-setup-solo-board-games': '/categories/solo-hero.webp',
  'mejores-juegos-cooperativos-para-parejas': '/categories/coop-hero.webp',
};

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
  ...editorBatchJuly2026,
  ...trendingGuidesJuly2026,
].map((guide) => ({ ...guide, ogImage: OG_IMAGES[guide.slug] ?? GUIDE_OG_DEFAULT }));

/** Raw, un-localized guides — for the build-time translation tool only. */
export function allGuidesRaw(): readonly Guide[] {
  return GUIDES;
}

export function localizeGuide(guide: Guide, locale: Locale): Guide {
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

function fixtureGuides(locale: Locale): Guide[] {
  return [...GUIDES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((guide) => localizeGuide(guide, locale));
}

async function editorialApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/editorial${path}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

/** Database-first published guides, with migration-safe source fixture fallback. */
export async function listGuides(locale: Locale = 'es'): Promise<Guide[]> {
  const stored = await editorialApi<Guide[]>(`/guides?locale=${locale}`);
  return stored?.length ? stored : fixtureGuides(locale);
}

/**
 * URL slug for an editor's profile page — a pure function of the name, so it
 * reads as the person (/es/editores/sofia-herrera, not /sofia-mx).
 *
 * Deliberately NOT read from the stored `slug` column. Editor objects reach this
 * function from two different API shapes (the `/authors` list and the author
 * joined onto a guide), so honouring a stored slug makes a byline and its
 * profile disagree whenever those two shapes — or the API and the web app —
 * deploy out of step, which 404s the byline. Deriving from the name that both
 * shapes always carry makes that class of mismatch impossible. The migration
 * writes the identical value to `editorial_author.slug`, which stays the
 * admin-facing handle and the uniqueness constraint.
 */
export function editorSlug(author: Author): string {
  return slugify(author.name);
}

/** Path to an editor's profile page in a given site locale. */
export function editorPath(author: Author, locale: Locale): string {
  return entityPath('editors', locale, editorSlug(author));
}

/**
 * Every active editor, in BOTH site locales. An editor's `locale` is the
 * language they write in, not the audience they're shown to — Eoin writes in
 * English but is still part of the masthead a Spanish reader sees, so the
 * profiles are never filtered by site locale.
 */
export async function listEditorialAuthors(): Promise<Author[]> {
  const stored = await editorialApi<Author[]>('/authors');
  return stored?.length ? stored : [...AUTHORS];
}

export async function getEditorialAuthor(slug: string): Promise<Author | null> {
  const authors = await listEditorialAuthors();
  return authors.find((author) => editorSlug(author) === slug) ?? null;
}

/** Guides bylined to an editor, newest first — powers the profile page. */
export async function guidesByAuthor(authorId: string, locale: Locale = 'es'): Promise<Guide[]> {
  return (await listGuides(locale)).filter((guide) => guide.authorId === authorId);
}

export async function getGuide(slug: string, locale: Locale = 'es'): Promise<Guide | null> {
  const stored = await editorialApi<Guide>(
    `/guides/${encodeURIComponent(slug)}?locale=${locale}`,
  );
  if (stored) return stored;
  const guide = GUIDES.find((candidate) => localizeGuide(candidate, locale).slug === slug);
  return guide ? localizeGuide(guide, locale) : null;
}

export function guideAlternates(guide: Guide): Partial<Record<Locale, string>> {
  if (guide.alternates) {
    return Object.fromEntries(
      Object.entries(guide.alternates).map(([locale, slug]) => [
        locale,
        entityPath('guides', locale as Locale, slug!),
      ]),
    );
  }
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
export async function guidesMentioning(gameSlug: string, locale: Locale = 'es'): Promise<Guide[]> {
  return (await listGuides(locale)).filter(
    (guide) => guide.picks.some((pick) => pick.gameSlug === gameSlug),
  );
}
