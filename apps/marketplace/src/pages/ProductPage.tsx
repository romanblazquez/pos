import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gift,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { useCart } from '../cart/CartContext.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import { Badge, Button } from '../components/ui/index.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { SeoHead } from '../components/SeoHead.js';
import { categoryLabel } from '../marketplace-meta.js';
import { trackEvent } from '../analytics.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ListingDetail {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  sellerScore: number;
  priceMinorUnits: number;
  currency: string;
  stock: number;
  stockStatus: string;
  stockConfidence: number;
  rankScore: number;
  scoreBreakdown: {
    availability: number;
    priceCompetitiveness: number;
    delivery: number;
    sellerReliability: number;
    sellerQuality: number;
    integrationHealth: number;
  };
  deliveryOptions: {
    id: string;
    name: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    priceMinorUnits: number;
    type: string;
  }[];
  lastSyncedAt: string;
  storeCashbackPct: number;
  promoBonus: number;
  promoLabel: string | null;
}

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
  tags: string[];
  listings: ListingDetail[];
}

async function fetchProduct(slug: string): Promise<ProductDetail> {
  const res = await fetch(`${API}/api/v1/products/${slug}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json() as Promise<ProductDetail>;
}

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export default function ProductPage({
  slug,
  onCartOpen,
  onHome,
  onCategory,
}: {
  slug: string;
  onCartOpen: () => void;
  onHome: () => void;
  onCategory: (category: string) => void;
}) {
  const { data: platformCfg } = usePlatformConfig();
  const platformCashback = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug),
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
      currency: data.listings[0]?.currency ?? 'MXN',
      value: prices.length ? Math.min(...prices) / 100 : 0,
      items: [{
        item_id: data.id,
        item_name: data.name,
        item_category: data.category,
      }],
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
  const lowestPriceId = activeListings.length
    ? activeListings.reduce((best, l) => (l.priceMinorUnits < best.priceMinorUnits ? l : best), activeListings[0]).id
    : null;
  const minPrice = activeListings.length ? Math.min(...activeListings.map((listing) => listing.priceMinorUnits)) : 0;
  const maxPrice = activeListings.length ? Math.max(...activeListings.map((listing) => listing.priceMinorUnits)) : 0;
  const currency = activeListings[0]?.currency ?? 'MXN';
  const canonicalUrl = `https://juegospedia.com/product/${p.slug}`;
  const description = plainText(p.description) ||
    `${p.name}: compara precios, stock, envío y tiendas disponibles en México.`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://juegospedia.com/' },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryLabel(p.category),
            item: `https://juegospedia.com/search?category=${encodeURIComponent(p.category)}`,
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
        category: categoryLabel(p.category),
        ...(p.publisher ? { brand: { '@type': 'Brand', name: p.publisher } } : {}),
        ...(p.bggId ? { sku: `BGG-${p.bggId}` } : {}),
        ...(p.bggRating && p.bggRating > 0 && p.listings.length > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: p.bggRating.toFixed(1),
                bestRating: '10',
                ratingCount: Math.max(p.listings.length, 1),
              },
            }
          : {}),
        offers: {
          '@type': 'AggregateOffer',
          url: canonicalUrl,
          priceCurrency: currency,
          lowPrice: (minPrice / 100).toFixed(2),
          highPrice: (maxPrice / 100).toFixed(2),
          offerCount: activeListings.length,
          availability: activeListings.length > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <SeoHead
        title={`${p.name} — precio y disponibilidad | Juegospedia`}
        description={description.slice(0, 160)}
        path={`/product/${p.slug}`}
        image={p.images[0]}
        type="product"
        jsonLd={productJsonLd}
      />
      <Breadcrumbs items={[
        { label: 'Inicio', href: '/', onClick: onHome },
        {
          label: categoryLabel(p.category),
          href: `/search?category=${encodeURIComponent(p.category)}`,
          onClick: () => onCategory(p.category),
        },
        { label: p.name },
      ]} />
      <div className="grid md:grid-cols-2 gap-8 mb-10">

        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square rounded-2xl overflow-hidden bg-[--bg-subtle]">
            {p.images[selectedImage] ? (
              <img src={p.images[selectedImage]} alt={p.name} className="w-full h-full object-cover" />
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
                    ${selectedImage === i ? 'border-emerald-500' : 'border-[--border]'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {p.publisher && <p className="text-sm text-[--tx-muted]">{p.publisher}</p>}
          <h1 className="text-3xl font-bold text-[--tx]">{p.name}</h1>

          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2">
            {p.minPlayers && p.maxPlayers && (
              <Chip icon={<Users className="h-3.5 w-3.5" />} label={`${p.minPlayers}-${p.maxPlayers} jugadores`} />
            )}
            {p.minAge && <Chip icon={<ShieldCheck className="h-3.5 w-3.5" />} label={`+${p.minAge} años`} />}
            {p.playTimeMinutes && <Chip icon={<Clock3 className="h-3.5 w-3.5" />} label={`${p.playTimeMinutes} min`} />}
            {p.bggRating && <Chip icon={<Star className="h-3.5 w-3.5 fill-current" />} label={`BGG ${p.bggRating.toFixed(1)}`} />}
            {p.bggWeight && <Chip icon={<Brain className="h-3.5 w-3.5" />} label={`Complejidad ${p.bggWeight.toFixed(1)}/5`} />}
          </div>

          {p.description && (
            <div
              className="text-sm text-[--tx-muted] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          )}

          {/* Price summary */}
          {activeListings.length > 0 && (() => {
            const bestCashback = Math.max(...activeListings.map(
              (l) => platformCashback + l.storeCashbackPct + l.promoBonus,
            ));
            return (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950
                              border border-emerald-200 dark:border-emerald-800 flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Desde</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    {activeListings.length} tienda{activeListings.length > 1 ? 's' : ''} con stock
                  </p>
                </div>
                <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200">
                  {fmt(Math.min(...activeListings.map((l) => l.priceMinorUnits)), activeListings[0].currency)}
                </p>
                {bestCashback > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Hasta {Math.round(bestCashback * 100)}% en créditos
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">
                        {Math.round(platformCashback * 100)}% libres en todo el marketplace
                        {bestCashback > platformCashback && ` + hasta ${Math.round((bestCashback - platformCashback) * 100)}% exclusivos de tienda`}
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
      <section>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-xl font-semibold text-[--tx]">Comparar tiendas</h2>
          {inStockListings.length > 0 && (
            <span className="text-xs text-[--tx-faint]">
              {inStockListings.length} con stock{outOfStockListings.length > 0 && ` · ${outOfStockListings.length} agotada${outOfStockListings.length > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <p className="text-xs text-[--tx-faint] mb-4">
          Ordenado por mejor combinación de precio, confianza del vendedor y entrega — fijate en
          el precio si solo te importa pagar menos.
        </p>

        {p.listings.length === 0 ? (
          <p className="text-[--tx-muted] text-sm">
            Este juego no está disponible en ninguna tienda conectada por ahora.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Column header — desktop only, helps scanning a multi-row comparison */}
            <div className="hidden md:flex items-center gap-4 px-4 text-[11px] uppercase tracking-wide text-[--tx-faint]">
              <span className="w-7 shrink-0" />
              <span className="flex-1 min-w-[120px]">Tienda</span>
              <span className="w-24 shrink-0">Stock</span>
              <span className="w-32 shrink-0">Entrega</span>
              <span className="ml-auto">Precio</span>
            </div>

            {inStockListings.map((listing, idx) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                rank={idx + 1}
                isBestPrice={listing.id === lowestPriceId}
                platformCashbackPct={platformCashback}
                inCartQuantity={cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0}
                onAddToCart={() => {
                  const inCart = cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0;
                  if (listing.stock <= 0 || inCart >= listing.stock) {
                    setToast(`"${listing.sellerName}" ya no tiene más stock disponible para agregar.`);
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
                    setToast(`Tu carrito tiene productos de otra tienda. Vaciá el carrito para comprar en "${listing.sellerName}".`);
                    return;
                  }
                  onCartOpen();
                }}
              />
            ))}

            {outOfStockListings.length > 0 && (
              <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-[--border] border-dashed">
                <p className="text-xs font-medium text-[--tx-faint]">Agotado por ahora</p>
                {outOfStockListings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    rank={0}
                    isBestPrice={false}
                    platformCashbackPct={platformCashback}
                    inCartQuantity={0}
                    onAddToCart={() => {
                      setToast(`"${listing.sellerName}" está agotado en este momento.`);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Add-to-cart guardrail feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                        max-w-[90vw] rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/90
                        backdrop-blur-md shadow-lg px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

function plainText(html?: string) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function ListingRow({
  listing: l, rank, onAddToCart, platformCashbackPct = 0.01, inCartQuantity = 0, isBestPrice = false,
}: {
  listing: ListingDetail;
  rank: number;
  platformCashbackPct?: number;
  inCartQuantity?: number;
  isBestPrice?: boolean;
  onAddToCart: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const [peeking, setPeeking] = useState(false); // press-and-hold reveal on out-of-stock rows
  const isOutOfStock = l.stockStatus === 'out_of_stock' || l.stock <= 0;
  const atStockLimit = !isOutOfStock && inCartQuantity >= l.stock;
  const isBestOverall = rank === 1 && !isOutOfStock;
  const showGlass = isOutOfStock && !peeking;
  const peekHandlers = isOutOfStock
    ? {
        onMouseDown: () => setPeeking(true),
        onMouseUp: () => setPeeking(false),
        onMouseLeave: () => setPeeking(false),
        onTouchStart: () => setPeeking(true),
        onTouchEnd: () => setPeeking(false),
        onTouchCancel: () => setPeeking(false),
      }
    : {};

  const bestDelivery = l.deliveryOptions.length
    ? l.deliveryOptions.reduce((best, d) => d.estimatedDaysMin < best.estimatedDaysMin ? d : best, l.deliveryOptions[0])
    : null;

  const stockBadge = isOutOfStock
    ? <Badge variant="error">Sin stock</Badge>
    : l.stockStatus === 'low_stock'
    ? <Badge variant="warning">Poco stock</Badge>
    : <Badge variant="success">En stock</Badge>;

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-wrap items-center gap-4 transition-colors
      ${isBestOverall
        ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
        : 'border-[--border] bg-[--bg-raised]'}
      ${isOutOfStock ? 'opacity-70 select-none cursor-pointer [-webkit-touch-callout:none]' : ''}`}
      {...peekHandlers}
    >
      {/* Glass overlay — out-of-stock rows are visually "frosted" by default so a customer
          doesn't mistake them for purchasable. Press-and-hold temporarily clears it (sets
          `peeking`) so they can still read the price/seller underneath; releasing re-applies it. */}
      {showGlass && (
        <div className="absolute inset-0 rounded-xl backdrop-blur-[2px] bg-white/40 dark:bg-black/30
                        grayscale flex items-center justify-center pointer-events-none select-none
                        [-webkit-touch-callout:none] will-change-[backdrop-filter] transition-opacity">
          <span className="px-3 py-1 rounded-full bg-[--bg-raised]/90 border border-[--border] text-xs font-medium text-[--tx-muted] shadow-sm select-none">
            No disponible por ahora · mantené presionado para ver
          </span>
        </div>
      )}

      {/* Rank / best-overall marker */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
        ${isBestOverall ? 'bg-emerald-600 text-white' : 'bg-[--bg-subtle] text-[--tx-muted]'}`}
      >
        {isBestOverall ? <Award className="h-3.5 w-3.5" aria-hidden="true" /> : rank || '–'}
      </div>

      {/* Seller */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-[--tx] text-sm">{l.sellerName}</p>
          {isBestOverall && <Badge variant="success">Mejor oferta</Badge>}
          {isBestPrice && !isBestOverall && <Badge variant="info">Precio más bajo</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-amber-500">★</span>
          <span className="text-xs text-[--tx-muted]">{(l.sellerScore * 5).toFixed(1)}</span>
        </div>
      </div>

      {/* Stock */}
      <div className="flex flex-col gap-0.5 shrink-0">
        {stockBadge}
        <p className="text-xs text-[--tx-faint]">Conf. {Math.round(l.stockConfidence * 100)}%</p>
      </div>

      {/* Delivery */}
      {bestDelivery && (
        <div className="inline-flex shrink-0 items-center gap-1.5 text-sm text-[--tx-muted]">
          <Truck className="h-4 w-4" aria-hidden="true" />
          {bestDelivery.estimatedDaysMin}-{bestDelivery.estimatedDaysMax} días
          {bestDelivery.priceMinorUnits === 0 ? (
            <span className="text-emerald-600 ml-1 text-xs font-medium">gratis</span>
          ) : (
            <span className="text-[--tx-faint] ml-1 text-xs">{fmt(bestDelivery.priceMinorUnits, l.currency)}</span>
          )}
        </div>
      )}

      {/* Price + CTA */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        <div className="text-right">
          <span
            className={`text-xl font-bold block select-none transition-[filter] duration-300
              ${isBestPrice ? 'text-emerald-700 dark:text-emerald-400' : 'text-[--tx]'}
              ${showGlass ? 'blur-[5px]' : 'blur-0'}`}
          >
            {/* Out-of-stock & not currently held: the real price never enters the DOM at all
                (a fake digit mask renders instead), so it can't be read via inspect-element —
                only swapped in while `peeking` is true. */}
            {showGlass ? '$ X,XXX' : fmt(l.priceMinorUnits, l.currency)}
          </span>
          {!isOutOfStock && (() => {
            const totalCb = platformCashbackPct + l.storeCashbackPct + l.promoBonus;
            if (totalCb <= 0) return null;
            return (
              <div className="text-right mt-0.5">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{Math.round(totalCb * 100)}% créditos
                </span>
                {(l.storeCashbackPct > 0 || l.promoBonus > 0) && (
                  <p className="text-[10px] text-[--tx-faint] leading-tight">
                    {Math.round(platformCashbackPct * 100)}% libres
                    {l.storeCashbackPct > 0 && ` + ${Math.round(l.storeCashbackPct * 100)}% tienda`}
                    {l.promoBonus > 0 && ` + ${Math.round(l.promoBonus * 100)}% promo`}
                  </p>
                )}
                {l.promoLabel && <p className="text-[10px] text-amber-500 font-medium">{l.promoLabel}</p>}
              </div>
            );
          })()}
        </div>
        {!isOutOfStock && (
          <Button onClick={onAddToCart} size="sm" disabled={atStockLimit} title={atStockLimit ? 'Ya agregaste todo el stock disponible' : undefined}>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {atStockLimit ? 'Máximo en carrito' : 'Agregar'}
          </Button>
        )}
      </div>

      {/* Score explainer */}
      {!isOutOfStock && (
        <div className="w-full">
          <button
            onClick={() => setShowScore(!showScore)}
            className="inline-flex items-center gap-1 rounded-lg border border-[--border] bg-[--bg-subtle] px-2 py-1 text-xs text-[--tx-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
          >
            {showScore ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {showScore ? 'Ocultar ranking' : 'Por qué este ranking'}
          </button>
          {showScore && (
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(l.scoreBreakdown).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className="h-1.5 bg-[--bg-subtle] rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-[--tx-faint] capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </p>
                  <p className="text-xs font-medium text-[--tx-muted]">{Math.round(val * 100)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full
                     bg-[--bg-subtle] text-xs text-[--tx-muted] font-medium">
      {icon} {label}
    </span>
  );
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
  return (
    <div className="text-center py-24 text-[--tx-muted]">
      <PackageCheck className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
      <p className="text-lg font-medium text-[--tx]">Juego no encontrado</p>
    </div>
  );
}
