import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import sharp from 'sharp';
import { getProduct, listProducts } from '@/lib/api';
import { CATEGORY_IDENTITY, identityFor } from '@/lib/category-identity';
import { getThemeBySlug } from '@/lib/themes';
import { isLocale, type Locale } from '@/lib/segments';

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

async function asJpeg(card: ImageResponse): Promise<Response> {
  const png = Buffer.from(await card.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CARD_CACHE },
  });
}


function cleanSlug(value: string | null): string {
  // The public URL is /og/{kind}/{locale}/{slug}.png (see next.config.mjs) —
  // a query-free path, because robots.txt disallows `/api/` and `/*?*` and the
  // crawlers that build social cards obey it. Depending on how the rewrite
  // splits the segment, the extension can arrive attached to the slug, so strip
  // it here rather than depending on path-to-regexp's handling of a literal dot.
  const slug = (value ?? '').replace(/\.(jpe?g|png)$/, '');
  return /^[a-z0-9][a-z0-9-]{0,180}$/.test(slug) ? slug : '';
}

function money(minor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(minor / 100);
}

/**
 * Social card images, addressed entirely by path: /og/{kind}/{locale}/{slug}.png
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
  const kind = params.kind;
  if (!slug || (kind !== 'product' && kind !== 'category')) {
    return new Response('Invalid social card request', { status: 400 });
  }

  if (kind === 'product') {
    const product = await getProduct(slug, locale);
    if (!product) return new Response('Product not found', { status: 404 });
    const available = product.listings.filter((listing) =>
      listing.stockStatus !== 'out_of_stock' && listing.stock > 0);
    const prices = available.map((listing) => listing.priceMinorUnits);
    const currency = available[0]?.currency ?? 'MXN';
    const price = prices.length ? money(Math.min(...prices), currency, locale) : null;
    return asJpeg(new ImageResponse(
      <SocialFrame accent="#b4502e">
        <div style={{ display: 'flex', width: 480, height: 480, alignItems: 'center', justifyContent: 'center' }}>
          {product.images[0]
            ? <img src={product.images[0]} alt="" width="480" height="480"
                style={{ width: 480, height: 480, objectFit: 'cover', borderRadius: 32, boxShadow: '0 28px 70px rgba(43,38,34,.24)' }} />
            : <div style={{ display: 'flex', fontSize: 180 }}>🎲</div>}
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', paddingLeft: 56 }}>
          <Brand />
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
                ? `${available.length} ${locale === 'es' ? 'ofertas' : 'offers'}`
                : (locale === 'es' ? 'Ficha del juego' : 'Game profile')}
            </div>
          </div>
        </div>
      </SocialFrame>,
      SIZE,
    ));
  }

  const theme = getThemeBySlug(locale, slug);
  const key = theme?.key ?? slug;
  const identity = theme ? identityFor(theme) : CATEGORY_IDENTITY[key];
  const { total } = await listProducts({ category: key, locale, limit: 1 });
  const label = theme?.label[locale] ?? slug.split('-').map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const description = theme?.description[locale]
    ?? (locale === 'es' ? 'Descubre y compara juegos de mesa de esta categoría.' : 'Discover and compare board games in this category.');
  const art = identity?.art
    ? await imageDataUrl(new URL(identity.art.replace(/\.webp$/, '-hero.webp'), request.url))
    : null;
  return asJpeg(new ImageResponse(
    <SocialFrame accent={identity?.accent ?? '#b4502e'} dark={identity?.dark}>
      {art && <img src={art} alt="" width="640" height="630"
        style={{ position: 'absolute', right: 0, top: 0, width: 640, height: 630, objectFit: 'cover', opacity: identity?.dark ? .9 : .82 }} />}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        background: `linear-gradient(90deg, ${identity?.dark ? '#18110e' : '#fffaf1'} 0%, ${identity?.dark ? 'rgba(24,17,14,.98)' : 'rgba(255,250,241,.98)'} 48%, ${identity?.dark ? 'rgba(24,17,14,.35)' : 'rgba(255,250,241,.28)'} 78%, transparent 100%)`,
      }} />
      <div style={{ zIndex: 1, display: 'flex', width: 520, flexDirection: 'column', padding: '68px 0 60px 72px' }}>
        <Brand light={identity?.dark} />
        <div style={{ display: 'flex', marginTop: 70, color: identity?.dark ? '#f4c96f' : identity?.accent ?? '#b4502e', fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>
          {locale === 'es' ? 'EXPLORA LA COLECCIÓN' : 'EXPLORE THE COLLECTION'}
        </div>
        <div style={{ display: 'flex', marginTop: 14, color: identity?.dark ? '#fffaf1' : '#2b2622', fontSize: label.length > 32 ? 54 : 66, fontWeight: 850, lineHeight: 1 }}>
          {label}
        </div>
        <div style={{ display: 'flex', marginTop: 22, color: identity?.dark ? '#e7ddca' : '#6f6557', fontSize: 23, lineHeight: 1.3 }}>
          {description.slice(0, 115)}
        </div>
        <div style={{ display: 'flex', marginTop: 30, color: identity?.dark ? '#fffaf1' : '#2b2622', fontSize: 24, fontWeight: 700 }}>
          {total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} {locale === 'es' ? 'juegos' : 'games'}
        </div>
      </div>
    </SocialFrame>,
    SIZE,
  ));
}

async function imageDataUrl(url: URL): Promise<string | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 86_400 } });
    if (!response.ok) return null;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(640, 630, { fit: 'cover' })
      .jpeg({ quality: 84 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    // Artwork is decorative: social metadata remains useful if an asset is down.
    return null;
  }
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

function Brand({ light = false }: { light?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ display: 'flex', width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: '#b4502e' }}>
      <div style={{ display: 'flex', width: 22, height: 22, border: '3px solid #fffaf1', borderRadius: 7, transform: 'rotate(45deg)' }} />
    </div>
    <div style={{ display: 'flex', color: light ? '#fffaf1' : '#2b2622', fontSize: 30, fontWeight: 800 }}>Juegospedia</div>
  </div>;
}
