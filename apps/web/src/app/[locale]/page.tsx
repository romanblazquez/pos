import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { ProductCard } from '@/components/ProductCard';
import { CatalogSearchField } from '@/components/CatalogSearchField';
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
    searchPlaceholder: 'Busca Catan, cooperativos, 2 jugadores…',
    searchAction: 'Buscar juegos',
    discover: 'Descubre',
    discoverText: 'Rankings, mecánicas, categorías y juegos que encajan con tu mesa.',
    compare: 'Compara',
    compareText: 'Precios y stock de tiendas verificadas, reunidos en un solo lugar.',
    collect: 'Elige mejor',
    collectText: 'Datos claros de jugadores, duración y edad antes de comprar.',
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
    searchPlaceholder: 'Search Catan, cooperative, 2 players…',
    searchAction: 'Search games',
    discover: 'Discover',
    discoverText: 'Rankings, mechanics, categories and games that fit your table.',
    compare: 'Compare',
    compareText: 'Prices and stock from verified stores, gathered in one place.',
    collect: 'Choose better',
    collectText: 'Clear player, time and age data before you buy.',
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
    listProducts({ inStock: true, limit: 18, locale }),
    getCategories(),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>
            {locale === 'es' ? <>La enciclopedia de juegos de mesa, <em>con el mejor precio.</em></> : <>The board-game encyclopedia, <em>at the best price.</em></>}
          </h1>
          <p>{t.lead}</p>
          <form className="hero-search" action={listingPath('search', locale)} method="get">
            <CatalogSearchField
              locale={locale}
              searchPath={listingPath('search', locale)}
              productBase={listingPath('games', locale)}
              placeholder={t.searchPlaceholder}
              className="search-command"
            />
          </form>
          <div className="value-grid">
            <article><span>01</span><h2>{t.discover}</h2><p>{t.discoverText}</p></article>
            <article><span>02</span><h2>{t.compare}</h2><p>{t.compareText}</p></article>
            <article><span>03</span><h2>{t.collect}</h2><p>{t.collectText}</p></article>
          </div>
        </div>
      </section>

      <main className="container">
        {categories.length > 0 && (
          <>
            <p className="section-kicker home-section-kicker">{locale === 'es' ? 'Explorar' : 'Explore'}</p>
            <h2 className="section-title home-section-title">{t.cats}</h2>
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
            <p className="section-kicker home-section-kicker">{locale === 'es' ? 'Marketplace' : 'Marketplace'}</p>
            <h2 className="section-title home-section-title">{t.featured}</h2>
            <div className="catalog-grid">
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
