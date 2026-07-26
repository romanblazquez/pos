import { withMarket } from '../lib/api-client.js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { AlertTriangle, Gift, PackageCheck } from 'lucide-react';
import { useCart } from '../cart/CartContext.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import { useMarket } from '../context/MarketContext.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import {
  SITE_ORIGIN,
  canonicalHomeUrl,
  canonicalProductUrl,
  majorUnits,
  socialCardUrl,
  type SeoLocale,
} from '@retail-os/ui-react';
import { SeoHead } from '../components/SeoHead.js';
import { SellerOfferComparisonTable, type ListingDetail } from '../components/SellerOfferComparisonTable.js';
import { GameInfoBadges } from '../components/GameInfoBadges.js';
import { ShelfButtons } from '../components/ShelfButtons.js';
import { ProductStatsPanel } from '../components/ProductStatsPanel.js';
import { SimilarProducts } from '../components/SimilarProducts.js';
import { ProductShareButton } from '../components/ProductShareButton.js';
import { categoryLabel, formatMoney } from '../marketplace-meta.js';
import { trackEvent } from '../analytics.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string;
  images: string[];
  publisher?: string;
  designer?: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  language?: string;
  bggId?: string;
  bggRating?: number;
  bggWeight?: number;
  bggRank?: number | null;
  bggUsersRated?: number | null;
  isExpansion?: boolean;
  tags: string[];
  listings: ListingDetail[];
}

