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
import { articleLd, breadcrumbLd, faqLd, itemListLd, productLd, type Crumb } from '@/lib/jsonld';
import { getGuide, guidesMentioning, type Guide, type GuidePick } from '@/lib/guides';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProductCard } from '@/components/ProductCard';
import { CatalogEmpty } from '@/components/CatalogEmpty';
import { Pager } from '@/components/Pager';
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

// Per-category product page size. Larger than the catalogue listing (denser grid)
// but still paginated so big categories expose their full depth via crawlable
// pages (products are also all in the sitemap).
const CATEGORY_PAGE_SIZE = 48;

function pageOf(searchParams: { page?: string } | undefined): number {
  const n = parseInt(searchParams?.page ?? '1', 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

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
  searchParams,
}: {
  params: { locale: string; type: string; slug: string };
  searchParams?: { page?: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const locale = params.locale as Locale;
  const kind = resolveKind(locale, params.type);
  const page = pageOf(searchParams);

  if (kind === 'games') {
    const product = await getProduct(params.slug);
    if (!product) return {};
    const range = priceRange(product, locale);
    const title = range ? `${product.name} — ${range}` : product.name;
    // Bare catalog stub (auto-imported, no offers and no enriched copy) — thin for
    // a shopping page, so keep it out of the index until it has real content. The
    // API list/search surface already excludes these; this only guards direct hits.
    const thin = product.listings.length === 0 && !product.description;
    return buildMetadata({
      locale,
      path: entityPath('games', locale, product.slug),
      title,
      description: productDescription(product, locale),
      images: product.images,
      alternates: entityAlternates('games', product.slug),
      type: 'product',
      noindex: thin,
    });
  }

  if (kind === 'categories') {
    const real = await resolveCategory(params.slug);
    if (!real) return {};
    const basePath = entityPath('categories', locale, params.slug);
    // Page 2+ is navigational: self-canonical to the paged URL and noindex so only
    // the clean category page competes (spec §9); deeper products stay in the sitemap.
    const path = page > 1 ? `${basePath}?page=${page}` : basePath;
    const baseTitle = locale === 'es' ? `${real} — Juegos de mesa` : `${real} — Board games`;
    return buildMetadata({
      locale,
      path,
      title: page > 1 ? `${baseTitle} — ${locale === 'es' ? 'página' : 'page'} ${page}` : baseTitle,
      description:
        locale === 'es'
          ? `Juegos de mesa de la categoría ${real}, con precios comparados entre tiendas.`
          : `${real} board games with prices compared across stores.`,
      noindex: page > 1,
      alternates: page > 1 ? undefined : entityAlternates('categories', params.slug),
    });
  }

  if (kind === 'guides') {
    const guide = getGuide(params.slug);
    if (!guide) return {};
    return buildMetadata({
      locale,
      path: entityPath('guides', locale, guide.slug),
      title: guide.title,
      description: guide.description,
      alternates: entityAlternates('guides', guide.slug),
      type: 'article',
    });
  }

  return {};
}

// Reverse-map a URL slug to the real DB category string (never fabricate one).
async function resolveCategory(slug: string): Promise<string | null> {
  const categories = await getCategories();
  const listedCategory = categories.find((c) => slugify(c.category) === slug)?.category;
  if (listedCategory) return listedCategory;

  // The category endpoint only includes verified products with active DB
  // listings, while the public search index can contain additional catalog
  // products. Validate those category URLs against the same search source used
  // to render this page so a product breadcrumb never leads to a false 404.
  const { results } = await listProducts({ category: slug, limit: 1 });
  return results.find((product) => slugify(product.category) === slug)?.category ?? null;
}

export default async function DetailPage({
  params,
  searchParams,
}: {
  params: { locale: string; type: string; slug: string };
  searchParams?: { page?: string };
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
    const page = pageOf(searchParams);
    const basePath = entityPath('categories', locale, params.slug);
    const { results, total } = await listProducts({
      category: real,
      limit: CATEGORY_PAGE_SIZE,
      offset: (page - 1) * CATEGORY_PAGE_SIZE,
    });
    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: listingPath('categories', locale) },
      { name: real, path: basePath },
    ];
    return (
      <main className="container">
        <Breadcrumbs crumbs={crumbs} />
        {page === 1 && (
          <JsonLd
            data={[
              breadcrumbLd(crumbs),
              itemListLd(
                results.map((p) => ({ name: p.name, path: `${listingPath('games', locale)}/${p.slug}` })),
              ),
            ]}
          />
        )}
        <h1 className="page-title">{real}</h1>
        <p className="muted">
          {total} {locale === 'es' ? 'juegos en esta categoría' : 'games in this category'}
        </p>
        {results.length > 0 ? (
          <>
            <div className="catalog-grid" style={{ marginTop: '1.25rem' }}>
              {results.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
            </div>
            <Pager base={basePath} page={page} total={total} locale={locale} pageSize={CATEGORY_PAGE_SIZE} />
          </>
        ) : (
          <CatalogEmpty locale={locale} clearHref={listingPath('categories', locale)} />
        )}
      </main>
    );
  }

  if (kind === 'guides') {
    const guide = getGuide(params.slug);
    if (!guide) notFound();
    return renderGuide(guide, locale, homeName);
  }

  notFound();
}

async function renderGuide(guide: Guide, locale: Locale, homeName: string) {
  const path = entityPath('guides', locale, guide.slug);
  // Resolve each pick to a live product so the guide links into shoppable pages
  // (and silently drops any pick whose product is no longer in the catalogue).
  const picks = (await Promise.all(
    guide.picks.map(async (pick) => {
      const product = await getProduct(pick.gameSlug);
      return product ? { pick, product } : null;
    }),
  )).filter((x): x is { pick: GuidePick; product: ProductDetail } => x !== null);

  const crumbs: Crumb[] = [
    { name: homeName, path: homePath(locale) },
    { name: locale === 'es' ? 'Guías' : 'Guides', path: listingPath('guides', locale) },
    { name: guide.title, path },
  ];

  const dateLabel = new Date(guide.updatedAt).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <main className="container">
      <Breadcrumbs crumbs={crumbs} />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          articleLd({
            title: guide.title,
            description: guide.description,
            path,
            datePublished: guide.publishedAt,
            dateModified: guide.updatedAt,
            image: picks[0]?.product.images?.[0],
          }),
          ...(guide.faq?.length ? [faqLd(guide.faq)] : []),
        ]}
      />

      <article className="prose" style={{ maxWidth: 760 }}>
        <h1 className="product-h1">{guide.title}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {locale === 'es' ? 'Actualizado el' : 'Updated'} {dateLabel}
        </p>
        {guide.intro.map((p, i) => <p key={`intro-${i}`}>{p}</p>)}

        <ol className="guide-picks" style={{ listStyle: 'none', padding: 0, margin: '2rem 0', display: 'grid', gap: '1rem' }}>
          {picks.map(({ pick, product }, i) => {
            const range = priceRange(product, locale);
            return (
              <li key={product.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-raised, var(--card))' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, opacity: 0.5, minWidth: 28 }}>{i + 1}</div>
                {product.images?.[0] && (
                  <img src={product.images[0]} alt={product.name} width={84} height={84} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                    <Link href={entityPath('games', locale, product.slug)}>{product.name}</Link>
                    {range && <span className="muted" style={{ fontWeight: 400 }}> · {locale === 'es' ? 'desde' : 'from'} {range.split('–')[0].trim()}</span>}
                  </h2>
                  <p style={{ margin: '0.4rem 0 0' }}>{pick.blurb}</p>
                  <Link className="chip" style={{ marginTop: 8, display: 'inline-block' }} href={entityPath('games', locale, product.slug)}>
                    {locale === 'es' ? 'Ver ofertas' : 'See offers'} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>

        {guide.sections?.map((s, i) => (
          <section key={`sec-${i}`}>
            <h2 className="section-title">{s.heading}</h2>
            {s.paragraphs.map((p, j) => <p key={`sec-${i}-${j}`}>{p}</p>)}
          </section>
        ))}

        {guide.faq?.length ? (
          <section>
            <h2 className="section-title">{locale === 'es' ? 'Preguntas frecuentes' : 'FAQ'}</h2>
            {guide.faq.map((f, i) => (
              <div key={`faq-${i}`} style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{f.q}</h3>
                <p style={{ margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}

function renderProduct(product: ProductDetail, locale: Locale, homeName: string) {
  const path = entityPath('games', locale, product.slug);
  const crumbs: Crumb[] = [
    { name: homeName, path: homePath(locale) },
    { name: locale === 'es' ? 'Juegos de mesa' : 'Board games', path: listingPath('games', locale) },
    ...(product.category
      ? [{
          name: product.category,
          path: entityPath('categories', locale, slugify(product.category)),
        }]
      : []),
    { name: product.name, path },
  ];
  const sorted = [...product.listings].sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
  const best = bestOffer(product.listings);
  const range = priceRange(product, locale);

  const attrs: Array<{ label: string; value: string | number | undefined; wide?: boolean }> = [
    { label: locale === 'es' ? 'Editorial' : 'Publisher', value: product.publisher, wide: true },
    { label: locale === 'es' ? 'Diseñador' : 'Designer', value: product.designer, wide: true },
    { label: locale === 'es' ? 'Año' : 'Year', value: product.yearPublished },
    {
      label: locale === 'es' ? 'Jugadores' : 'Players',
      value: product.minPlayers
        ? `${product.minPlayers}${product.maxPlayers && product.maxPlayers !== product.minPlayers ? `–${product.maxPlayers}` : ''}`
        : undefined,
    },
    { label: locale === 'es' ? 'Edad' : 'Age', value: product.minAge ? `${product.minAge}+` : undefined },
    {
      label: locale === 'es' ? 'Duración' : 'Play time',
      value: product.playTimeMinutes ? `${product.playTimeMinutes} min` : undefined,
    },
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
              .filter(({ value }) => value !== undefined && value !== '')
              .map(({ label, value, wide }) => (
                <li key={label} className={wide ? 'attr-wide' : undefined}>
                  <b>{value}</b>
                  {label}
                </li>
              ))}
          </ul>

          {product.minPlayers && product.maxPlayers && (
            <PlayerCountFit minPlayers={product.minPlayers} maxPlayers={product.maxPlayers} locale={locale} />
          )}
          {product.bggWeight && (
            <ComplexityMeter weight={product.bggWeight} locale={locale} />
          )}
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

      {/* Hub-and-spoke back-link: guides that recommend this game. */}
      {(() => {
        const related = guidesMentioning(product.slug);
        if (!related.length) return null;
        return (
          <section>
            <h2 className="section-title">{locale === 'es' ? 'Aparece en estas guías' : 'Featured in these guides'}</h2>
            <div className="taglist">
              {related.map((g) => (
                <Link key={g.slug} className="chip" href={entityPath('guides', locale, g.slug)}>
                  {g.title} →
                </Link>
              ))}
            </div>
          </section>
        );
      })()}
    </main>
  );
}

function ComplexityMeter({ weight, locale }: { weight: number; locale: string }) {
  const pct = (weight / 5) * 100;
  const band =
    weight < 2 ? (locale === 'es' ? 'Ligero' : 'Light') :
    weight < 2.5 ? (locale === 'es' ? 'Medio-ligero' : 'Medium-light') :
    weight < 3.5 ? (locale === 'es' ? 'Medio' : 'Medium') :
    weight < 4.5 ? (locale === 'es' ? 'Pesado' : 'Heavy') :
    (locale === 'es' ? 'Experto' : 'Expert');

  return (
    <div style={{ marginTop: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-raised, var(--card))', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
          {locale === 'es' ? 'Complejidad' : 'Complexity'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8A5A12', background: '#F6EBD2', border: '1px solid #E7D3A6', padding: '3px 9px', borderRadius: 7 }}>
          {weight.toFixed(1)} / 5 · {band}
        </span>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 8, background: 'linear-gradient(90deg,#3E7C53 0%,#C0852F 42%,#B4502E 72%,#7E2A20 100%)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb,var(--foreground) 12%,transparent)' }}>
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 3, height: 24, background: 'var(--foreground)', borderRadius: 3, transform: 'translateX(-50%) translateY(-50%)', boxShadow: '0 0 0 3px var(--bg-raised, var(--card))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', color: 'var(--tx-faint, var(--subtle-foreground))' }}>
        <span style={{ color: '#3E7C53', fontWeight: 700 }}>{locale === 'es' ? 'Ligero' : 'Light'}</span>
        <span>{locale === 'es' ? 'Medio' : 'Medium'}</span>
        <span>{locale === 'es' ? 'Pesado' : 'Heavy'}</span>
        <span>{locale === 'es' ? 'Experto' : 'Expert'}</span>
      </div>
    </div>
  );
}

function PlayerCountFit({ minPlayers, maxPlayers, locale }: { minPlayers: number; maxPlayers: number; locale: string }) {
  const counts = Array.from({ length: maxPlayers }, (_, i) => i + 1);
  const badge = minPlayers === maxPlayers
    ? `${minPlayers} ${locale === 'es' ? 'jugadores' : 'players'}`
    : `${minPlayers}–${maxPlayers} ${locale === 'es' ? 'jugadores' : 'players'}`;

  return (
    <div style={{ marginTop: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-raised, var(--card))', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
          {locale === 'es' ? 'Jugadores' : 'Players'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#2C6B43', background: '#E4EFE4', border: '1px solid #CBE0CD', padding: '3px 9px', borderRadius: 7 }}>
          {badge}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {counts.map((n) => {
          const isMin = n === minPlayers && minPlayers < maxPlayers;
          const isSupported = n >= minPlayers && n <= maxPlayers;
          const bg = !isSupported ? '#EDE4D2' : isMin ? '#F6EBD2' : '#3E7C53';
          const border = !isSupported ? '1px dashed #D8CCB3' : isMin ? '1px solid #E7D3A6' : undefined;
          const color = !isSupported ? '#B6A98C' : isMin ? '#8A5A12' : '#EAF3EC';
          const label = !isSupported ? 'No' : isMin ? 'OK' : locale === 'es' ? 'Bien' : 'Good';
          const labelColor = !isSupported ? '#B6A98C' : isMin ? '#8A5A12' : '#2C6B43';
          return (
            <div key={n} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 38, borderRadius: 9, background: bg, border, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color, textDecoration: !isSupported ? 'line-through' : undefined }}>
                {n}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: labelColor, marginTop: 5, fontWeight: isSupported && !isMin ? 700 : undefined }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
