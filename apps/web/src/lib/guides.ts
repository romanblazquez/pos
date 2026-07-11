// Editorial guides — the informational half of the hub-and-spoke SEO model.
// Guides live on the same domain as the catalogue and interlink with product
// pages (guide → picks, product → guides that mention it).
//
// Content source is file-based today (one typed module per guide). This loader
// is the ONLY thing that knows that — swap GUIDES for a DB/CMS fetch later and
// the routing, templates, SEO and interlinking all keep working unchanged.
import { mejoresJuegos2Jugadores } from '../content/guides/mejores-juegos-2-jugadores.js';

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

export interface Guide {
  slug: string;
  title: string;
  /** Meta description + list-card subtitle. */
  description: string;
  /** Lead paragraphs shown above the picks. */
  intro: string[];
  picks: GuidePick[];
  sections?: GuideSection[];
  faq?: GuideFaq[];
  /** ISO dates — drive <article> datePublished/dateModified. */
  publishedAt: string;
  updatedAt: string;
}

const GUIDES: readonly Guide[] = [mejoresJuegos2Jugadores];

export function listGuides(): Guide[] {
  return [...GUIDES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

/** Guides that recommend a given product — powers the product → guide back-link. */
export function guidesMentioning(gameSlug: string): Guide[] {
  return GUIDES.filter((g) => g.picks.some((p) => p.gameSlug === gameSlug));
}
