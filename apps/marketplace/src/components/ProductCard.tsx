export interface Product {
  id: string;
  slug: string;
  name: string;
  images: string[];
  category: string;
  tags: string[];
  description?: string;
  publisher?: string;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  bggRating?: number;
  bggWeight?: number;
  language?: string;
  minPriceMinor: number;
  maxPriceMinor: number;
  totalListings: number;
  inStockListings: number;
}

export function formatPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function ProductCard({
  product,
  onClick,
  cashbackPct = 0.01,
}: {
  product: Product;
  onClick: () => void;
  cashbackPct?: number;
}) {
  const hasStock = product.inStockListings > 0;
  const samePrice = product.minPriceMinor === product.maxPriceMinor;
  const priceLabel = samePrice
    ? formatPrice(product.minPriceMinor)
    : `${formatPrice(product.minPriceMinor)} – ${formatPrice(product.maxPriceMinor)}`;

  const playerRange =
    product.minPlayers && product.maxPlayers
      ? product.minPlayers === product.maxPlayers
        ? `${product.minPlayers} jug.`
        : `${product.minPlayers}–${product.maxPlayers} jug.`
      : null;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-stone-200 overflow-hidden
                 hover:border-emerald-400 hover:shadow-md transition-all group flex flex-col"
    >
      {/* Image */}
      <div className="aspect-square bg-stone-100 overflow-hidden relative shrink-0">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-stone-300">
            🎲
          </div>
        )}
        {/* Category badge */}
        {product.category && product.category !== 'board-game' && (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5
                           bg-white/90 text-stone-600 rounded-full border border-stone-200 truncate max-w-[80%]">
            {product.category}
          </span>
        )}
        {/* Cashback badge */}
        {hasStock && cashbackPct > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5
                           bg-emerald-500 text-white rounded-full shadow-sm">
            {Math.round(cashbackPct * 100)}% cashback
          </span>
        )}
        {!hasStock && (
          <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-2">
            <span className="text-white text-xs font-semibold bg-red-600 px-2 py-0.5 rounded-full">
              Sin stock
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="font-semibold text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-emerald-700">
          {product.name}
        </h3>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-400">
          {playerRange && <span>👥 {playerRange}</span>}
          {product.minAge ? <span>🔞 +{product.minAge}</span> : null}
          {product.playTimeMinutes ? <span>⏱ {product.playTimeMinutes} min</span> : null}
          {product.bggRating && product.bggRating > 0 ? (
            <span className="text-amber-500 font-medium">★ {product.bggRating.toFixed(1)}</span>
          ) : null}
        </div>

        <div className="mt-auto pt-1 flex items-end justify-between gap-2">
          <span className="text-sm font-bold text-stone-900">{priceLabel}</span>
          <span className={`text-xs shrink-0 ${hasStock ? 'text-emerald-600' : 'text-stone-400'}`}>
            {hasStock
              ? `${product.inStockListings} tienda${product.inStockListings > 1 ? 's' : ''}`
              : 'Sin stock'}
          </span>
        </div>
      </div>
    </button>
  );
}
