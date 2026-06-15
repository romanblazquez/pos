import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface ProductPageProps {
  slug: string;
}

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
  const res = await fetch(`/api/v1/products/${slug}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json() as Promise<ProductDetail>;
}

function formatPrice(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(minor / 100);
}

export default function ProductPage({ slug }: ProductPageProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug),
  });

  const [selectedImage, setSelectedImage] = useState(0);

  if (isLoading) return <ProductSkeleton />;
  if (isError || !data) return <NotFound />;

  const p = data;
  const activeListings = p.listings.filter(
    (l) => l.stockStatus !== 'out_of_stock',
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100">
            {p.images[selectedImage] ? (
              <img
                src={p.images[selectedImage]}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl text-stone-300">
                🎲
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-2">
              {p.images.slice(0, 5).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImage === i ? 'border-emerald-600' : 'border-stone-200'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-4">
          {p.publisher && (
            <p className="text-sm text-stone-500">{p.publisher}</p>
          )}
          <h1 className="text-3xl font-bold text-stone-900">{p.name}</h1>

          {/* Game metadata chips */}
          <div className="flex flex-wrap gap-2">
            {p.minPlayers && p.maxPlayers && (
              <Chip icon="👥" label={`${p.minPlayers}–${p.maxPlayers} jugadores`} />
            )}
            {p.minAge && <Chip icon="🔞" label={`+${p.minAge} años`} />}
            {p.playTimeMinutes && (
              <Chip icon="⏱️" label={`${p.playTimeMinutes} min`} />
            )}
            {p.bggRating && (
              <Chip icon="⭐" label={`BGG ${p.bggRating.toFixed(1)}`} />
            )}
            {p.bggWeight && (
              <Chip icon="🧠" label={`Complejidad ${p.bggWeight.toFixed(1)}/5`} />
            )}
          </div>

          {p.description && (
            <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">
              {p.description}
            </p>
          )}

          {/* Price summary */}
          {activeListings.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-700 font-medium mb-1">
                Desde
              </p>
              <p className="text-3xl font-bold text-emerald-900">
                {formatPrice(
                  Math.min(...activeListings.map((l) => l.priceMinorUnits)),
                  activeListings[0].currency,
                )}
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                {activeListings.length} tienda{activeListings.length > 1 ? 's' : ''} con stock
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Seller comparison table */}
      <section>
        <h2 className="text-xl font-semibold text-stone-900 mb-4">
          Comparar tiendas
        </h2>
        {p.listings.length === 0 ? (
          <p className="text-stone-500 text-sm">
            Este juego no está disponible en ninguna tienda conectada por ahora.
          </p>
        ) : (
          <div className="space-y-3">
            {p.listings.map((listing, idx) => (
              <ListingRow key={listing.id} listing={listing} rank={idx + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ListingRow({ listing: l, rank }: { listing: ListingDetail; rank: number }) {
  const [showScore, setShowScore] = useState(false);
  const bestDelivery = l.deliveryOptions.reduce(
    (best, d) => (d.estimatedDaysMin < best.estimatedDaysMin ? d : best),
    l.deliveryOptions[0],
  );

  const stockColor =
    l.stockStatus === 'in_stock'
      ? 'text-emerald-600'
      : l.stockStatus === 'low_stock'
        ? 'text-amber-600'
        : 'text-red-500';

  const stockLabel =
    l.stockStatus === 'in_stock'
      ? '● En stock'
      : l.stockStatus === 'low_stock'
        ? '● Poco stock'
        : '○ Sin stock';

  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-4 flex-wrap
        ${rank === 1 ? 'border-emerald-400 bg-emerald-50/40' : 'border-stone-200 bg-white'}`}
    >
      {/* Rank badge */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
          ${rank === 1 ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}
      >
        {rank}
      </div>

      {/* Seller info */}
      <div className="flex-1 min-w-[120px]">
        <p className="font-semibold text-stone-900 text-sm">{l.sellerName}</p>
        <div className="flex items-center gap-1">
          <span className="text-xs text-amber-500">★</span>
          <span className="text-xs text-stone-500">{(l.sellerScore * 5).toFixed(1)}</span>
        </div>
      </div>

      {/* Stock */}
      <div className="shrink-0">
        <span className={`text-sm font-medium ${stockColor}`}>{stockLabel}</span>
        <p className="text-xs text-stone-400">
          Confianza {Math.round(l.stockConfidence * 100)}%
        </p>
      </div>

      {/* Best delivery */}
      {bestDelivery && (
        <div className="shrink-0 text-sm text-stone-600">
          🚚 {bestDelivery.estimatedDaysMin}–{bestDelivery.estimatedDaysMax} días
          {bestDelivery.priceMinorUnits === 0 ? (
            <span className="text-emerald-600 ml-1 text-xs">envío gratis</span>
          ) : (
            <span className="text-stone-400 ml-1 text-xs">
              {new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: l.currency,
                maximumFractionDigits: 0,
              }).format(bestDelivery.priceMinorUnits / 100)}
            </span>
          )}
        </div>
      )}

      {/* Price + CTA */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        <span className="text-xl font-bold text-stone-900">
          {new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: l.currency,
            maximumFractionDigits: 0,
          }).format(l.priceMinorUnits / 100)}
        </span>
        {l.stockStatus !== 'out_of_stock' && (
          <button
            className="px-4 py-2 bg-emerald-700 text-white text-sm font-semibold
                       rounded-lg hover:bg-emerald-800 transition-colors"
          >
            Comprar
          </button>
        )}
      </div>

      {/* Score explainer toggle */}
      <div className="w-full">
        <button
          onClick={() => setShowScore(!showScore)}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          {showScore ? '▲ Ocultar ranking' : '▼ ¿Por qué este ranking?'}
        </button>
        {showScore && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(l.scoreBreakdown).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.round(val * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-stone-400 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </p>
                <p className="text-xs font-medium text-stone-600">
                  {Math.round(val * 100)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 text-xs text-stone-600">
      {icon} {label}
    </span>
  );
}

function ProductSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-2xl bg-stone-200" />
        <div className="space-y-4">
          <div className="h-4 bg-stone-200 rounded w-1/4" />
          <div className="h-8 bg-stone-200 rounded w-3/4" />
          <div className="h-4 bg-stone-200 rounded w-1/2" />
          <div className="h-24 bg-stone-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-24 text-stone-500">
      <p className="text-5xl mb-4">🎲</p>
      <p className="text-lg font-medium">Juego no encontrado</p>
    </div>
  );
}
