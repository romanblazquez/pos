import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
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

export default function ProductPage({ slug, onCartOpen }: { slug: string; onCartOpen: () => void }) {
  const { data: platformCfg } = usePlatformConfig();
  const platformCashback = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug),
  });

  const [selectedImage, setSelectedImage] = useState(0);
  const { add, items: cartItems } = useCart();

  if (isLoading) return <ProductSkeleton />;
  if (isError || !data) return <NotFound />;

  const p = data;
  const activeListings = p.listings.filter((l) => l.stockStatus !== 'out_of_stock');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
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
        <h2 className="text-xl font-semibold text-[--tx] mb-4">Comparar tiendas</h2>
        {p.listings.length === 0 ? (
          <p className="text-[--tx-muted] text-sm">
            Este juego no está disponible en ninguna tienda conectada por ahora.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {p.listings.map((listing, idx) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                rank={idx + 1}
                platformCashbackPct={platformCashback}
                inCartQuantity={cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0}
                onAddToCart={() => {
                  add({
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
                  onCartOpen();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ListingRow({
  listing: l, rank, onAddToCart, platformCashbackPct = 0.01, inCartQuantity = 0,
}: {
  listing: ListingDetail;
  rank: number;
  platformCashbackPct?: number;
  inCartQuantity?: number;
  onAddToCart: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const atStockLimit = l.stock > 0 && inCartQuantity >= l.stock;

  const bestDelivery = l.deliveryOptions.length
    ? l.deliveryOptions.reduce((best, d) => d.estimatedDaysMin < best.estimatedDaysMin ? d : best, l.deliveryOptions[0])
    : null;

  const stockBadge = l.stockStatus === 'in_stock'
    ? <Badge variant="success">En stock</Badge>
    : l.stockStatus === 'low_stock'
    ? <Badge variant="warning">Poco stock</Badge>
    : <Badge variant="error">Sin stock</Badge>;

  return (
    <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4
      ${rank === 1
        ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
        : 'border-[--border] bg-[--bg-raised]'}`}
    >
      {/* Rank */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
        ${rank === 1 ? 'bg-emerald-600 text-white' : 'bg-[--bg-subtle] text-[--tx-muted]'}`}
      >
        {rank}
      </div>

      {/* Seller */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
        <p className="font-semibold text-[--tx] text-sm">{l.sellerName}</p>
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
          <span className="text-xl font-bold text-[--tx] block">{fmt(l.priceMinorUnits, l.currency)}</span>
          {l.stockStatus !== 'out_of_stock' && (() => {
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
        {l.stockStatus !== 'out_of_stock' && (
          <Button onClick={onAddToCart} size="sm" disabled={atStockLimit} title={atStockLimit ? 'Ya agregaste todo el stock disponible' : undefined}>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {atStockLimit ? 'Máximo en carrito' : 'Agregar'}
          </Button>
        )}
      </div>

      {/* Score explainer */}
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
