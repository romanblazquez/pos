import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { ProductCard } from '@/components/ProductCard';
import { homePath, isLocale, listingPath, slugify, type Locale } from '@/lib/segments';

export const revalidate = 1800;

const T = {
  es: {
    title: 'Juegospedia — Compara precios de juegos de mesa',
    desc: 'Compara precios, stock y envíos de juegos de mesa entre tiendas verificadas de México.',
    eyebrow: 'Precios comparados · tiendas verificadas',
    h1: 'La enciclopedia de juegos de mesa, con el mejor precio.',
    lead: 'Encuentra cualquier juego y compara las ofertas de todas las tiendas en un solo lugar.',
    cats: 'Explora por categoría',
    featured: 'Disponibles ahora',
    all: 'Ver todo el catálogo',
  },
  en: {
    title: 'Juegospedia — Board game price comparison',
    desc: 'Compare prices, stock and shipping for board games across verified stores.',
    eyebrow: 'Prices compared · verified stores',
    h1: 'The board-game encyclopedia, at the best price.',
    lead: 'Find any game and compare offers from every store in one place.',
    cats: 'Browse by category',
    featured: 'Available now',
    all: 'See the full catalogue',
  },
} satisfies Record<Locale, Record<string, string>>;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const t = T[locale];
  return buildMetadata({
    locale,
    path: homePath(locale),
    title: t.title,
    description: t.desc,
    alternates: { es: homePath('es'), en: homePath('en') },
  });
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const t = T[locale];

  const [{ results: featured }, categories] = await Promise.all([
    listProducts({ inStock: true, limit: 18 }),
    getCategories(),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.h1}</h1>
          <p>{t.lead}</p>
        </div>
      </section>

      <main className="container">
        {categories.length > 0 && (
          <>
            <h2 className="section-title">{t.cats}</h2>
            <div className="taglist">
              {categories.map((c) => (
                <Link
                  key={c.category}
                  className="chip"
                  href={`${listingPath('categories', locale)}/${slugify(c.category)}`}
                >
                  {c.category} <span className="count">{c.count}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {featured.length > 0 && (
          <>
            <h2 className="section-title">{t.featured}</h2>
            <div className="grid">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} locale={locale} />
              ))}
            </div>
            <p style={{ marginTop: '1.5rem' }}>
              <Link className="chip" href={listingPath('games', locale)}>
                {t.all} →
              </Link>
            </p>
          </>
        )}
      </main>
    </>
  );
}