async function fetchProduct(slug: string, locale: string): Promise<ProductDetail> {
  const params = withMarket(new URLSearchParams({ locale }));
  const res = await fetch(`${API}/api/v1/products/${slug}?${params}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json() as Promise<ProductDetail>;
}

export default function ProductPage({
  slug,
  onCartOpen,
  onHome,
  onCategory,
  onProduct,
}: {
  slug: string;
  onCartOpen: () => void;
  onHome: () => void;
  onCategory: (category: string) => void;
  onProduct: (slug: string) => void;
}) {
  const intl = useIntl();
  const { data: platformCfg } = usePlatformConfig();
  // The market decides the canonical URL and which offers may be published.
  const { countryCode, currencyCode } = useMarket();
  const platformCashback = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug, intl.locale],
    queryFn: () => fetchProduct(slug, intl.locale),
  });

  const [selectedImage, setSelectedImage] = useState(0);
  const { add, items: cartItems } = useCart();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!data) return;
    const prices = data.listings.map((listing) => listing.priceMinorUnits);
    trackEvent('view_item', {
      entityType: 'game',
      entityId: data.id,
      slug: data.slug,
      currency: data.listings[0]?.currency ?? 'MXN',
      priceMinor: prices.length ? Math.min(...prices) : 0,
    });
  }, [data]);

  if (isLoading) return <ProductSkeleton />;
  if (isError || !data) return <NotFound />;

  const p = data;
  const isAvailable = (l: ListingDetail) => l.stockStatus !== 'out_of_stock' && l.stock > 0;
  // Backend orders by rankScore (price/seller-quality/availability blend), preserved within
  // each group — but a sold-out listing should never sit above ones a customer can actually
  // buy, so split into "available" and "sold out" groups rather than mixing by raw rank.
  const activeListings = p.listings.filter(isAvailable);
  const inStockListings = activeListings;
  const outOfStockListings = p.listings.filter((l) => !isAvailable(l));
  const shareLocale: SeoLocale = intl.locale === 'en' ? 'en' : 'es';
  // Canonical and card URLs come from the shared rules, so this page and the
  // public site cannot disagree about where a product lives. Previously this
  // pointed at a language-only URL that the public site 301s away, and at an
  // /api/og card that robots.txt blocks.
  const canonicalUrl = canonicalProductUrl(shareLocale, countryCode, p.slug);
  const socialImage = socialCardUrl('product', shareLocale, p.slug);

  // Offers this page may publish as structured data: a real price, a well-formed
  // currency, and the currency this market actually trades in. Taking
  // `priceCurrency` from whichever offer sorted first — which is what this did —
  // can label Argentine amounts as pesos on a Mexican page, and structured data
  // is where Google treats that as a claim about the price.
  const publishable = activeListings.filter((listing) => {
    const code = listing.currency?.trim().toUpperCase() ?? '';
    return /^[A-Z]{3}$/.test(code) && listing.priceMinorUnits > 0 && code === currencyCode.toUpperCase();
  });
  const publishedPrices = publishable.map((listing) => majorUnits(listing.priceMinorUnits, listing.currency));
  const description = plainText(p.description) ||
    `${p.name}: compara precios, stock, envío y tiendas disponibles en México.`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: canonicalHomeUrl(shareLocale, countryCode) },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryLabel(p.category, intl.locale as 'es' | 'en'),
            // Must resolve on the canonical host; /search?category= does not
            // exist there, and a breadcrumb to a 404 is worse than none.
            item: `${SITE_ORIGIN}/${shareLocale}-${countryCode.toLowerCase()}/${shareLocale === 'es' ? 'categorias' : 'categories'}`,
          },
          { '@type': 'ListItem', position: 3, name: p.name, item: canonicalUrl },
        ],
      },
      {
        '@type': 'Product',
        name: p.name,
        description,
        image: p.images,
        url: canonicalUrl,
        category: categoryLabel(p.category, intl.locale as 'es' | 'en'),
        ...(p.publisher ? { brand: { '@type': 'Brand', name: p.publisher } } : {}),
        ...(p.bggId ? { sku: `BGG-${p.bggId}` } : {}),
        // No publishable offer means no `offers` node at all — a page with
        // nothing for sale must not invent a price for Google.
        ...(publishable.length ? { offers: {
          '@type': 'AggregateOffer',
          url: canonicalUrl,
          // A fact about the surviving offers, not a guess from the first one.
          priceCurrency: publishable[0].currency.trim().toUpperCase(),
          lowPrice: Math.min(...publishedPrices).toFixed(2),
          highPrice: Math.max(...publishedPrices).toFixed(2),
          offerCount: publishable.length,
          availability: 'https://schema.org/InStock',
          offers: publishable.map((listing) => {
            const shipping = listing.deliveryOptions.length
              ? listing.deliveryOptions.reduce((best, option) => option.priceMinorUnits < best.priceMinorUnits ? option : best)
              : null;
            return {
              '@type': 'Offer',
              // Scale comes from the currency, never a hardcoded hundred: CLP
              // and JPY have no minor unit and would be inflated 100x.
              price: majorUnits(listing.priceMinorUnits, listing.currency).toFixed(2),
              priceCurrency: listing.currency.trim().toUpperCase(),
              availability: 'https://schema.org/InStock',
              itemCondition: schemaCondition(listing.condition),
              seller: { '@type': 'Organization', name: listing.sellerName },
              ...(shipping ? {
                shippingDetails: {
                  '@type': 'OfferShippingDetails',
                  shippingRate: {
                    '@type': 'MonetaryAmount',
                    value: majorUnits(shipping.priceMinorUnits, listing.currency).toFixed(2),
                    currency: listing.currency.trim().toUpperCase(),
                  },
                  deliveryTime: {
                    '@type': 'ShippingDeliveryTime',
                    transitTime: {
                      '@type': 'QuantitativeValue',
                      minValue: shipping.estimatedDaysMin,
                      maxValue: shipping.estimatedDaysMax,
                      unitCode: 'DAY',
                    },
                  },
                },
              } : {}),
            };
          }),
        } } : {}),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[1200px] overflow-x-clip px-3 py-5 sm:px-4 sm:py-8">
      <SeoHead
        title={`${p.name} — precio y disponibilidad | Juegospedia`}
        description={description.slice(0, 160)}
        path={new URL(canonicalUrl).pathname}
        image={socialImage}
        type="product"
        jsonLd={productJsonLd}
      />
      <Breadcrumbs items={[
        { label: intl.formatMessage({ id: 'product.home' }), href: '/', onClick: onHome },
        {
          label: categoryLabel(p.category, intl.locale as 'es' | 'en'),
          href: `/search?category=${encodeURIComponent(p.category)}`,
          onClick: () => onCategory(p.category),
        },
        { label: p.name },
      ]} />
      <GameInfoBadges
        minPlayers={p.minPlayers}
        maxPlayers={p.maxPlayers}
        minAge={p.minAge}
        playTimeMinutes={p.playTimeMinutes}
        bggRating={p.bggRating}
        bggWeight={p.bggWeight}
        language={p.language}
      />
      <div className="mb-12 grid min-w-0 gap-6 sm:gap-8 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] lg:gap-14">

        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full overflow-hidden rounded-[14px] border border-[--border] bg-[--bg-subtle] shadow-sm lg:sticky lg:top-6">
            {p.images[selectedImage] ? (
              <img src={p.images[selectedImage]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[--tx-faint]">
                <PackageCheck className="h-16 w-16" aria-hidden="true" />
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-2">
              {p.images.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 bg-[--bg-subtle] transition-colors
                    ${selectedImage === i ? 'border-[--accent]' : 'border-[--border]'}`}
                >
                  <img src={img} alt="" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex flex-col gap-4 lg:pt-2">
          {p.publisher && <p className="font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">{p.publisher}</p>}
          <h1 className="max-w-[18ch] break-words font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.035em] text-[--tx] sm:text-5xl">{p.name}</h1>

          <ProductStatsPanel
            slug={p.slug}
            minAge={p.minAge}
            playTimeMinutes={p.playTimeMinutes}
            bggRating={p.bggRating}
            bggWeight={p.bggWeight}
            minPlayers={p.minPlayers}
            maxPlayers={p.maxPlayers}
            bggRank={p.bggRank}
            bggUsersRated={p.bggUsersRated}
            isExpansion={p.isExpansion}
          />

          {p.description && (
            <div
              className="max-w-[70ch] text-base leading-relaxed text-[--tx-muted]"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          )}

          {/* Price summary */}
          {activeListings.length > 0 && (() => {
            const bestCashback = Math.max(...activeListings.map(
              (l) => platformCashback + l.storeCashbackPct + l.promoBonus,
            ));
            return (
              <div className="flex flex-col gap-2 rounded-[14px] border border-[--success-border] bg-[--success-bg] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-[--success] font-medium">{intl.formatMessage({ id: 'product.from' })}</p>
                  <p className="text-xs text-[--success]">
                    {intl.formatMessage({ id: 'product.storesWithStock' }, { count: activeListings.length })}
                  </p>
                </div>
                <p className="font-display text-4xl font-extrabold tracking-tight text-[--success]">
                  {formatMoney(Math.min(...activeListings.map((l) => l.priceMinorUnits)), activeListings[0].currency)}
                </p>
                {bestCashback > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-[--success-border]">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[--success]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-[--success]">
                        {intl.formatMessage({ id: 'product.upToCashback' }, { pct: Math.round(bestCashback * 100) })}
                      </p>
                      <p className="text-xs text-[--success]">
                        {intl.formatMessage({ id: 'product.freeCashback' }, { pct: Math.round(platformCashback * 100) })}
                        {bestCashback > platformCashback && intl.formatMessage({ id: 'product.extraStoreCashback' }, { pct: Math.round((bestCashback - platformCashback) * 100) })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Listings comparison */}
      <SellerOfferComparisonTable
        allListings={p.listings}
        inStockListings={inStockListings}
        outOfStockListings={outOfStockListings}
        platformCashbackPct={platformCashback}
        cartItems={cartItems}
        onAddToCart={(listing) => {
          if (listing.stock <= 0) {
            setToast(intl.formatMessage({ id: 'product.outOfStockToast' }, { sellerName: listing.sellerName }));
            return;
          }
          const inCart = cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0;
          if (inCart >= listing.stock) {
            setToast(intl.formatMessage({ id: 'product.stockLimitToast' }, { sellerName: listing.sellerName }));
            return;
          }
          const result = add({
            listingId: listing.id,
            productName: p.name,
            sellerId: listing.sellerId,
            sellerName: listing.sellerName,
            priceMinorUnits: listing.priceMinorUnits,
            currency: listing.currency,
            quantity: 1,
            stock: listing.stock,
            imageUrl: p.images[0],
          });
          if (result === 'different_seller') {
            setToast(intl.formatMessage({ id: 'product.differentSellerToast' }, { sellerName: listing.sellerName }));
            return;
          }
          if (result === 'different_currency') {
            setToast(intl.formatMessage({ id: 'product.differentCurrencyToast' }, { currency: listing.currency }));
            return;
          }
          onCartOpen();
        }}
      />

      {/* Shelf */}
      <div className="border-t border-[--border] pt-4 mt-6">
        <p className="font-mono text-xs uppercase tracking-wide text-[--tx-faint] mb-2">{intl.formatMessage({ id: 'product.myShelf' })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ShelfButtons slug={p.slug} name={p.name} />
          <ProductShareButton slug={p.slug} name={p.name} locale={shareLocale} />
        </div>
      </div>

      <SimilarProducts slug={p.slug} onSelect={onProduct} />

      {/* Add-to-cart guardrail feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                        max-w-[90vw] rounded-xl border border-[--warning-border] bg-[--warning-bg]
                        backdrop-blur-md shadow-lg px-4 py-2.5 text-sm text-[--warning]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

function schemaCondition(condition: string): string {
  if (condition === 'new') return 'https://schema.org/NewCondition';
  if (condition === 'damaged') return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
}

function plainText(html?: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}


function ProductSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-2xl bg-[--bg-subtle] animate-pulse" />
        <div className="flex flex-col gap-4">
          <div className="h-4 bg-[--bg-subtle] rounded animate-pulse w-1/4" />
          <div className="h-8 bg-[--bg-subtle] rounded animate-pulse w-3/4" />
          <div className="h-4 bg-[--bg-subtle] rounded animate-pulse w-1/2" />
          <div className="h-24 bg-[--bg-subtle] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const intl = useIntl();
  return (
    <div className="text-center py-24 text-[--tx-muted]">
      <PackageCheck className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
      <p className="text-lg font-medium text-[--tx]">{intl.formatMessage({ id: 'product.notFound' })}</p>
    </div>
  );
}
