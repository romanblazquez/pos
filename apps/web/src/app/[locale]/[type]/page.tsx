import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbLd, itemListLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  homePath,
  isLocale,
  listingPath,
  resolveKind,
  slugify,
  type Locale,
} from '@/lib/segments';

export const revalidate = 1800;

// Listing roots: games catalog (/es/juegos-de-mesa), category index
// (/es/categorias), and search (/es/buscar?q=). Search is noindex (spec §9);
// publisher/mechanic/store landing pages need new API filters and are built in
// a later phase — their roots 404 (not soft-404) until then.
export async function generateMetadata({
  params,
}: {
  params: { locale: string; type: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);

  if (kind === 'search') {
    return buildMetadata({
      locale,
      path: listingPath('search', locale),
      title: locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games',
      description:
        locale === 'es'
          ? 'Busca juegos de mesa y compara precios entre tiendas.'
          : 'Search board games and compare prices across stores.',
      noindex: true, // search results are never indexed
    });
  }

  if (kind !== 'games' && kind !== 'categories') return {};

  const path = listingPath(kind, locale);
  const isGames = kind === 'games';
  const title = isGames
    ? locale === 'es' ? 'Juegos de mesa' : 'Board games'
    : locale === 'es' ? 'Categorías de juegos de mesa' : 'Board game categories';
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
    alternates: { es: listingPath(kind, 'es'), en: listingPath(kind, 'en') },
  });
}

function ProductGrid({ locale, products }: { locale: Locale; products: { id: string; slug: string; name: string; images: string[] }[] }) {
  return (
    <div className="grid">
      {products.map((p) => (
        <Link key={p.id} className="card" href={`${listingPath('games', locale)}/${p.slug}`}>
          {p.images?.[0] && (
            <img src={p.images[0]} alt={p.name} width={220} height={220} loading="lazy" />
          )}
          <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>{p.name}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: { locale: string; type: string };
  searchParams: { q?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  const homeName = locale === 'es' ? 'Inicio' : 'Home';

  // ── Search ───────────────────────────────────────────────────────────────
  if (kind === 'search') {
    const q = (searchParams.q ?? '').trim();
    const { results, total } = q ? await listProducts({ q, limit: 48 }) : { results: [], total: 0 };
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Buscar' : 'Search', path: listingPath('search', locale) },
    ];
    return (
      <>
        <Breadcrumbs crumbs={crumbs} />
        <main className="container">
          <h1>
            {q
              ? locale === 'es' ? `Resultados para "${q}"` : `Results for "${q}"`
              : locale === 'es' ? 'Buscar juegos de mesa' : 'Search board games'}
          </h1>
          <form method="get" action={listingPath('search', locale)} style={{ margin: '1rem 0' }}>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={locale === 'es' ? 'Catan, estrategia…' : 'Catan, strategy…'}
              style={{ padding: '0.55rem 0.8rem', minWidth: 280, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--tx)' }}
            />
          </form>
          {q && (
            <p className="muted">
              {total} {locale === 'es' ? 'resultados' : 'results'}
            </p>
          )}
          <ProductGrid locale={locale} products={results} />
        </main>
      </>
    );
  }

  // ── Games catalog ─────────────────────────────────────────────────────────
  if (kind === 'games') {
    const { results } = await listProducts({ limit: 48 });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: listingPath('games', locale) },
    ];
    return (
      <>
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(
              results.map((p) => ({ name: p.name, path: `${listingPath('games', locale)}/${p.slug}` })),
            ),
          ]}
        />
        <main className="container">
          <h1>{locale === 'es' ? 'Juegos de mesa' : 'Board games'}</h1>
          <ProductGrid locale={locale} products={results} />
        </main>
      </>
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
      <>
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd data={breadcrumbLd(crumbs)} />
        <main className="container">
          <h1>{locale === 'es' ? 'Categorías de juegos de mesa' : 'Board game categories'}</h1>
          <div className="taglist">
            {categories.map((c) => (
              <Link key={c.category} href={`${listingPath('categories', locale)}/${slugify(c.category)}`}>
                {c.category} ({c.count})
              </Link>
            ))}
          </div>
        </main>
      </>
    );
  }

  // publisher / mechanic / store roots not built yet -> real 404
  notFound();
}
