import { Clock3, Gift, PackageCheck, Star, Tags, Users } from 'lucide-react';
import { categoryLabel, formatMoney } from '../marketplace-meta.js';

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

export function ProductCard({ product, onClick, cashbackPct = 0.01, priority = false }: {
  product: Product;
  onClick: () => void;
  cashbackPct?: number;
  priority?: boolean;
}) {
  const hasStock = product.inStockListings > 0;
  const samePrice = product.minPriceMinor === product.maxPriceMinor;
  const priceLabel = samePrice
    ? formatMoney(product.minPriceMinor)
    : `${formatMoney(product.minPriceMinor)} - ${formatMoney(product.maxPriceMinor)}`;

  const players = product.minPlayers && product.maxPlayers
    ? product.minPlayers === product.maxPlayers
      ? `${product.minPlayers} jug.`
      : `${product.minPlayers}–${product.maxPlayers} jug.`
    : null;

  return (
    <button
      onClick={onClick}
      className="group flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-[--border]
                 bg-[--bg-raised] text-left shadow-sm transition-all duration-200
                 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-[--bg-subtle]">
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#d9f99d_48%,#bfdbfe)] text-emerald-900 dark:bg-[linear-gradient(135deg,#1c1917,#064e3b_52%,#1e3a8a)] dark:text-emerald-200">
          <PackageCheck className="h-10 w-10" aria-hidden="true" />
        </div>
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="relative h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center text-[--tx-faint]">
            <PackageCheck className="h-10 w-10" aria-hidden="true" />
          </div>
        )}

        {product.category && (
          <span className="absolute left-2 top-2 inline-flex max-w-[82%] items-center gap-1 rounded-full
                           border border-[--border] bg-[--bg-raised] px-2 py-1 text-[10px] font-semibold
                           text-[--tx-muted] shadow-sm">
            <Tags className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{categoryLabel(product.category)}</span>
          </span>
        )}

        {hasStock && cashbackPct > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500
                           px-2 py-1 text-[10px] font-bold text-white shadow-sm">
            <Gift className="h-3 w-3" aria-hidden="true" />
            {Math.round(cashbackPct * 100)}%
          </span>
        )}

        {!hasStock && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-red-600 py-2">
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Sin stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[--tx] transition-colors group-hover:text-emerald-600">
          {product.name}
        </h3>

        <div className="flex min-h-9 flex-wrap gap-x-3 gap-y-1 text-xs text-[--tx-faint]">
          {players && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {players}
            </span>
          )}
          {product.minAge ? <span>+{product.minAge} años</span> : null}
          {product.playTimeMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {product.playTimeMinutes} min
            </span>
          ) : null}
          {product.bggRating && product.bggRating > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {product.bggRating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-[--border] pt-3">
          <span className="text-sm font-bold leading-tight text-[--tx]">{priceLabel}</span>
          <span className={`shrink-0 text-xs font-medium ${hasStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-[--tx-faint]'}`}>
            {hasStock ? `${product.inStockListings} tienda${product.inStockListings > 1 ? 's' : ''}` : 'Sin stock'}
          </span>
        </div>
      </div>
    </button>
  );
}
