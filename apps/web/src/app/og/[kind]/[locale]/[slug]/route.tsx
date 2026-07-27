import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import sharp from 'sharp';
import { getProduct, listProducts } from '@/lib/api';
import { getGuide, listGuides } from '@/lib/guides';
import { AUTHORS_BY_ID } from '@/content/editorial/authors';
import { CATEGORY_IDENTITY, identityFor } from '@/lib/category-identity';
import { getThemeBySlug } from '@/lib/themes';
import { SEGMENTS, isLocale, type Locale } from '@/lib/segments';

export const runtime = 'nodejs';
export const revalidate = 900;

const SIZE = { width: 1200, height: 630 };

/**
 * Serve the card as JPEG rather than the PNG `ImageResponse` produces.
 *
 * Measured on this box: 577KB PNG -> 59KB JPEG for 125ms of extra work. Palette
 * PNG reaches 133KB but costs 2.3s, which is worse than the problem — these are
 * generated per request, and Twitterbot gives up long before that.
 *
 * Cached for six hours rather than fifteen minutes. A card carries a price, so
 * it should not be pinned forever; but at ~1.4s per miss on a Raspberry Pi,
 * regenerating four times an hour for every product is how a crawler times out
 * and the link renders with no image at all. `stale-while-revalidate` keeps the
 * old card serving while a new one is built.
 */
const CARD_CACHE = 'public, max-age=21600, stale-while-revalidate=604800';

type CardKind = 'product' | 'category' | 'guide';

function isCardKind(value: string): value is CardKind {
  return value === 'product' || value === 'category' || value === 'guide';
}

async function asJpeg(card: ImageResponse): Promise<Response> {
  const png = Buffer.from(await card.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CARD_CACHE },
  });
}


function cleanSlug(value: string | null): string {
  // The public URL is /og/{kind}/{locale}/{slug}.jpg — a query-free path,
  // because robots.txt disallows `/api/` and `/*?*` and the crawlers that build
  // social cards obey it. The extension arrives attached to the slug segment,
  // so strip it here rather than depending on a literal dot in the route.
  const slug = (value ?? '').replace(/\.(jpe?g|png)$/, '');
  return /^[a-z0-9][a-z0-9-]{0,180}$/.test(slug) ? slug : '';
}

/** Singular/plural for the card's count line — "1 ofertas" is a visible typo. */
function plural(n: number, locale: Locale, es: [string, string], en: [string, string]): string {
  const [one, many] = locale === 'es' ? es : en;
  return n === 1 ? one : many;
}

function money(minor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(minor / 100);
}

/**
 * Social card images, addressed entirely by path: /og/{kind}/{locale}/{slug}.jpg
 *
 * The generator used to live at /api/og?kind=…&slug=…&locale=…, which robots.txt
 * blocks twice over (`Disallow: /api/` and `Disallow: /*?*`). Twitterbot and
 * facebookexternalhit honour robots.txt when fetching card images, so every
 * shared link rendered without one. A query-free path under a directory no rule
 * matches is fetchable, and caches better besides.
 */
export async function GET(
  request: Request,
  { params }: { params: { kind: string; locale: string; slug: string } },
) {
  const locale: Locale = isLocale(params.locale) ? (params.locale as Locale) : 'es';
  const slug = cleanSlug(params.slug);
  if (!slug || !isCardKind(params.kind)) {
    return new Response('Invalid social card request', { status: 400 });
  }
  const kind: CardKind = params.kind;

  if (kind === 'product') return productCard(slug, locale);
  if (kind === 'guide') return guideCard(slug, locale, request);
  return categoryCard(slug, locale, request);
}

