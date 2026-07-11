// Localized URL architecture (spec §2, §3).
//
// Every indexable entity lives under /{locale}/{localized-segment}/{slug}.
// The segment itself is localized (es: juegos-de-mesa, en: board-games), which
// is why routing is done through a single dynamic [locale]/[type] resolver
// rather than hardcoded route folders — it keeps slugs human-readable and
// localized while letting one code path build canonical + hreflang for all.

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

// Locales whose pages are allowed to be indexed RIGHT NOW. English routes
// exist and render, but stay noindex + self-canonical until real (non-machine)
// translations land — so we never feed Google low-quality MT (spec §3).
// Flip to ['es', 'en'] in one place when EN content is genuinely ready.
export const INDEXABLE_LOCALES: readonly Locale[] = ['es'];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isIndexable(locale: Locale): boolean {
  return INDEXABLE_LOCALES.includes(locale);
}

// Entity kinds and their localized path segments.
export type EntityKind =
  | 'games' | 'categories' | 'publishers' | 'mechanics' | 'stores' | 'search' | 'guides';

export const SEGMENTS: Record<EntityKind, Record<Locale, string>> = {
  games: { es: 'juegos-de-mesa', en: 'board-games' },
  categories: { es: 'categorias', en: 'categories' },
  publishers: { es: 'editoriales', en: 'publishers' },
  mechanics: { es: 'mecanicas', en: 'mechanics' },
  stores: { es: 'tiendas', en: 'stores' },
  search: { es: 'buscar', en: 'search' },
  // Editorial hub — guides/best-of lists that interlink with catalog pages.
  guides: { es: 'guias', en: 'guides' },
};

/** Resolve a localized path segment back to its entity kind, scoped to locale. */
export function resolveKind(locale: Locale, segment: string): EntityKind | null {
  for (const kind of Object.keys(SEGMENTS) as EntityKind[]) {
    if (SEGMENTS[kind][locale] === segment) return kind;
  }
  return null;
}

export function segmentFor(kind: EntityKind, locale: Locale): string {
  return SEGMENTS[kind][locale];
}

/** Path to a listing root, e.g. /es/juegos-de-mesa. */
export function listingPath(kind: EntityKind, locale: Locale): string {
  return `/${locale}/${segmentFor(kind, locale)}`;
}

/** Path to an entity detail, e.g. /es/juegos-de-mesa/catan. */
export function entityPath(kind: EntityKind, locale: Locale, slug: string): string {
  return `${listingPath(kind, locale)}/${slug}`;
}

export function homePath(locale: Locale): string {
  return `/${locale}`;
}

// Lowercase, hyphenated, ASCII-folded slug (spec §2). Stable + human-readable.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
