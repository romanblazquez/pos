import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import {
  homePath,
  isLocale,
  listingPath,
  slugify,
  type Locale,
} from '@/lib/segments';

export const revalidate = 1800; // REVALIDATE.home (literal: Next requires a static value)

const T = {
  es: {
    title: 'Juegospedia — Compara precios de juegos de mesa',
    desc: 'Compara precios, stock y envíos de juegos de mesa entre tiendas verificadas de México.',
    h1: 'Compara precios de juegos de mesa',
    cats: 'Categorías',
    featured: 'Juegos destacados',
  },
  en: {
    title: 'Juegospedia — Board game price comparison',
    desc: 'Compare prices, stock and shipping for board games across verified stores.',
    h1: 'Board game price comparison',
    cats: 'Categories',
    featured: 'Featured games',
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
    listProducts({ inStock: true, limit: 12 }),
    getCategories(),
  ]);

  return (
    <main className="container">
      <h1>{t.h1}</h1>
      <p className="muted">{t.desc}</p>

      {categories.length > 0 && (
        <section className="related">
          <h2>{t.cats}</h2>
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
        </section>
      )}

      {featured.length > 0 && (
        <section className="related">
          <h2>{t.featured}</h2>
          <div className="grid">
            {featured.map((p) => (
              <Link
                key={p.id}
                className="card"
                href={`${listingPath('games', locale)}/${p.slug}`}
              >
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} width={220} height={220} loading="lazy" />
                )}
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>{p.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
