import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bestOffer,
  getCategories,
  getProduct,
  listProducts,
  type ProductDetail,
} from '@/lib/api';
import { buildMetadata, entityAlternates } from '@/lib/seo';
import { APP_URL } from '@/lib/site';
import { buttonVariants } from '@retail-os/ui-react';
import { formatMoney, formatRange } from '@/lib/format';
import { breadcrumbLd, itemListLd, productLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProductCard } from '@/components/ProductCard';
import {
  entityPath,
  homePath,
  isLocale,
  listingPath,
  resolveKind,
  slugify,
  type Locale,
} from '@/lib/segments';

// SSR + ISR: pages aren't pre-generated at build (catalog is large/changing);
// they render on demand and cache per ISR window, revalidated on price/stock
// change in Phase 3. dynamicParams defaults to true.
export const revalidate = 900;

function priceRange(p: ProductDetail, locale: Locale): string | null {
  const prices = p.listings.map((l) => l.priceMinorUnits).filter((n) => n > 0);
  if (!prices.length) return null;
  const cur = p.listings[0]?.currency ?? 'MXN';
  return formatRange(Math.min(...prices), Math.max(...prices), cur, locale);
}

function productDescription(p: ProductDetail, locale: Locale): string {
  if (p.description) return p.description.replace(/\s+/g, ' ').trim().slice(0, 300);
  const range = priceRange(p, locale);
  const sellers = p.listings.length;
  return locale === 'es'
    ? `Compara ${sellers} oferta${sellers === 1 ? '' : 's'} de ${p.name}${range ? ` desde ${range.split('–')[0].trim()}` : ''} entre tiendas verificadas.`
    : `Compare ${sellers} offer${sellers === 1 ? '' : 's'} for ${p.name} across verified stores.`;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; type: string; slug: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);

  if (kind === 'games') {
    const product = await getProduct(params.slug);
    if (!product) return {};
    const range = priceRange(product, locale);
    const title = range ? `${product.name} — ${range}` : product.name;
    return buildMetadata({
      locale,
      path: entityPath('games', locale, product.slug),
      title,
      description: productDescription(product, locale),
      images: product.images,
      alternates: entityAlternates('games', product.slug),
      type: 'product',
    });
  }

  if (kind === 'categories') {
    const real = await resolveCategory(params.slug);
    if (!real) return {};
    const title = locale === 'es' ? `${real} — Juegos de mesa` : `${real} — Board games`;
    return buildMetadata({
      locale,
      path: entityPath('categories', locale, params.slug),
      title,
      description:
        locale === 'es'
          ? `Juegos de mesa de la categoría ${real}, con precios comparados entre tiendas.`
          : `${real} board games with prices compared across stores.`,
      alternates: entityAlternates('categories', params.slug),
    });
  }

  return {};
}

// Reverse-map a URL slug to the real DB category string (never fabricate one).
async function resolveCategory(slug: string): Promise<string | null> {
  const categories = await getCategories();
  return categories.find((c) => slugify(c.category) === slug)?.category ?? null;
}