async function productCard(slug: string, locale: Locale) {
  const product = await getProduct(slug, locale);
  if (!product) return new Response('Product not found', { status: 404 });
  const available = product.listings.filter((listing) =>
    listing.stockStatus !== 'out_of_stock' && listing.stock > 0);
  const prices = available.map((listing) => listing.priceMinorUnits);
  const currency = available[0]?.currency ?? 'MXN';
  const price = prices.length ? money(Math.min(...prices), currency, locale) : null;
  const mark = await brandMark();
  return asJpeg(new ImageResponse(
    <SocialFrame accent="#b4502e">
      <div style={{ display: 'flex', width: 480, height: 480, alignItems: 'center', justifyContent: 'center' }}>
        {product.images[0]
          ? <img src={product.images[0]} alt="" width="480" height="480"
              style={{ width: 480, height: 480, objectFit: 'cover', borderRadius: 32, boxShadow: '0 28px 70px rgba(43,38,34,.24)' }} />
          : <div style={{ display: 'flex', fontSize: 180 }}>🎲</div>}
      </div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', paddingLeft: 56 }}>
        <Brand mark={mark} />
        <div style={{ display: 'flex', marginTop: 55, color: '#b4502e', fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>
          {locale === 'es' ? 'COMPARA PRECIOS' : 'COMPARE PRICES'}
        </div>
        <div style={{ display: 'flex', marginTop: 14, color: '#2b2622', fontSize: product.name.length > 42 ? 48 : 58, fontWeight: 800, lineHeight: 1.04 }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', marginTop: 28, alignItems: 'center', gap: 14 }}>
          {price && <div style={{ display: 'flex', borderRadius: 999, background: '#b4502e', color: '#fffaf1', padding: '12px 22px', fontSize: 28, fontWeight: 800 }}>
            {locale === 'es' ? `Desde ${price}` : `From ${price}`}
          </div>}
          <div style={{ display: 'flex', color: '#6f6557', fontSize: 24 }}>
            {available.length > 0
              ? `${available.length} ${plural(available.length, locale, ['oferta', 'ofertas'], ['offer', 'offers'])}`
              : (locale === 'es' ? 'Ficha del juego' : 'Game profile')}
          </div>
        </div>
      </div>
    </SocialFrame>,
    SIZE,
  ));
}

async function categoryCard(slug: string, locale: Locale, request: Request) {
  const theme = getThemeBySlug(locale, slug);
  const key = theme?.key ?? slug;
  const identity = theme ? identityFor(theme) : CATEGORY_IDENTITY[key];
  const { total } = await listProducts({ category: key, locale, limit: 1 });
  const label = theme?.label[locale] ?? slug.split('-').map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const description = theme?.description[locale]
    ?? (locale === 'es' ? 'Descubre y compara juegos de mesa de esta categoría.' : 'Discover and compare board games in this category.');
  const [art, mark] = await Promise.all([
    backdrop(shelfArt(identity, key), request),
    brandMark(),
  ]);
  return asJpeg(new ImageResponse(
    <ArtCard
      art={art}
      mark={mark}
      dark={identity?.dark ?? false}
      // `seal` where a shelf has one: the two dark shelves tune `accent` to sit
      // on a dark wash, and the card's copy plate is parchment. `seal` is the
      // same identity's ink-on-light variant and already clears 4.5:1 there.
      accent={identity?.seal ?? identity?.accent ?? '#b4502e'}
      eyebrow={locale === 'es' ? 'EXPLORA LA COLECCIÓN' : 'EXPLORE THE COLLECTION'}
      title={label}
      description={description}
      meta={`${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${plural(total, locale, ['juego', 'juegos'], ['game', 'games'])}`}
    />,
    SIZE,
  ));
}

async function guideCard(slug: string, locale: Locale, request: Request) {
  // The hub itself shares under its own segment slug (/og/guide/es/guias.jpg),
  // which no individual guide can collide with — guide slugs are full headlines.
  if (slug === SEGMENTS.guides[locale]) return guideHubCard(locale, request);
  const guide = await getGuide(slug, locale);
  if (!guide) return new Response('Guide not found', { status: 404 });
  const author = guide.author ?? (guide.authorId ? AUTHORS_BY_ID[guide.authorId] : undefined);
  const picks = guide.picks?.length ?? 0;
  const [art, mark] = await Promise.all([
    backdrop(guide.ogImage ?? GUIDE_ART_FALLBACK, request),
    brandMark(),
  ]);
  // Guides always render dark. Their art is photographic and full-frame, unlike
  // the flat shelf illustrations, so a light scrim washes out the photo without
  // ever reaching the contrast that body copy needs.
  const meta = [
    `${picks} ${plural(picks, locale, ['juego', 'juegos'], ['game', 'games'])}`,
    author?.name,
  ].filter(Boolean).join(' · ');
  return asJpeg(new ImageResponse(
    <ArtCard
      art={art}
      mark={mark}
      dark
      accent="#b4502e"
      eyebrow={locale === 'es' ? 'GUÍA DE COMPRA' : 'BUYING GUIDE'}
      title={guide.title}
      description={guide.description}
      meta={meta}
    />,
    SIZE,
  ));
}

async function guideHubCard(locale: Locale, request: Request) {
  const [guides, art, mark] = await Promise.all([
    listGuides(locale),
    backdrop(GUIDE_ART_FALLBACK, request),
    brandMark(),
  ]);
  return asJpeg(new ImageResponse(
    <ArtCard
      art={art}
      mark={mark}
      dark
      accent="#b4502e"
      eyebrow={locale === 'es' ? 'EDITORIAL' : 'EDITORIAL'}
      title={locale === 'es' ? 'Guías de juegos de mesa' : 'Board game guides'}
      description={locale === 'es'
        ? 'Comparativas y listas de los mejores juegos, con precios comparados entre tiendas.'
        : 'Comparisons and best-of lists, with prices compared across stores.'}
      meta={`${guides.length} ${plural(guides.length, locale, ['guía', 'guías'], ['guide', 'guides'])}`}
    />,
    SIZE,
  ));
}

/**
 * Shelf illustration for the card background.
 *
 * `identityFor` falls back to a tint-and-motif identity with no `art`, and raw
 * BGG categories have no identity at all — both used to render a card that was
 * flat parchment with a headline on it. Borrowing the nearest in-family
 * illustration keeps every category card looking like the site it links to;
 * `other` is the designed catch-all and exists for exactly this.
 */
function shelfArt(identity: { art?: string; family?: string } | undefined, key: string): string {
  if (identity?.art) return identity.art.replace(/\.webp$/, '-hero.webp');
  const sibling = Object.values(CATEGORY_IDENTITY).find(
    (candidate) => candidate.art && candidate.family === identity?.family,
  );
  if (sibling?.art) return sibling.art.replace(/\.webp$/, '-hero.webp');
  const direct = CATEGORY_IDENTITY[key]?.art;
  return direct ? direct.replace(/\.webp$/, '-hero.webp') : '/categories/other-hero.webp';
}

/** Editorial banner shown when a guide carries no art of its own. */
const GUIDE_ART_FALLBACK = '/guides/guides-default.jpg';

/**
 * The brand mark, rasterized.
 *
 * This was drawn with two divs — a rounded square and a rotated bordered square
 * inside it — which is not the logo. It read as a generic diamond badge, and it
 * appeared on every card the site has ever shared. Satori supports only a
 * subset of SVG, so the real mark (the meeple in `public/favicon.svg`, kept
 * identical here on purpose) is rasterized through sharp and passed in as an
 * ordinary <img>, which Satori composites reliably.
 *
 * Rendered once per process: the artwork is a constant, and a card that has to
 * re-rasterize its logo on every request is paying for nothing.
 */
const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="6" fill="#B4502E" />
  <path fill="#FBF6EC" d="M12 3.1a3.15 3.15 0 0 0-3.15 3.15c0 1.18.65 2.2 1.6 2.75-2.06.69-3.6 2.16-3.6 4.12 0 .86.67 1.45 1.55 1.45h.62l-.46 4.06c-.07.62.4 1.16 1.03 1.16h1.13l.78-3.8h.46l.78 3.8h1.13c.62 0 1.1-.54 1.03-1.16l-.46-4.06h.62c.88 0 1.55-.59 1.55-1.45 0-1.96-1.54-3.43-3.6-4.12.95-.55 1.6-1.57 1.6-2.75A3.15 3.15 0 0 0 12 3.1Z" />
</svg>`;

let brandMarkPromise: Promise<string | null> | null = null;

function brandMark(): Promise<string | null> {
  brandMarkPromise ??= sharp(Buffer.from(BRAND_MARK_SVG), { density: 600 })
    .resize(96, 96)
    .png()
    .toBuffer()
    .then((png) => `data:image/png;base64,${png.toString('base64')}`)
    .catch(() => null);
  return brandMarkPromise;
}

/**
 * Full-bleed card background, cover-cropped to the card.
 *
 * Category art used to be a 640px panel pinned to the right half, and guides had
 * no generated card at all — they shared the raw banner file, so every guide
 * link previewed as an unbranded stock photo with no title on it. Both now sit
 * behind the whole 1200×630 frame, which is what makes a shared link look like
 * a page from this site rather than an image someone found.
 */
async function backdrop(path: string, request: Request): Promise<string | null> {
  try {
    const response = await fetch(new URL(path, request.url), { next: { revalidate: 86_400 } });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(SIZE.width, SIZE.height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    // Artwork is decorative: the card still carries title, count and brand.
    return null;
  }
}

/**
 * Headline size, stepped so the copy plate never grows past the card.
 *
 * The plate is sized by its content and the card is a fixed 630px, so an
 * unbounded headline pushes the byline off the bottom edge — the one line that
 * has to survive. Three lines at 58px does not fit alongside a description and
 * a meta row; these steps keep the tallest case inside ~500px.
 */
function headlineSize(text: string): number {
  if (text.length > 58) return 40;
  if (text.length > 40) return 48;
  if (text.length > 26) return 56;
  return 64;
}

/**
 * Card built on a full-bleed illustration — categories and guides.
 *
 * Two layers do the contrast work, and both are needed. The gradient scrim
 * knocks the photograph back across the left two thirds; the parchment plate
 * then puts the copy on a known surface, so contrast is a fixed number rather
 * than a function of whatever happens to be in that corner of the art. A
 * gradient alone was not enough here: shelf illustrations and product
 * photography are high-contrast and busy, and 23px body copy laid straight over
 * them is unreadable at the size a timeline actually renders a card.
 *
 * The plate is always parchment with dark ink, including on the dark shelves.
 * A dark plate would need light type, and light type over a light patch of art
 * is the exact failure the plate exists to prevent.
 */
function ArtCard({ art, mark, dark, accent, eyebrow, title, description, meta }: {
  art: string | null;
  mark: string | null;
  /** Dark artwork — deepens the scrim; the plate itself stays parchment. */
  dark: boolean;
  accent: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}) {
  const scrim = dark
    ? 'linear-gradient(90deg, rgba(20,14,11,.86) 0%, rgba(20,14,11,.74) 46%, rgba(20,14,11,.44) 70%, rgba(20,14,11,.12) 100%)'
    : 'linear-gradient(90deg, rgba(43,38,34,.42) 0%, rgba(43,38,34,.3) 46%, rgba(43,38,34,.16) 70%, rgba(43,38,34,.04) 100%)';
  return (
    <div style={{
      position: 'relative', display: 'flex', width: '100%', height: '100%',
      alignItems: 'center', overflow: 'hidden',
      background: dark ? '#1e1712' : '#f5efe3',
      borderBottom: `18px solid ${accent}`,
      fontFamily: 'Arial, sans-serif',
    }}>
      {art && <img src={art} alt="" width={SIZE.width} height={SIZE.height}
        style={{ position: 'absolute', left: 0, top: 0, width: SIZE.width, height: SIZE.height, objectFit: 'cover' }} />}
      {/* Explicit box, not `inset: 0` — Satori lays that out as a zero-width
          element, so the scrim silently collapses to a sliver at the left edge
          and the copy sits unreadable directly on the photograph. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: SIZE.width, height: SIZE.height, display: 'flex', background: scrim }} />
      <div style={{
        // Vertical margins, not `alignItems` alone: the plate is sized by its
        // content and would otherwise touch the top edge and the accent rule on
        // the tallest headlines, reading as a layout that broke rather than a card.
        zIndex: 1, display: 'flex', width: 640, flexDirection: 'column',
        marginLeft: 56, marginTop: 36, marginBottom: 36, padding: '42px 46px 46px',
        borderRadius: 28,
        background: 'rgba(255,250,241,.93)',
        border: '1px solid rgba(255,255,255,.55)',
        boxShadow: '0 30px 80px rgba(24,17,14,.42)',
      }}>
        <Brand mark={mark} />
        <div style={{ display: 'flex', marginTop: 30, color: accent, fontSize: 23, fontWeight: 800, letterSpacing: 2 }}>
          {eyebrow}
        </div>
        <div style={{ display: 'flex', marginTop: 12, color: '#2b2622', fontSize: headlineSize(title), fontWeight: 800, lineHeight: 1.06 }}>
          {title}
        </div>
        <div style={{ display: 'flex', marginTop: 18, color: '#6f6557', fontSize: 22, lineHeight: 1.32 }}>
          {truncate(description, 104)}
        </div>
        {meta && <div style={{ display: 'flex', marginTop: 24, color: '#2b2622', fontSize: 23, fontWeight: 700 }}>
          {meta}
        </div>}
      </div>
    </div>
  );
}

/**
 * Cut on a word boundary, and never against existing punctuation.
 *
 * A blind slice produces both `estrateg…` and `de dos.…` — one looks like a
 * bug, the other like a typo, and card copy is the site's shop window.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const body = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${body.replace(/[\s.,;:·—-]+$/, '')}…`;
}

function SocialFrame({ children, accent, dark = false }: {
  children: ReactNode;
  accent: string;
  dark?: boolean;
}) {
  return <div style={{
    position: 'relative', display: 'flex', width: '100%', height: '100%',
    alignItems: 'center', overflow: 'hidden', padding: 72,
    background: dark ? '#1e1712' : '#f5efe3',
    borderBottom: `18px solid ${accent}`,
    fontFamily: 'Arial, sans-serif',
  }}>{children}</div>;
}

function Brand({ mark, light = false }: { mark: string | null; light?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    {mark
      ? <img src={mark} alt="" width="46" height="46" style={{ width: 46, height: 46, borderRadius: 12 }} />
      : <div style={{ display: 'flex', width: 46, height: 46, borderRadius: 12, background: '#b4502e' }} />}
    <div style={{ display: 'flex', color: light ? '#fffaf1' : '#2b2622', fontSize: 30, fontWeight: 800 }}>Juegospedia</div>
  </div>;
}
