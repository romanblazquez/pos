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
import { APP_URL, absoluteUrl } from '@/lib/site';
import { buttonVariants } from '@retail-os/ui-react';
import { formatMoney, formatRange } from '@/lib/format';
import { articleLd, breadcrumbLd, faqLd, itemListLd, productLd, type Crumb } from '@/lib/jsonld';
import { getGuide, guideAlternates, guidesMentioning, type Guide, type GuidePick } from '@/lib/guides';
import { guideCover } from '@/lib/guide-cover';
import { AUTHORS_BY_ID } from '@/content/editorial/authors';
import { editorTake } from '@/content/editorial/takes';
import { THEMES, getThemeBySlug, primaryTheme } from '@/lib/themes';
import { identityFor } from '@/lib/category-identity';
import { CategoryMotif } from '@/components/CategoryMotif';
import { ShelfHero } from '@/components/ShelfHero';
import { JsonLd } from '@/components/JsonLd';
import { LocaleAlternates } from '@/components/LocaleAlternates';
import { ShareBar } from '@/components/ShareBar';
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
    const product = await getProduct(params.slug, locale);
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
    const basePath = entityPath('categories', locale, params.slug);
    // Page 2+ is navigational: self-canonical to the paged URL and noindex so only
    // the clean category page competes (spec §9); deeper products stay in the sitemap.
    const path = page > 1 ? `${basePath}?page=${page}` : basePath;
    const theme = getThemeBySlug(locale, params.slug);
    if (theme) {
      const baseTitle = locale === 'es' ? `${theme.label.es} — Juegos de mesa` : `${theme.label.en} — Board games`;
      return buildMetadata({
        locale,
        path,
        title: page > 1 ? `${baseTitle} — ${locale === 'es' ? 'página' : 'page'} ${page}` : baseTitle,
        description: theme.description[locale],
        noindex: page > 1,
        // Themes have distinct per-locale slugs, so map hreflang explicitly.
        alternates: page > 1
          ? undefined
          : { es: entityPath('categories', 'es', theme.slug.es), en: entityPath('categories', 'en', theme.slug.en) },
      });
    }
    const real = await resolveCategory(params.slug);
    if (!real) return {};
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
    const guide = getGuide(params.slug, locale);
    if (!guide) return {};
    // Social card = the guide's curated editorial banner; fall back to the first
    // pick's product photo only if a guide somehow has no art.
    const cover = guide.ogImage ?? (await guideCover(guide, locale));
    const author = guide.authorId ? AUTHORS_BY_ID[guide.authorId] : undefined;
    return buildMetadata({
      locale,
      path: entityPath('guides', locale, guide.slug),
      title: guide.title,
      description: guide.description,
      alternates: guideAlternates(guide),
      type: 'article',
      images: cover ? [cover] : undefined,
      article: {
        authors: author ? [author.name] : undefined,
        publishedTime: guide.publishedAt,
        modifiedTime: guide.updatedAt,
        section: locale === 'es' ? 'Juegos de mesa' : 'Board games',
      },
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
    const product = await getProduct(params.slug, locale);
    if (!product) notFound();
    return renderProduct(product, locale, homeName);
  }

  if (kind === 'categories') {
    const page = pageOf(searchParams);
    const basePath = entityPath('categories', locale, params.slug);
    const theme = getThemeBySlug(locale, params.slug);
    // A curated theme (query by its BGG-tag / player-count rule) or, for legacy
    // links, the raw catalog category (base-game vs expansion).
    const real = theme ? null : await resolveCategory(params.slug);
    if (!theme && !real) notFound();

    const { results, total } = await listProducts(
      theme
        ? { locale, category: theme.key, limit: CATEGORY_PAGE_SIZE, offset: (page - 1) * CATEGORY_PAGE_SIZE }
        : { locale, category: real!, limit: CATEGORY_PAGE_SIZE, offset: (page - 1) * CATEGORY_PAGE_SIZE },
    );

    const title = theme ? theme.label[locale] : real!;
    const lede = theme
      ? theme.description[locale]
      : locale === 'es'
        ? `Compara precios y stock real de juegos de mesa de ${real} entre tiendas verificadas y encuentra el mejor precio para tu próxima partida.`
        : `Compare real prices and stock for ${real} board games across verified stores and find the best price for your next game night.`;

    // Lateral nav into sibling themes — denser internal linking + better journey.
    const siblings = THEMES.filter((t) => t.slug[locale] !== params.slug);

    const crumbs: Crumb[] = [
      { name: homeName, path: homePath(locale) },
      { name: locale === 'es' ? 'Categorías' : 'Categories', path: listingPath('categories', locale) },
      { name: title, path: basePath },
    ];
    const catAlternates = theme
      ? { es: entityPath('categories', 'es', theme.slug.es), en: entityPath('categories', 'en', theme.slug.en) }
      : entityAlternates('categories', params.slug);
    return (
      <main className="container">
        <LocaleAlternates alternates={catAlternates} />
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
        {/* A curated shelf carries its identity through the click; a legacy raw
            category has none to carry, so it keeps the plain header. */}
        {theme ? (
          <ShelfHero
            identity={identityFor(theme)}
            title={title}
            // Page 2+ drops the lede, as the plain header always has — it's the
            // shelf's intro, not a per-page restatement.
            lede={page === 1 ? lede : ''}
            total={total}
            locale={locale}
          />
        ) : (
          <>
            <h1 className="page-title">{title}</h1>
            <p className="muted">
              {total} {locale === 'es' ? (total === 1 ? 'juego' : 'juegos') : (total === 1 ? 'game' : 'games')}
            </p>
            {page === 1 && <p className="lede">{lede}</p>}
          </>
        )}
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
        <section aria-label={locale === 'es' ? 'Explora por tema' : 'Explore by theme'}>
          <h2 className="section-title">{locale === 'es' ? 'Explora por tema' : 'Explore by theme'}</h2>
          <div className="taglist">
            {siblings.map((t) => {
              const sid = identityFor(t);
              return (
                <Link
                  key={t.key}
                  className="chip chip-shelf"
                  href={entityPath('categories', locale, t.slug[locale])}
                  style={{ '--cat-accent': sid.accent } as React.CSSProperties}
                >
                  <CategoryMotif motif={sid.motif} size={14} className="chip-shelf-motif" />
                  {t.label[locale]}
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (kind === 'guides') {
    const guide = getGuide(params.slug, locale);
    if (!guide) notFound();
    return renderGuide(guide, locale, homeName);
  }

  notFound();
}

async function renderGuide(guide: Guide, locale: Locale, homeName: string) {
  const path = entityPath('guides', locale, guide.slug);
  const editorialCover = guide.ogImage ?? (await guideCover(guide, locale));
  // Resolve each pick to a live product so the guide links into shoppable pages
  // (and silently drops any pick whose product is no longer in the catalogue).
  const picks = (await Promise.all(
    guide.picks.map(async (pick) => {
      const product = await getProduct(pick.gameSlug, locale);
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

  const author = guide.authorId ? AUTHORS_BY_ID[guide.authorId] : undefined;

  return (
    <main className="container">
      <LocaleAlternates alternates={guideAlternates(guide)} />
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
            image: editorialCover ?? picks[0]?.product.images?.[0],
            author: author ? { name: author.name } : undefined,
          }),
          ...(guide.faq?.length ? [faqLd(guide.faq)] : []),
        ]}
      />

      <article className="prose" style={{ maxWidth: 760 }}>
        <h1 className="product-h1">{guide.title}</h1>
        {editorialCover ? (
          <figure className="guide-article-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={editorialCover} alt={guide.title} width={1600} height={900} />
          </figure>
        ) : null}
        {author ? (
          <div className="guide-byline" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px' }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--bg-raised, var(--card))', border: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
              {author.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.35 }}>
              <b>{locale === 'es' ? 'Por' : 'By'} {author.name}</b>
              <span className="muted"> · {author.from}</span>
              <br />
              <span className="muted">
                {locale === 'es' ? 'Actualizado el' : 'Updated'} {dateLabel}
                {guide.autoTranslated && (
                  <span
                    className="chip"
                    style={{ marginLeft: 8, fontSize: 11, padding: '1px 7px', verticalAlign: 'middle' }}
                    title={locale === 'es' ? 'Traducido automáticamente del idioma original' : 'Automatically translated from the original language'}
                  >
                    {locale === 'es' ? 'Traducción automática' : 'Auto-translated'}
                  </span>
                )}
              </span>
            </span>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 4 }}>
            {locale === 'es' ? 'Actualizado el' : 'Updated'} {dateLabel}
          </p>
        )}
        {author && <p className="muted" style={{ fontSize: 13.5, fontStyle: 'italic', margin: '2px 0 8px' }}>{author.bio}</p>}
        <ShareBar url={absoluteUrl(path)} title={guide.title} locale={locale} />
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

// Raw catalogue categories are only base-game vs expansion — surface them with
// human labels when a product has no richer theme to sit under.
const RAW_CATEGORY_LABELS: Record<string, { es: string; en: string }> = {
  'board-game': { es: 'Juegos de mesa', en: 'Board games' },
  expansion: { es: 'Expansiones', en: 'Expansions' },
  Preventas: { es: 'Preventas', en: 'Preorders' },
};

// Breadcrumb trail for a product, built from the product's own info so it mirrors
// where the game actually sits in the browse taxonomy:
//   Inicio › Categorías › <best theme | labelled category> › <product>
// The middle crumb prefers the product's primary curated theme (e.g. "Para 2
// jugadores"), which is both the most useful landing for users and the most
// search-relevant hub for bots; it falls back to the labelled raw category, and
// finally to just the catalogue. Every crumb links to a page that resolves, so
// the BreadcrumbList stays valid (no dead links, no fabricated levels).
function productCrumbs(product: ProductDetail, locale: Locale, homeName: string, path: string): Crumb[] {
  const crumbs: Crumb[] = [
    { name: homeName, path: homePath(locale) },
    { name: locale === 'es' ? 'Categorías' : 'Categories', path: listingPath('categories', locale) },
  ];

  const primaryCategory = product.categories?.find((category) => category.isPrimary) ?? product.categories?.[0];
  const persistedPrimary = product.categories?.find((category) => category.isPrimary);
  const theme = persistedPrimary
    ? THEMES.find((candidate) => candidate.key === persistedPrimary.slug)
    : primaryTheme(product);
  if (primaryCategory) {
    crumbs.push({
      name: primaryCategory.name,
      path: entityPath('categories', locale, primaryCategory.slug),
    });
  } else if (theme) {
    crumbs.push({ name: theme.label[locale], path: entityPath('categories', locale, theme.slug[locale]) });
  } else if (product.category) {
    const label = RAW_CATEGORY_LABELS[product.category]?.[locale] ?? product.category;
    crumbs.push({ name: label, path: entityPath('categories', locale, slugify(product.category)) });
  }

  crumbs.push({ name: product.name, path });
  return crumbs;
}

function renderProduct(product: ProductDetail, locale: Locale, homeName: string) {
  const path = entityPath('games', locale, product.slug);
  const crumbs = productCrumbs(product, locale, homeName, path);
  const sorted = [...product.listings].sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
  const best = bestOffer(product.listings);
  const range = priceRange(product, locale);

  // Each attribute doubles as a crawlable entry point into a real filtered view,
  // so bots discover publisher/designer/player-count hubs and users can pivot
  // from any fact to "more like this". Publisher/year/player/age/duration use
  // explicit structured filters; designer remains lexical until it gains a
  // normalized relation of its own.
  const searchFor = (term: string) => `${listingPath('search', locale)}?q=${encodeURIComponent(term)}`;
  const gamesWith = (key: string, value: string | number) =>
    `${listingPath('games', locale)}?${key}=${encodeURIComponent(String(value))}`;
  const attrs: Array<{ label: string; value: string | number | undefined; wide?: boolean; href?: string }> = [
    { label: locale === 'es' ? 'Editorial' : 'Publisher', value: product.publisher, wide: true, href: product.publisher ? gamesWith('publisher', product.publisher) : undefined },
    { label: locale === 'es' ? 'Diseñador' : 'Designer', value: product.designer, wide: true, href: product.designer ? searchFor(product.designer) : undefined },
    { label: locale === 'es' ? 'Año' : 'Year', value: product.yearPublished, href: product.yearPublished ? gamesWith('year', product.yearPublished) : undefined },
    {
      label: locale === 'es' ? 'Jugadores' : 'Players',
      value: product.minPlayers
        ? `${product.minPlayers}${product.maxPlayers && product.maxPlayers !== product.minPlayers ? `–${product.maxPlayers}` : ''}`
        : undefined,
      href: product.minPlayers ? gamesWith('players', product.minPlayers) : undefined,
    },
    { label: locale === 'es' ? 'Edad' : 'Age', value: product.minAge ? `${product.minAge}+` : undefined, href: product.minAge ? gamesWith('age', product.minAge) : undefined },
    {
      label: locale === 'es' ? 'Duración' : 'Play time',
      value: product.playTimeMinutes ? `${product.playTimeMinutes} min` : undefined,
      href: product.playTimeMinutes ? gamesWith('duration', product.playTimeMinutes) : undefined,
    },
  ];

  return (
    <main className="container">
      <LocaleAlternates alternates={entityAlternates('games', product.slug)} />
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

          <ShareBar url={absoluteUrl(path)} title={product.name} locale={locale} />

          <ul className="attrs">
            {attrs
              .filter(({ value }) => value !== undefined && value !== '')
              .map(({ label, value, wide, href }) => (
                <li key={label} className={wide ? 'attr-wide' : undefined}>
                  {href ? (
                    // Stretched link: the whole card is clickable (see .attr-link
                    // in globals.css) while the value stays the visible anchor text.
                    <Link className="attr-link" href={href}>
                      <b>{value}</b>
                      {label}
                    </Link>
                  ) : (
                    <>
                      <b>{value}</b>
                      {label}
                    </>
                  )}
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

      {/* Persona-signed editor's take — unique human-voice content + a product→author link. */}
      {(() => {
        const take = editorTake(product.slug, locale);
        if (!take) return null;
        const { author, text } = take;
        const initials = author.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
        return (
          <figure className="editor-take">
            <figcaption className="editor-take-head">
              <span aria-hidden="true" className="editor-take-avatar">{initials}</span>
              <span>
                <b>{locale === 'es' ? 'La opinión de' : "Editor's take by"} {author.name}</b>
                <span className="muted"> · {author.from}</span>
              </span>
            </figcaption>
            <blockquote className="editor-take-quote">{text}</blockquote>
          </figure>
        );
      })()}

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
        const related = guidesMentioning(product.slug, locale);
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
