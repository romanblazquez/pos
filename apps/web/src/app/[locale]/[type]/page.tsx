import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getMechanics, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbLd, itemListLd, blogLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { LocaleAlternates } from '@/components/LocaleAlternates';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { GuidesExplorer, type GuideCardData } from '@/components/GuidesExplorer';
import { guideCover } from '@/lib/guide-cover';
import { AUTHORS_BY_ID } from '@/content/editorial/authors';
import { ProductCard } from '@/components/ProductCard';
import { CatalogEmpty } from '@/components/CatalogEmpty';
import { CatalogSearchField } from '@/components/CatalogSearchField';
import { Pager } from '@/components/Pager';
import { SearchFilters, categoryFromParam, filterActiveCount, filterSheetLabels, type FilterState } from '@/components/SearchFilters';
import { FilterSheet, FilterSheetPanel, FilterSheetTrigger } from '@retail-os/ui-react';
import {
  entityPath,
  homePath,
  isLocale,
  listingPath,
  resolveKind,
  type Locale,
} from '@/lib/segments';
import { listGuides, GUIDE_OG_DEFAULT } from '@/lib/guides';
import { THEMES } from '@/lib/themes';
import { listShelves } from '@/lib/shelves';
import { ShelfCard } from '@/components/ShelfCard';
import { PromoBanner, PromoStrip } from '@/components/PromoBanner';
import { getPromos, rotateTones } from '@/lib/promos';
import { absoluteUrl } from '@/lib/site';
import { CardShareButton } from '@/components/CardShareButton';

export const revalidate = 1800;

const PAGE_SIZE = 24;

// A short newspaper-style section label derived from the guide's title, so the
// hub cards carry a "kicker" without adding data to every guide module.
function guideKicker(title: string, locale: Locale): string {
  const t = title.toLowerCase();
  const map: Array<[RegExp, [string, string]]> = [
    [/estrateg|strategy/, ['Estrategia', 'Strategy']],
    [/famil/, ['Familia', 'Family']],
    [/principiante|beginner/, ['Principiantes', 'Beginners']],
    [/2 jugador|2 player|dos jugador/, ['2 jugadores', '2 players']],
    [/solitario|\bsolo\b/, ['En solitario', 'Solo']],
    [/cooperativ|cooperative|co-op/, ['Cooperativos', 'Co-op']],
    [/miniatura|miniature/, ['Miniaturas', 'Miniatures']],
    [/abstract/, ['Abstractos', 'Abstract']],
  ];
  for (const [re, [es, en]] of map) if (re.test(t)) return locale === 'es' ? es : en;
  return locale === 'es' ? 'Guía' : 'Guide';
}

function pageOf(searchParams: { page?: string }): number {
  const n = parseInt(searchParams.page ?? '1', 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

// Next.js parses a repeated query param as string[] only when there are 2+
// values — a single checked checkbox arrives as a bare string.
function toMechanicsArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: string; type: string };
  searchParams: {
    page?: string;
    category?: string;
    inStock?: string;
    sort?: string;
    max?: string;
    players?: string;
    mechanics?: string | string[];
    complexity?: string;
    publisher?: string;
    year?: string;
    age?: string;
    duration?: string;
  };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  const page = pageOf(searchParams);

  if (kind === 'search') {
    return buildMetadata({
      locale,
      path: listingPath('search', locale),
      title: locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games',
      description:
        locale === 'es'
          ? 'Busca juegos de mesa y compara precios entre tiendas.'
          : 'Search board games and compare prices across stores.',
      noindex: true,
    });
  }

  if (kind === 'guides') {
    return buildMetadata({
      locale,
      path: listingPath('guides', locale),
      title: locale === 'es' ? 'Guías de juegos de mesa' : 'Board game guides',
      description:
        locale === 'es'
          ? 'Guías, comparativas y listas de los mejores juegos de mesa, con precios comparados entre tiendas.'
          : 'Guides, comparisons and best-of lists for board games, with prices compared across stores.',
      images: [GUIDE_OG_DEFAULT],
      alternates: { es: listingPath('guides', 'es'), en: listingPath('guides', 'en') },
    });
  }

  if (kind !== 'games' && kind !== 'categories') return {};

  // Faceted/filtered or deeper-page URLs are navigational — keep them out of the
  // index so only the clean base listing competes (spec §9).
  const filtered = Boolean(
    searchParams.category || searchParams.inStock || searchParams.sort || searchParams.max || searchParams.players
    || searchParams.complexity || searchParams.publisher || searchParams.year
    || searchParams.age || searchParams.duration || toMechanicsArray(searchParams.mechanics).length > 0,
  );
  const navigational = page > 1 || filtered;

  const path = page > 1 ? `${listingPath(kind, locale)}?page=${page}` : listingPath(kind, locale);
  const isGames = kind === 'games';
  const base = isGames
    ? locale === 'es' ? 'Juegos de mesa' : 'Board games'
    : locale === 'es' ? 'Categorías de juegos de mesa' : 'Board game categories';
  const title = page > 1 ? `${base} — ${locale === 'es' ? 'página' : 'page'} ${page}` : base;
  const description = isGames
    ? locale === 'es'
      ? 'Catálogo de juegos de mesa con precios comparados entre tiendas verificadas.'
      : 'Board game catalogue with prices compared across verified stores.'
    : locale === 'es'
      ? 'Explora juegos de mesa por categoría —estrategia, familiares, party, 2 jugadores y más— con precios y stock real comparados entre tiendas verificadas.'
      : 'Browse board games by category —strategy, family, party, 2-player and more— with real prices and stock compared across verified stores.';

  return buildMetadata({
    locale,
    path,
    title,
    description,
    noindex: navigational,
    alternates: navigational
      ? undefined
      : { es: listingPath(kind, 'es'), en: listingPath(kind, 'en') },
  });
}