export default async function DetailPage({
  params,
}: {
  params: { locale: string; type: string; slug: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  if (kind === null) notFound();
  const homeName = locale === 'es' ? 'Inicio' : 'Home';

  if (kind === 'games') {
    const product = await getProduct(params.slug);
    if (!product) notFound();
    return renderProduct(product, locale, homeName);
  }

  if (kind === 'categories') {
    const real = await resolveCategory(params.slug);
    if (!real) notFound();
    const { results } = await listProducts({ category: real, limit: 48 });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: listingPath('categories', locale) },
      { name: real, path: entityPath('categories', locale, params.slug) },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        <JsonLd
          data={[
            breadcrumbLd(crumbs),
            itemListLd(
              results.map((p) => ({ name: p.name, path: `${listingPath('games', locale)}/${p.slug}` })),
            ),
          ]}
        />
        <h1 className="page-title">{real}</h1>
        <p className="muted">
          {results.length} {locale === 'es' ? 'juegos en esta categoría' : 'games in this category'}
        </p>
        <div className="grid" style={{ marginTop: '1.25rem' }}>
          {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
        </div>
      </main>
    );
  }

  notFound();
}

function renderProduct(product: ProductDetail, locale: Locale, homeName: string) {
  const path = entityPath('games', locale, product.slug);
  const crumbs: Crumb[] = [
    { name: homeName, path: homePath(locale) },
    { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: listingPath('games', locale) },
    { name: product.name, path },
  ];
  const sorted = [...product.listings].sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
  const best = bestOffer(product.listings);
  const range = priceRange(product, locale);

  const attrs: [string, string | number | undefined][] = [
    [locale === 'es' ? 'Editorial' : 'Publisher', product.publisher],
    [locale === 'es' ? 'Diseñador' : 'Designer', product.designer],
    [locale === 'es' ? 'Año' : 'Year', product.yearPublished],
    [
      locale === 'es' ? 'Jugadores' : 'Players',
      product.minPlayers
        ? `${product.minPlayers}${product.maxPlayers && product.maxPlayers !== product.minPlayers ? `–${product.maxPlayers}` : ''}`
        : undefined,
    ],
    [locale === 'es' ? 'Edad' : 'Age', product.minAge ? `${product.minAge}+` : undefined],
    [
      locale === 'es' ? 'Duración' : 'Play time',
      product.playTimeMinutes ? `${product.playTimeMinutes} min` : undefined,
    ],
  ];

  return (
    <main className="container">
      <Breadcrumbs crumbs={crumbs} />
      <JsonLd data={[breadcrumbLd(crumbs), productLd(product, path)]} />

      <div className="product-head">
        <div className="product-figure">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} width={320} height={320} />
          ) : (
            <div className="card-noimg" style={{ aspectRatio: '1 / 1', fontSize: '4rem' }} aria-hidden="true">🎲</div>
          )}
        </div>

        <div>
          <h1 className="product-h1">{product.name}</h1>
          {range && (
            <p className="product-sub">
              {product.listings.length} {locale === 'es' ? 'ofertas · desde' : 'offers · from'}{' '}
              <span className="product-price-lead">{range.split('–')[0].trim()}</span>
            </p>
          )}
          {sorted.length > 0 && (
            // Purchase completes in the transactional SPA on app.juegospedia.com.
            // buttonVariants() styles the anchor without Radix Slot (RSC-safe).
            <a className={buttonVariants({ size: 'lg' })} href={`${APP_URL}/product/${product.slug}`}>
              {locale === 'es' ? 'Comprar ahora' : 'Buy now'} →
            </a>
          )}

          <ul className="attrs">
            {attrs
              .filter(([, v]) => v !== undefined && v !== '')
              .map(([k, v]) => (
                <li key={k}>
                  <b>{v}</b>
                  {k}
                </li>
              ))}
          </ul>
        </div>
      </div>

      {product.description && <p className="prose" style={{ marginTop: '1.5rem' }}>{product.description}</p>}

      {sorted.length > 0 && (
        <section>
          <h2 className="section-title">{locale === 'es' ? 'Ofertas de tiendas' : 'Store offers'}</h2>
          <div className="offers-wrap">
            <table className="offers">
              <thead>
                <tr>
                  <th>{locale === 'es' ? 'Tienda' : 'Store'}</th>
                  <th>{locale === 'es' ? 'Precio' : 'Price'}</th>
                  <th>{locale === 'es' ? 'Disponibilidad' : 'Availability'}</th>
                  <th>{locale === 'es' ? 'Envío' : 'Delivery'}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const delivery = l.deliveryOptions?.[0];
                  const isBest = best?.id === l.id;
                  return (
                    <tr key={l.id} className={isBest ? 'is-best' : undefined}>
                      <td>
                        {/* No public seller storefront yet — plain text, not a link. */}
                        {l.sellerName}
                        {isBest && (
                          <span className="best-pill">{locale === 'es' ? 'Mejor precio' : 'Best price'}</span>
                        )}
                      </td>
                      <td className="offer-price">{formatMoney(l.priceMinorUnits, l.currency, locale)}</td>
                      <td className={l.stock > 0 ? 'in-stock' : 'out-stock'}>
                        {l.stock > 0
                          ? locale === 'es' ? 'En stock' : 'In stock'
                          : locale === 'es' ? 'Agotado' : 'Out of stock'}
                      </td>
                      <td>
                        {delivery
                          ? `${delivery.estimatedDaysMin}–${delivery.estimatedDaysMax} ${locale === 'es' ? 'días' : 'days'}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(product.tags?.length > 0 || product.category) && (
        <section>
          {product.category && (
            <p style={{ margin: '1.75rem 0 0.75rem' }}>
              <Link className="chip" href={`${listingPath('categories', locale)}/${slugify(product.category)}`}>
                {locale === 'es' ? 'Ver más en' : 'See more in'} {product.category} →
              </Link>
            </p>
          )}
          {product.tags?.length > 0 && (
            <div className="taglist">
              {/* Mechanic landing pages need a new API filter; until then tags
                  link to real search results rather than a 404. */}
              {product.tags.map((tag) => (
                <Link key={tag} className="chip" href={`${listingPath('search', locale)}?q=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
