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

// Listing roots handled in this slice: the games catalog (/es/juegos-de-mesa)
// and the category index (/es/categorias). Publisher/mechanic/store roots reuse
// this same pattern in the next iteration.
export async function generateMetadata({
  params,
}: {
  params: { locale: string; type: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
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

export default async function ListingPage({
  params,
}: {
  params: { locale: string; type: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  if (kind === null) notFound();

  const homeName = locale === 'es' ? 'Inicio' : 'Home';

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
              results.map((p) => ({
                name: p.name,
                path: `${listingPath('games', locale)}/${p.slug}`,
              })),
            ),
          ]}
        />
        <main className="container">
          <h1>{locale === 'es' ? 'Juegos de mesa' : 'Board games'}</h1>
          <div className="grid">
            {results.map((p) => (
              <Link key={p.id} className="card" href={`${listingPath('games', locale)}/${p.slug}`}>
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} width={220} height={220} loading="lazy" />
                )}
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>{p.name}</div>
              </Link>
            ))}
          </div>
        </main>
      </>
    );
  }

  // kind === 'categories' -> index of real categories (no empty/fabricated ones)
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
            <Link
              key={c.category}
              href={`${listingPath('categories', locale)}/${slugify(c.category)}`}
            >
              {c.category} ({c.count})
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
