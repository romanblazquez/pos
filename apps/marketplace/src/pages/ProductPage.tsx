import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Brain,
  Clock3,
  Gift,
  PackageCheck,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { useCart } from '../cart/CartContext.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { SeoHead } from '../components/SeoHead.js';
import { SellerOfferComparisonTable, type ListingDetail } from '../components/SellerOfferComparisonTable.js';
import { categoryLabel } from '../marketplace-meta.js';
import { trackEvent } from '../analytics.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmt(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
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
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-8">
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
      <div className="mb-12 grid gap-8 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] lg:gap-14">

        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="aspect-[3/4] overflow-hidden rounded-[14px] border border-[--border] bg-[--bg-subtle] shadow-sm">
            {p.images[selectedImage] ? (
              <img src={p.images[selectedImage]} alt={p.name} className="h-full w-full object-contain p-5" />
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
                  <img src={img} alt="" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4 lg:pt-2">
          {p.publisher && <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-700">{p.publisher}</p>}
          <h1 className="max-w-[18ch] font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.035em] text-[--tx] sm:text-5xl">{p.name}</h1>

          {/* Metadata chips */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
              <div className="flex flex-col gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Desde</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    {activeListings.length} tienda{activeListings.length > 1 ? 's' : ''} con stock
                  </p>
                </div>
                <p className="font-display text-4xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-200">
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
      <SellerOfferComparisonTable
        allListings={p.listings}
        inStockListings={inStockListings}
        outOfStockListings={outOfStockListings}
        lowestPriceId={lowestPriceId}
        platformCashbackPct={platformCashback}
        cartItems={cartItems}
        onAddToCart={(listing) => {
          if (listing.stock <= 0) {
            setToast(`"${listing.sellerName}" está agotado en este momento.`);
            return;
          }
          const inCart = cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0;
          if (inCart >= listing.stock) {
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

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[13px] border border-[--border]
                     bg-[--bg-raised] px-3 py-2 text-center text-[11px] font-medium text-[--tx-muted] shadow-sm">
      <span className="text-emerald-700">{icon}</span>
      <span className="font-mono">{label}</span>
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
