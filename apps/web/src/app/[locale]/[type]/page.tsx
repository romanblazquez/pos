import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getMechanics, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbLd, itemListLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProductCard } from '@/components/ProductCard';
import { CatalogEmpty } from '@/components/CatalogEmpty';
import { CatalogSearchField } from '@/components/CatalogSearchField';
import { Pager } from '@/components/Pager';
import { SearchFilters, categoryFromParam, type FilterState } from '@/components/SearchFilters';
import {
  homePath,
  isLocale,
  listingPath,
  resolveKind,
  slugify,
  type Locale,
} from '@/lib/segments';

export const revalidate = 1800;

const PAGE_SIZE = 24;

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

  if (kind !== 'games' && kind !== 'categories') return {};

  // Faceted/filtered or deeper-page URLs are navigational — keep them out of the
  // index so only the clean base listing competes (spec §9).
  const filtered = Boolean(
    searchParams.category || searchParams.inStock || searchParams.sort || searchParams.max || searchParams.players
    || searchParams.complexity || toMechanicsArray(searchParams.mechanics).length > 0,
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
      ? 'Explora juegos de mesa por categoría.'
      : 'Browse board games by category.';

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
  for (const k of ['q', 'category', 'inStock', 'sort', 'max', 'players', 'complexity'] as const) {
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
    };
    const { results, total } = await listProducts({
      q,
      category: state.category,
      inStock: state.inStock,
      sortBy: state.sort,
      maxPriceMinor: state.max != null ? state.max * 100 : undefined,
      minPlayers: state.players,
      mechanics: state.mechanics,
      complexity: state.complexity,
      limit: 48,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Buscar' : 'Search', path: listingPath('search', locale) },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="page-title">
          {q
            ? locale === 'es' ? `Resultados para “${q}”` : `Results for “${q}”`
            : locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games'}
        </h1>
        <form method="get" action={listingPath('search', locale)}>
          <CatalogSearchField
            locale={locale}
            initialValue={q}
            searchPath={listingPath('search', locale)}
            productBase={listingPath('games', locale)}
            placeholder={locale === 'es' ? 'Catan, estrategia, 2 jugadores…' : 'Catan, strategy, 2 players…'}
            className="search-command"
          />
          <div className="search-layout">
            <SearchFilters
              locale={locale}
              categories={categories}
              mechanics={mechanics}
              state={state}
              total={total}
              clearHref={q ? `${listingPath('search', locale)}?q=${encodeURIComponent(q)}` : listingPath('search', locale)}
            />
            <div>
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
    };
    const filtered = Boolean(
      state.category || state.inStock || state.sort || state.max || state.players
      || state.complexity || state.mechanics.length > 0,
    );
    const { results, total } = await listProducts({
      category: state.category,
      inStock: state.inStock,
      sortBy: state.sort,
      maxPriceMinor: state.max != null ? state.max * 100 : undefined,
      minPlayers: state.players,
      mechanics: state.mechanics,
      complexity: state.complexity,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
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
          <div className="search-layout">
            <SearchFilters
              locale={locale}
              categories={categories}
              mechanics={mechanics}
              state={state}
              total={total}
              clearHref={base}
            />
            <div>
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
        </form>
      </main>
    );
  }

  // ── Category index ────────────────────────────────────────────────────────
  if (kind === 'categories') {
    const categories = await getCategories();
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: listingPath('categories', locale) },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd data={breadcrumbLd(crumbs)} />
        <h1 className="page-title">{locale === 'es' ? 'Categorías de juegos de mesa' : 'Board game categories'}</h1>
        <div className="taglist" style={{ marginTop: '1.25rem' }}>
          {categories.map((c) => (
            <Link key={c.category} className="chip" href={`${listingPath('categories', locale)}/${slugify(c.category)}`}>
              {c.category} <span className="count">{c.count}</span>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  notFound();
}
