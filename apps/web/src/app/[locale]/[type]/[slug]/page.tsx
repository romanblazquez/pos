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
import { breadcrumbLd, itemListLd, productLd, type Crumb } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
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

function money(minor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function priceRange(p: ProductDetail, locale: Locale): string | null {
  const prices = p.listings.map((l) => l.priceMinorUnits).filter((n) => n > 0);
  if (!prices.length) return null;
  const cur = p.listings[0]?.currency ?? 'MXN';
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo, cur, locale) : `${money(lo, cur, locale)} – ${money(hi, cur, locale)}`;
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
          <h1>{real}</h1>
          <p className="muted">
            {results.length} {locale === 'es' ? 'juegos en esta categoría' : 'games in this category'}
          </p>
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
    <>
      <Breadcrumbs crumbs={crumbs} />
      <JsonLd data={[breadcrumbLd(crumbs), productLd(product, path)]} />
      <main className="container">
        <h1>{product.name}</h1>
        {range && (
          <p className="muted">
            {product.listings.length} {locale === 'es' ? 'ofertas desde' : 'offers from'} {range}
          </p>
        )}
        {sorted.length > 0 && (
          // Purchase happens in the transactional SPA on app.juegospedia.com.
          <p style={{ margin: '0.75rem 0' }}>
            <a
              href={`${APP_URL}/product/${product.slug}`}
              style={{
                display: 'inline-block',
                background: 'var(--accent)',
                color: '#0b1020',
                fontWeight: 700,
                padding: '0.6rem 1.1rem',
                borderRadius: 8,
              }}
            >
              {locale === 'es' ? 'Comprar' : 'Buy'} →
            </a>
          </p>
        )}
        {product.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.name}
            width={320}
            height={320}
            style={{ maxWidth: 320, borderRadius: '0.75rem', margin: '1rem 0' }}
          />
        )}

        <ul className="attrs">
          {attrs
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => (
              <li key={k}>
                <b>{k}:</b> {v}
              </li>
            ))}
        </ul>

        {product.description && <p>{product.description}</p>}

        {sorted.length > 0 && (
          <section>
            <h2>{locale === 'es' ? 'Ofertas de tiendas' : 'Store offers'}</h2>
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
                  return (
                    <tr key={l.id}>
                      <td>
                        {/* No public seller storefront yet — plain text, not a link. */}
                        {l.sellerName}
                        {best && l.id === best.id && (
                          <strong> · {locale === 'es' ? 'Mejor precio' : 'Best price'}</strong>
                        )}
                      </td>
                      <td>{money(l.priceMinorUnits, l.currency, locale)}</td>
                      <td>
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
          </section>
        )}

        <section className="related">
          {product.tags?.length > 0 && (
            <div className="taglist">
              {/* Mechanic landing pages need a new API filter; until then tags
                  link to real search results rather than a 404. */}
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`${listingPath('search', locale)}?q=${encodeURIComponent(tag)}`}
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
          {product.category && (
            <p style={{ marginTop: '1rem' }}>
              <Link href={`${listingPath('categories', locale)}/${slugify(product.category)}`}>
                {locale === 'es' ? 'Ver más en' : 'See more in'} {product.category} →
              </Link>
            </p>
          )}
        </section>
      </main>
    </>
  );
}