// Serialize active filters (everything except page) so pagination preserves them.
function filterQuery(sp: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const k of ['q', 'category', 'inStock', 'sort', 'max', 'players', 'complexity', 'publisher', 'year', 'age', 'duration'] as const) {
    if (sp[k]) p.set(k, sp[k] as string);
  }
  for (const mechanic of toMechanicsArray(sp.mechanics)) p.append('mechanics', mechanic);
  return p.toString();
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: { locale: string; type: string };
  searchParams: {
    q?: string;
    page?: string;
    category?: string;
    inStock?: string;
    sort?: string;
    max?: string;
    players?: string;
    mechanics?: string | string[];
    complexity?: string;
    publisher?: string;
    year?: string;
    age?: string;
    duration?: string;
  };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  const homeName = locale === 'es' ? 'Inicio' : 'Home';
  const page = pageOf(searchParams);

  // ── Search (faceted) ───────────────────────────────────────────────────────
  if (kind === 'search') {
    const q = (searchParams.q ?? '').trim();
    const [categories, mechanics] = await Promise.all([getCategories(), getMechanics()]);
    const state: FilterState = {
      q,
      category: categoryFromParam(searchParams.category, categories),
      inStock: searchParams.inStock === 'true',
      sort: (searchParams.sort as FilterState['sort']) || undefined,
      max: searchParams.max ? Math.max(0, parseInt(searchParams.max, 10)) || undefined : undefined,
      players: searchParams.players ? Math.max(1, parseInt(searchParams.players, 10)) || undefined : undefined,
      mechanics: toMechanicsArray(searchParams.mechanics),
      complexity: searchParams.complexity || undefined,
      publisher: searchParams.publisher || undefined,
      yearPublished: searchParams.year ? Math.max(1, parseInt(searchParams.year, 10)) || undefined : undefined,
      minAge: searchParams.age ? Math.max(1, parseInt(searchParams.age, 10)) || undefined : undefined,
      playTimeMinutes: searchParams.duration ? Math.max(1, parseInt(searchParams.duration, 10)) || undefined : undefined,
    };
    const { results, total } = await listProducts({
      q,
      semantic: isNaturalLanguageQuery(q) && !(
        state.category || state.inStock || state.sort || state.max || state.players
        || state.complexity || state.publisher || state.yearPublished || state.minAge
        || state.playTimeMinutes || state.mechanics.length > 0
      ),
      locale,
      category: state.category,
      inStock: state.inStock,
      sortBy: state.sort,
      maxPriceMinor: state.max != null ? state.max * 100 : undefined,
      minPlayers: state.players,
      mechanics: state.mechanics,
      complexity: state.complexity,
      publisher: state.publisher,
      yearPublished: state.yearPublished,
      minAge: state.minAge,
      playTimeMinutes: state.playTimeMinutes,
      limit: 48,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Buscar' : 'Search', path: listingPath('search', locale) },
    ];
    return (
      <main className="container-wide">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="page-title">
          {q
            ? locale === 'es' ? `Resultados para “${q}”` : `Results for “${q}”`
            : locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games'}
        </h1>
        <form method="get" action={listingPath('search', locale)}>
          <FilterSheet labels={filterSheetLabels(locale, total)} activeCount={filterActiveCount(state)}>
          <CatalogSearchField
            locale={locale}
            initialValue={q}
            searchPath={listingPath('search', locale)}
            productBase={listingPath('games', locale)}
            placeholder={locale === 'es' ? 'Catan, estrategia, 2 jugadores…' : 'Catan, strategy, 2 players…'}
            className="search-command"
            trailing={<FilterSheetTrigger />}
          />
          <div className="search-layout">
            <FilterSheetPanel>
              <SearchFilters
                locale={locale}
                categories={categories}
                mechanics={mechanics}
                state={state}
                total={total}
                clearHref={q ? `${listingPath('search', locale)}?q=${encodeURIComponent(q)}` : listingPath('search', locale)}
              />
            </FilterSheetPanel>
            <div className="search-results">
              <p className="muted" style={{ marginBottom: '1rem' }}>
                {total} {locale === 'es' ? 'resultados' : 'results'}
              </p>
              {results.length > 0 ? (
                <div className="catalog-grid">
                  {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
                </div>
              ) : (
                <CatalogEmpty locale={locale} clearHref={listingPath('search', locale)} />
              )}
            </div>
          </div>
          </FilterSheet>
        </form>
      </main>
    );
  }

  // ── Games catalog (faceted sidebar + paginated over the full catalogue) ─────
  if (kind === 'games') {
    const base = listingPath('games', locale);
    const [categories, mechanics] = await Promise.all([getCategories(), getMechanics()]);
    const state: FilterState = {
      q: '',
      category: categoryFromParam(searchParams.category, categories),
      inStock: searchParams.inStock === 'true',
      sort: (searchParams.sort as FilterState['sort']) || undefined,
      max: searchParams.max ? Math.max(0, parseInt(searchParams.max, 10)) || undefined : undefined,
      players: searchParams.players ? Math.max(1, parseInt(searchParams.players, 10)) || undefined : undefined,
      mechanics: toMechanicsArray(searchParams.mechanics),
      complexity: searchParams.complexity || undefined,
      publisher: searchParams.publisher || undefined,
      yearPublished: searchParams.year ? Math.max(1, parseInt(searchParams.year, 10)) || undefined : undefined,
      minAge: searchParams.age ? Math.max(1, parseInt(searchParams.age, 10)) || undefined : undefined,
      playTimeMinutes: searchParams.duration ? Math.max(1, parseInt(searchParams.duration, 10)) || undefined : undefined,
    };
    const filtered = Boolean(
      state.category || state.inStock || state.sort || state.max || state.players
      || state.complexity || state.publisher || state.yearPublished || state.minAge
      || state.playTimeMinutes || state.mechanics.length > 0,
    );
    const { results, total } = await listProducts({
      locale,
      category: state.category,
      inStock: state.inStock,
      sortBy: state.sort,
      maxPriceMinor: state.max != null ? state.max * 100 : undefined,
      minPlayers: state.players,
      mechanics: state.mechanics,
      complexity: state.complexity,
      publisher: state.publisher,
      yearPublished: state.yearPublished,
      minAge: state.minAge,
      playTimeMinutes: state.playTimeMinutes,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: base },
    ];
    return (
      <main className="container-wide">
        <Breadcrumbs crumbs={crumbs} />
        {page === 1 && !filtered && (
          <JsonLd
            data={[
              breadcrumbLd(crumbs),
              itemListLd(results.map((p) => ({ name: p.name, path: `${base}/${p.slug}` }))),
            ]}
          />
        )}
        <h1 className="page-title">{locale === 'es' ? 'Juegos de mesa' : 'Board games'}</h1>
        <form method="get" action={base}>
          <FilterSheet labels={filterSheetLabels(locale, total)} activeCount={filterActiveCount(state)}>
          {/* No search field on a listing page, so the trigger has no lens to sit
              beside — it gets its own row above the grid. */}
          <div className="listing-filter-bar"><FilterSheetTrigger /></div>
          <div className="search-layout">
            <FilterSheetPanel>
              <SearchFilters
                locale={locale}
                categories={categories}
                mechanics={mechanics}
                state={state}
                total={total}
                clearHref={base}
              />
            </FilterSheetPanel>
            <div className="search-results">
              <p className="muted" style={{ marginBottom: '1rem' }}>
                {total} {locale === 'es' ? 'juegos en el catálogo' : 'games in the catalogue'}
              </p>
              {results.length > 0 ? (
                <div className="catalog-grid">
                  {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
                </div>
              ) : (
                <CatalogEmpty locale={locale} clearHref={base} />
              )}
              <Pager base={base} page={page} total={total} locale={locale} pageSize={PAGE_SIZE} query={filterQuery(searchParams)} />
            </div>
          </div>
          </FilterSheet>
        </form>
      </main>
    );
  }

  // ── Category index (curated BGG-aligned themes) ────────────────────────────
  if (kind === 'categories') {
    const catBase = listingPath('categories', locale);
    const cards = await listShelves();
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: catBase },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(cards.map((s) => ({ name: s.theme.label[locale], path: entityPath('categories', locale, s.theme.slug[locale]) }))),
          ]}
        />
        <h1 className="page-title">{locale === 'es' ? 'Categorías de juegos de mesa' : 'Board game categories'}</h1>
        <p className="lede">
          {locale === 'es'
            ? 'Explora el catálogo por tema —estrategia, eurogames, cooperativos, 2 jugadores, cartas, terror y más— siguiendo la clasificación de BoardGameGeek, y compara precios y stock real entre tiendas verificadas.'
            : 'Browse the catalogue by theme —strategy, eurogames, cooperative, 2-player, card games, horror and more— following BoardGameGeek’s taxonomy, and compare real prices and stock across verified stores.'}
        </p>
        {rotateTones(getPromos('categories')).map(({ item, tone }) => (
          <PromoBanner key={item.id} promo={item} locale={locale} tone={tone} />
        ))}
        {cards.length > 0 ? (
          <div className="category-grid">
            {cards.map((shelf) => (
              <ShelfCard key={shelf.theme.key} shelf={shelf} locale={locale} />
            ))}
          </div>
        ) : (
          <CatalogEmpty locale={locale} clearHref={listingPath('games', locale)} />
        )}
        <PromoStrip locale={locale} />
      </main>
    );
  }

  // ── Guides index (editorial hub: searchable, paginated, magazine cards) ─────
  if (kind === 'guides') {
    const guides = listGuides(locale);
    const dateFmt = (iso: string) =>
      new Date(iso).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    // Resolve a cover image per guide (cheap, ISR-cached) alongside byline/date.
    const cards: GuideCardData[] = await Promise.all(
      guides.map(async (g) => {
        const author = g.authorId ? AUTHORS_BY_ID[g.authorId] : undefined;
        return {
          slug: g.slug,
          href: entityPath('guides', locale, g.slug),
          shareUrl: absoluteUrl(entityPath('guides', locale, g.slug)),
          title: g.title,
          excerpt: g.description,
          author: author ? { name: author.name, from: author.from } : undefined,
          dateISO: g.updatedAt,
          dateLabel: dateFmt(g.updatedAt),
          cover: await guideCover(g, locale),
          kicker: guideKicker(g.title, locale),
          autoTranslated: g.autoTranslated,
        };
      }),
    );
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Guías' : 'Guides', path: listingPath('guides', locale) },
    ];
    const hubName = locale === 'es' ? 'Guías de juegos de mesa' : 'Board game guides';
    const hubDesc = locale === 'es'
      ? 'Comparativas, análisis y listas de los mejores juegos de mesa, escritas por nuestro equipo editorial y con precios comparados entre tiendas.'
      : 'Comparisons, reviews and best-of lists for board games, written by our editorial team and with prices compared across stores.';
    return (
      <main className="container">
        <LocaleAlternates alternates={{ es: listingPath('guides', 'es'), en: listingPath('guides', 'en') }} />
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(guides.map((g) => ({ name: g.title, path: entityPath('guides', locale, g.slug) }))),
            blogLd({
              name: hubName,
              description: hubDesc,
              path: listingPath('guides', locale),
              posts: guides.map((g) => ({
                title: g.title,
                path: entityPath('guides', locale, g.slug),
                datePublished: g.publishedAt,
                dateModified: g.updatedAt,
                author: g.authorId ? AUTHORS_BY_ID[g.authorId]?.name : undefined,
                description: g.description,
              })),
            }),
          ]}
        />
        <h1 className="page-title">{hubName}</h1>
        <p className="lede">{hubDesc}</p>
        <GuidesExplorer guides={cards} locale={locale} />
      </main>
    );
  }

  notFound();
}

function isNaturalLanguageQuery(query: string): boolean {
  return query.trim().length >= 18 && query.trim().split(/\s+/).length >= 4;
}
