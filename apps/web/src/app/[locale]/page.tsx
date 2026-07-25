import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listProducts } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { ProductCard } from '@/components/ProductCard';
import { CatalogSearchField } from '@/components/CatalogSearchField';
import { PromoBanner, PromoStrip } from '@/components/PromoBanner';
import { ShelfCard } from '@/components/ShelfCard';
import { listShelves } from '@/lib/shelves';
import { getPromos, rotateTones } from '@/lib/promos';
import { homePath, isLocale, listingPath, type Locale } from '@/lib/segments';

export const revalidate = 1800;

/** Busiest shelves to surface on the home page; the rest live on the hub. */
const HOME_SHELVES = 8;

const T = {
  es: {
    title: 'Juegospedia — Compara precios de juegos de mesa',
    desc: 'Compara precios, stock y envíos de juegos de mesa entre tiendas verificadas de México.',
    eyebrow: 'Precios comparados · tiendas verificadas',
    h1: 'La enciclopedia de juegos de mesa, con el mejor precio.',
    lead: 'Encuentra cualquier juego y compara las ofertas de todas las tiendas en un solo lugar.',
    cats: 'Explora por categoría',
    allCats: 'Ver las 16 categorías',
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
    allCats: 'See all 16 categories',
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

  // The home page browses by *shelf*, not by the catalogue's raw `category`
  // field — that field is only base-game vs expansion, so it produced chips
  // reading "board-game 26" that led to a thin `/categorias/board-game` page.
  // The curated shelves are the real browse axis (see `lib/themes.ts`).
  const [{ results: featured }, shelves] = await Promise.all([
    listProducts({ inStock: true, limit: 18, locale }),
    listShelves(),
  ]);
  const topShelves = shelves.slice(0, HOME_SHELVES);

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
        {/* Trust first: shipping/returns answer the objection before the browse. */}
        <PromoStrip locale={locale} />

        {topShelves.length > 0 && (
          <>
            <p className="section-kicker home-section-kicker">{locale === 'es' ? 'Explorar' : 'Explore'}</p>
            <h2 className="section-title home-section-title">{t.cats}</h2>
            <div className="category-grid home-shelf-grid">
              {topShelves.map((shelf) => (
                <ShelfCard key={shelf.theme.key} shelf={shelf} locale={locale} share={false} />
              ))}
            </div>
            <p style={{ marginTop: '1.5rem' }}>
              <Link className="chip" href={listingPath('categories', locale)}>
                {t.allCats} →
              </Link>
            </p>
          </>
        )}

        {rotateTones(getPromos('home')).map(({ item, tone }) => (
          <PromoBanner key={item.id} promo={item} locale={locale} tone={tone} />
        ))}

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
