import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalogFacets, getCategories, getMechanics, listProducts } from '@/lib/api';
import { buildMetadata, socialImageUrl } from '@/lib/seo';
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
  SEGMENTS,
  entityPath,
  homePath,
  isLocale,
  listingPath,
  resolveKind,
  slugify,
  type Locale,
  parseLocalePrefix,
} from '@/lib/segments';
import { listEditorialAuthors, listGuides, editorPath, GUIDE_OG_DEFAULT } from '@/lib/guides';
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

function guideToken(title: string): string {
  const value = title.toLowerCase();
  if (/estrateg|strategy/.test(value)) return '♟';
  if (/famil/.test(value)) return '★';
  if (/principiante|beginner/.test(value)) return '◆';
  if (/2 jugador|2 player|dos jugador/.test(value)) return '♟♟';
  if (/solitario|\bsolo\b/.test(value)) return '♙';
  if (/cooperativ|cooperative|co-op/.test(value)) return '✦';
  if (/miniatura|miniature/.test(value)) return '♜';
  if (/abstract/.test(value)) return '⬢';
  return '⬡';
}

function guideTokenTone(title: string): 'clay' | 'forest' | 'ochre' | 'ink' | 'parchment' {
  const value = title.toLowerCase();
  if (/cooperativ|cooperative|co-op|famil/.test(value)) return 'forest';
  if (/estrateg|strategy|abstract/.test(value)) return 'ink';
  if (/principiante|beginner|2 jugador|2 player|dos jugador/.test(value)) return 'ochre';
  if (/solitario|\bsolo\b/.test(value)) return 'parchment';
  return 'clay';
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
    currency?: string;
  };
}): Promise<Metadata> {
  const parsedLocale = parseLocalePrefix(params.locale);
  if (!parsedLocale) return {};
  const { locale, market } = parsedLocale;
  const kind = resolveKind(locale, params.type);
  const page = pageOf(searchParams);

  if (kind === 'search') {
    return buildMetadata({
      locale,
      market,
      path: listingPath('search', locale, market),
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
      market,
      path: listingPath('guides', locale, market),
      title: locale === 'es' ? 'Guías de juegos de mesa' : 'Board game guides',
      description:
        locale === 'es'
          ? 'Guías, comparativas y listas de los mejores juegos de mesa, con precios comparados entre tiendas.'
          : 'Guides, comparisons and best-of lists for board games, with prices compared across stores.',
      // The hub shares under its own segment slug, so /es-mx/guias previews as a
      // branded card carrying the guide count rather than the bare banner file.
      images: [socialImageUrl('guide', SEGMENTS.guides[locale], locale)],
      alternates: { es: listingPath('guides', 'es', market), en: listingPath('guides', 'en', market) },
    });
  }

  if (kind === 'editors') {
    return buildMetadata({
      locale,
      market,
      path: listingPath('editors', locale, market),
      title: locale === 'es' ? 'Equipo editorial' : 'Editorial team',
      description:
        locale === 'es'
          ? 'Quién escribe las guías de Juegospedia: su especialidad, su criterio de evaluación y las guías que firman.'
          : 'Who writes the Juegospedia guides: their beat, the criteria they review against and the guides they sign.',
      alternates: { es: listingPath('editors', 'es', market), en: listingPath('editors', 'en', market) },
    });
  }

  if (kind === 'publishers') {
    return buildMetadata({
      locale,
      market,
      path: listingPath('publishers', locale, market),
      title: locale === 'es' ? 'Editoriales de juegos de mesa' : 'Board game publishers',
      description:
        locale === 'es'
          ? 'Explora el catálogo por editorial y compara precios y stock real entre tiendas verificadas.'
          : 'Browse the catalogue by publisher and compare real prices and stock across verified stores.',
      alternates: { es: listingPath('publishers', 'es', market), en: listingPath('publishers', 'en', market) },
    });
  }

  if (kind === 'mechanics') {
    return buildMetadata({
      locale,
      market,
      path: listingPath('mechanics', locale, market),
      title: locale === 'es' ? 'Mecánicas de juegos de mesa' : 'Board game mechanics',
      description:
        locale === 'es'
          ? 'Explora el catálogo por mecánica de juego y compara precios y stock real entre tiendas verificadas.'
          : 'Browse the catalogue by game mechanic and compare real prices and stock across verified stores.',
      alternates: { es: listingPath('mechanics', 'es', market), en: listingPath('mechanics', 'en', market) },
    });
  }

  if (kind !== 'games' && kind !== 'categories') return {};

  // Faceted/filtered or deeper-page URLs are navigational — keep them out of the
  // index so only the clean base listing competes (spec §9).
  const filtered = Boolean(
    searchParams.category || searchParams.inStock || searchParams.sort || searchParams.max || searchParams.players
    || searchParams.complexity || searchParams.publisher || searchParams.year
    || searchParams.age || searchParams.duration || searchParams.currency
    || toMechanicsArray(searchParams.mechanics).length > 0,
  );
  const navigational = page > 1 || filtered;

  const path = page > 1 ? `${listingPath(kind, locale, market)}?page=${page}` : listingPath(kind, locale, market);
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
    market,
    path,
    title,
    description,
    noindex: navigational,
    alternates: navigational
      ? undefined
      : { es: listingPath(kind, 'es', market), en: listingPath(kind, 'en', market) },
  });
}

