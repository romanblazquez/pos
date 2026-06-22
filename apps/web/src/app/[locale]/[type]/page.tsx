import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbLd, itemListLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProductCard } from '@/components/ProductCard';
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: string; type: string };
  searchParams: { page?: string };
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
    // Deeper pages are navigational, not landing pages — keep them out of the index.
    noindex: page > 1,
    alternates:
      page > 1 ? undefined : { es: listingPath(kind, 'es'), en: listingPath(kind, 'en') },
  });
}

function Pager({ base, page, total, locale }: { base: string; page: number; total: number; locale: Locale }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base : `${base}?page=${p}`);
  // Window of page numbers around the current page.
  const nums = new Set<number>([1, pages, page, page - 1, page + 1]);
  const list = [...nums].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label={locale === 'es' ? 'Paginación' : 'Pagination'}>
      {page > 1 && <Link href={href(page - 1)} rel="prev">‹</Link>}
      {list.map((p, i) => {
        const gap = i > 0 && p - list[i - 1] > 1;
        return (
          <span key={p} style={{ display: 'contents' }}>
            {gap && <span className="gap">…</span>}
            {p === page ? (
              <span className="current" aria-current="page">{p}</span>
            ) : (
              <Link href={href(p)}>{p}</Link>
            )}
          </span>
        );
      })}
      {page < pages && <Link href={href(page + 1)} rel="next">›</Link>}
    </nav>
  );
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: { locale: string; type: string };
  searchParams: { q?: string; page?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  const homeName = locale === 'es' ? 'Inicio' : 'Home';
  const page = pageOf(searchParams);

  // ── Search ───────────────────────────────────────────────────────────────
  if (kind === 'search') {
    const q = (searchParams.q ?? '').trim();
    const { results, total } = q ? await listProducts({ q, limit: 48 }) : { results: [], total: 0 };
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
        <form className="search-form" method="get" action={listingPath('search', locale)}>
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={locale === 'es' ? 'Catan, estrategia, 2 jugadores…' : 'Catan, strategy, 2 players…'}
            aria-label={locale === 'es' ? 'Buscar' : 'Search'}
          />
        </form>
        {q && <p className="muted">{total} {locale === 'es' ? 'resultados' : 'results'}</p>}
        <div className="grid" style={{ marginTop: '1rem' }}>
          {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
        </div>
      </main>
    );
  }

  // ── Games catalog (paginated over the full catalogue) ──────────────────────
  if (kind === 'games') {
    const { results, total } = await listProducts({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    const base = listingPath('games', locale);
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: base },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        {page === 1 && (
          <JsonLd
            data={[
              breadcrumbLd(crumbs),
              itemListLd(results.map((p) => ({ name: p.name, path: `${base}/${p.slug}` }))),
            ]}
          />
        )}
        <h1 className="page-title">{locale === 'es' ? 'Juegos de mesa' : 'Board games'}</h1>
        <p className="muted">
          {total} {locale === 'es' ? 'juegos en el catálogo' : 'games in the catalogue'}
        </p>
        <div className="grid" style={{ marginTop: '1.25rem' }}>
          {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
        </div>
        <Pager base={base} page={page} total={total} locale={locale} />
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