// Serialize active filters (everything except page) so pagination preserves them.
function filterQuery(sp: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const k of ['q', 'category', 'inStock', 'sort', 'max', 'players', 'complexity', 'publisher', 'year', 'age', 'duration', 'currency'] as const) {
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
    currency?: string;
  };
}) {
  const parsedLocale = parseLocalePrefix(params.locale);
  if (!parsedLocale) notFound();
  const { locale, market } = parsedLocale;
  const kind = resolveKind(locale, params.type);
  const homeName = locale === 'es' ? 'Inicio' : 'Home';
  const page = pageOf(searchParams);

  // ── Search (faceted) ───────────────────────────────────────────────────────
  if (kind === 'search') {
    const q = (searchParams.q ?? '').trim();
    const [categories, mechanics, facets] = await Promise.all([getCategories(), getMechanics(), getCatalogFacets()]);
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
    // Semantic retrieval returns a single relevance-ranked set and ignores offset,
    // so it stays one page; keyword and filtered search paginate like the catalogue.
    const semantic = isNaturalLanguageQuery(q) && !(
      state.category || state.inStock || state.sort || state.max || state.players
      || state.complexity || state.publisher || state.yearPublished || state.minAge
      || state.playTimeMinutes || state.mechanics.length > 0
    );
    const { results, total } = await listProducts({
      q,
      semantic,
      locale,
      market,
      currencies: searchParams.currency ? [searchParams.currency] : undefined,
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
      limit: semantic ? 48 : PAGE_SIZE,
      offset: semantic ? 0 : (page - 1) * PAGE_SIZE,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Buscar' : 'Search', path: listingPath('search', locale, market) },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="page-title">
          {q
            ? locale === 'es' ? `Resultados para “${q}”` : `Results for “${q}”`
            : locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games'}
        </h1>
        <form method="get" action={listingPath('search', locale, market)}>
          <FilterSheet labels={filterSheetLabels(locale, total)} activeCount={filterActiveCount(state)}>
          <CatalogSearchField
            locale={locale}
            initialValue={q}
            searchPath={listingPath('search', locale, market)}
            productBase={listingPath('games', locale, market)}
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
                facets={facets}
                state={state}
                total={total}
                clearHref={q ? `${listingPath('search', locale, market)}?q=${encodeURIComponent(q)}` : listingPath('search', locale, market)}
              />
            </FilterSheetPanel>
            <div className="search-results">
              <p className="muted" style={{ marginBottom: '1rem' }}>
                {total} {locale === 'es' ? 'resultados' : 'results'}
              </p>
              {results.length > 0 ? (
                <div className="catalog-grid">
                  {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} market={market} />)}
                </div>
              ) : (
                <CatalogEmpty locale={locale} clearHref={listingPath('search', locale, market)} />
              )}
              {!semantic && (
                <Pager
                  base={listingPath('search', locale, market)}
                  page={page}
                  total={total}
                  locale={locale}
                  pageSize={PAGE_SIZE}
                  query={filterQuery(searchParams)}
                />
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
    const base = listingPath('games', locale, market);
    const [categories, mechanics, facets] = await Promise.all([getCategories(), getMechanics(), getCatalogFacets()]);
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
      market,
      currencies: searchParams.currency ? [searchParams.currency] : undefined,
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
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: base },
    ];
    return (
      <main className="container">
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
                facets={facets}
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
                  {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} market={market} />)}
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
    const catBase = listingPath('categories', locale, market);
    const cards = await listShelves();
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: catBase },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(cards.map((s) => ({ name: s.theme.label[locale], path: entityPath('categories', locale, s.theme.slug[locale], market) }))),
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
              <ShelfCard key={shelf.theme.key} shelf={shelf} locale={locale} market={market} />
            ))}
          </div>
        ) : (
          <CatalogEmpty locale={locale} clearHref={listingPath('games', locale, market)} />
        )}
        <PromoStrip locale={locale} />
      </main>
    );
  }

  // ── Publisher index ──────────────────────────────────────────────────────
  if (kind === 'publishers') {
    const pubBase = listingPath('publishers', locale, market);
    const publishers = [...(await getCatalogFacets()).publishers].sort((a, b) => b.count - a.count);
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Editoriales' : 'Publishers', path: pubBase },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(publishers.map((p) => ({ name: p.value, path: entityPath('publishers', locale, slugify(p.value), market) }))),
          ]}
        />
        <h1 className="page-title">{locale === 'es' ? 'Editoriales de juegos de mesa' : 'Board game publishers'}</h1>
        <p className="lede">
          {locale === 'es'
            ? 'Explora el catálogo por editorial y compara precios y stock real entre tiendas verificadas.'
            : 'Browse the catalogue by publisher and compare real prices and stock across verified stores.'}
        </p>
        {publishers.length > 0 ? (
          <div className="taglist">
            {publishers.map((p) => (
              <Link key={p.value} className="chip" href={entityPath('publishers', locale, slugify(p.value), market)}>
                {p.value} <span className="muted">({p.count})</span>
              </Link>
            ))}
          </div>
        ) : (
          <CatalogEmpty locale={locale} clearHref={listingPath('games', locale, market)} />
        )}
      </main>
    );
  }

  // ── Mechanic index ───────────────────────────────────────────────────────
  if (kind === 'mechanics') {
    const mechBase = listingPath('mechanics', locale, market);
    const mechanics = [...(await getMechanics())].sort((a, b) => b.count - a.count);
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Mecánicas' : 'Mechanics', path: mechBase },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(mechanics.map((m) => ({ name: m.mechanic, path: entityPath('mechanics', locale, slugify(m.mechanic), market) }))),
          ]}
        />
        <h1 className="page-title">{locale === 'es' ? 'Mecánicas de juegos de mesa' : 'Board game mechanics'}</h1>
        <p className="lede">
          {locale === 'es'
            ? 'Explora el catálogo por mecánica de juego y compara precios y stock real entre tiendas verificadas.'
            : 'Browse the catalogue by game mechanic and compare real prices and stock across verified stores.'}
        </p>
        {mechanics.length > 0 ? (
          <div className="taglist">
            {mechanics.map((m) => (
              <Link key={m.mechanic} className="chip" href={entityPath('mechanics', locale, slugify(m.mechanic), market)}>
                {m.mechanic} <span className="muted">({m.count})</span>
              </Link>
            ))}
          </div>
        ) : (
          <CatalogEmpty locale={locale} clearHref={listingPath('games', locale, market)} />
        )}
      </main>
    );
  }

  // ── Guides index (editorial hub: searchable, paginated, magazine cards) ─────
  if (kind === 'guides') {
    const guides = await listGuides(locale);
    const dateFmt = (iso: string) =>
      new Date(iso).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    // Prefer the supplied editorial banner everywhere the guide is represented;
    // retain the live-product cover only as a defensive fallback.
    const cards: GuideCardData[] = await Promise.all(
      guides.map(async (g) => {
        const author = g.author ?? (g.authorId ? AUTHORS_BY_ID[g.authorId] : undefined);
        return {
          slug: g.slug,
          href: entityPath('guides', locale, g.slug, market),
          shareUrl: absoluteUrl(entityPath('guides', locale, g.slug, market)),
          title: g.title,
          excerpt: g.description,
          author: author ? { name: author.name, from: author.from } : undefined,
          dateISO: g.updatedAt,
          dateLabel: dateFmt(g.updatedAt),
          cover: g.ogImage ?? (await guideCover(g, locale)),
          kicker: guideKicker(g.title, locale),
          token: guideToken(g.title),
          tokenTone: guideTokenTone(g.title),
          autoTranslated: g.autoTranslated,
        };
      }),
    );
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Guías' : 'Guides', path: listingPath('guides', locale, market) },
    ];
    const hubName = locale === 'es' ? 'Guías de juegos de mesa' : 'Board game guides';
    const hubDesc = locale === 'es'
      ? 'Comparativas, análisis y listas de los mejores juegos de mesa, escritas por nuestro equipo editorial y con precios comparados entre tiendas.'
      : 'Comparisons, reviews and best-of lists for board games, written by our editorial team and with prices compared across stores.';
    return (
      <main className="container">
        <LocaleAlternates alternates={{ es: listingPath('guides', 'es', market), en: listingPath('guides', 'en', market) }} />
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(guides.map((g) => ({ name: g.title, path: entityPath('guides', locale, g.slug, market) }))),
            blogLd({
              name: hubName,
              description: hubDesc,
              path: listingPath('guides', locale, market),
              posts: guides.map((g) => ({
                title: g.title,
                path: entityPath('guides', locale, g.slug, market),
                datePublished: g.publishedAt,
                dateModified: g.updatedAt,
                author: g.author?.name ?? (g.authorId ? AUTHORS_BY_ID[g.authorId]?.name : undefined),
                description: g.description,
              })),
            }),
          ]}
        />
        <h1 className="page-title">{hubName}</h1>
        <p className="lede">
          {hubDesc}{' '}
          <Link href={listingPath('editors', locale, market)}>
            {locale === 'es' ? 'Conoce al equipo editorial' : 'Meet the editorial team'}
          </Link>.
        </p>
        <figure className="guides-hub-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GUIDE_OG_DEFAULT} alt={hubName} width={1600} height={900} />
        </figure>
        <GuidesExplorer guides={cards} locale={locale} />
      </main>
    );
  }

  // ── Editorial team index (the masthead behind every byline) ────────────────
  if (kind === 'editors') {
    const [editors, guides] = await Promise.all([listEditorialAuthors(), listGuides(locale)]);
    const guideCount = (authorId: string) =>
      guides.filter((guide) => guide.authorId === authorId).length;
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale, market) },
      { name: locale === 'es' ? 'Equipo editorial' : 'Editorial team', path: listingPath('editors', locale, market) },
    ];
    const title = locale === 'es' ? 'Equipo editorial' : 'Editorial team';
    const lede = locale === 'es'
      ? 'Cada guía la firma una persona con una especialidad y un criterio de evaluación fijo. Aquí está quién escribe qué, y con qué reglas juzga un juego.'
      : 'Every guide is signed by someone with a beat and a fixed set of review criteria. Here is who writes what, and the rules they judge a game by.';
    return (
      <main className="container">
        <LocaleAlternates alternates={{ es: listingPath('editors', 'es', market), en: listingPath('editors', 'en', market) }} />
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(editors.map((editor) => ({
              name: editor.name,
              path: editorPath(editor, locale),
            }))),
          ]}
        />
        <h1 className="page-title">{title}</h1>
        <p className="lede">{lede}</p>
        <div className="editorial-team-grid">
          {editors.map((editor) => {
            const count = guideCount(editor.id);
            return (
              <article key={editor.id} className="editor-profile-card">
                <div className="editor-profile-heading">
                  <span className="editor-profile-avatar" aria-hidden="true">
                    {editor.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                  </span>
                  <div>
                    <h2><Link href={editorPath(editor, locale)}>{editor.name}</Link></h2>
                    <p>{editor.from}</p>
                  </div>
                </div>
                <strong>{editor.role}</strong>
                <p>{editor.bio}</p>
                <div className="editor-profile-tags">
                  {editor.expertise.map((item) => <span className="chip" key={item}>{item}</span>)}
                </div>
                <p className="editor-profile-method">
                  <b>{locale === 'es' ? 'Evalúa:' : 'Reviews for:'}</b>{' '}
                  {editor.reviewPrinciples.join(' · ')}
                </p>
                {count > 0 && (
                  <p className="editor-profile-count">
                    <Link href={editorPath(editor, locale)}>
                      {locale === 'es'
                        ? `${count} ${count === 1 ? 'guía firmada' : 'guías firmadas'} →`
                        : `${count} ${count === 1 ? 'signed guide' : 'signed guides'} →`}
                    </Link>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </main>
    );
  }

  notFound();
}

function isNaturalLanguageQuery(query: string): boolean {
  return query.trim().length >= 18 && query.trim().split(/\s+/).length >= 4;
}
