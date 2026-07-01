import { Check, Clock3, Gift, PackageCheck, Star, Users } from 'lucide-react';
import { useIntl } from 'react-intl';
import { commerceStateLabel, resolveCommerceState, type CommerceState } from '@retail-os/ui-react';
import { categoryLabel, formatMoney } from '../marketplace-meta.js';
import { useShelf } from '../context/ShelfContext.js';
import { useMarket } from '../context/MarketContext.js';

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
  const { getShelfStatus, setShelfStatus } = useShelf();
  const { uiLocale } = useMarket();
  const intl = useIntl();
  const isWishlisted = getShelfStatus(product.slug) === 'wishlist';
  const commerceState = resolveCommerceState(product.tags, product.inStockListings);
  const samePrice = product.minPriceMinor === product.maxPriceMinor;
  const priceLabel = samePrice
    ? formatMoney(product.minPriceMinor)
    : `${formatMoney(product.minPriceMinor)} - ${formatMoney(product.maxPriceMinor)}`;

  const players = product.minPlayers && product.maxPlayers
    ? product.minPlayers === product.maxPlayers
      ? intl.formatMessage({ id: 'productCard.players' }, { count: product.minPlayers })
      : `${product.minPlayers}–${intl.formatMessage({ id: 'productCard.players' }, { count: product.maxPlayers })}`
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="group flex min-h-[25rem] cursor-pointer flex-col overflow-hidden rounded-[14px] border border-[--border]
                 bg-[--bg-raised] text-left shadow-sm transition-all duration-200
                 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-[--bg-subtle]">
        <div className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(45deg,#efe5d2,#efe5d2_10px,#e8dcc5_10px,#e8dcc5_20px)] text-emerald-900 dark:bg-[--bg-subtle] dark:text-emerald-200">
          <PackageCheck className="h-10 w-10" aria-hidden="true" />
        </div>
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading={priority ? 'eager' : 'lazy'}
            className="relative h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center text-[--tx-faint]">
            <PackageCheck className="h-10 w-10" aria-hidden="true" />
          </div>
        )}

        <CommerceBadge state={commerceState} />

        {hasStock && cashbackPct > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500
                           px-2 py-1 text-[10px] font-bold text-white shadow-sm">
            <Gift className="h-3 w-3" aria-hidden="true" />
            {Math.round(cashbackPct * 100)}%
          </span>
        )}

        {/* Wishlist heart button */}
        <button
          aria-label={intl.formatMessage({ id: isWishlisted ? 'productCard.removeFromWishlist' : 'productCard.addToWishlist' })}
          onClick={(e) => {
            e.stopPropagation();
            setShelfStatus(product.slug, product.name, isWishlisted ? null : 'wishlist');
          }}
          className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full
                     bg-[--bg-raised]/90 backdrop-blur-sm shadow-sm border border-[--border]
                     transition-all hover:scale-110 active:scale-95"
        >
          <span className="text-base leading-none" style={{ color: isWishlisted ? '#B4502E' : undefined }}>
            {isWishlisted ? '♥' : '♡'}
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[--tx-faint]">
          {product.publisher ?? categoryLabel(product.category, uiLocale)}
        </p>
        <h3 className="line-clamp-2 font-display text-[17px] font-bold leading-tight text-[--tx] transition-colors group-hover:text-emerald-600">
          {product.name}
        </h3>

        <div className="flex min-h-9 flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[--tx-faint]">
          {players && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {players}
            </span>
          )}
          {product.minAge ? <span>{intl.formatMessage({ id: 'productCard.minAge' }, { age: product.minAge })}</span> : null}
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
          <span className="font-display text-xl font-extrabold leading-tight text-[--tx]">{priceLabel}</span>
          <span className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase ${hasStock ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-[--bg-subtle] text-[--tx-faint]'}`}>
            {hasStock ? intl.formatMessage({ id: 'productCard.inStores' }, { count: product.inStockListings }) : intl.formatMessage({ id: 'productCard.outOfStock' })}
          </span>
        </div>
      </div>
    </div>
  );
}

const COMMERCE_BADGE_STYLES: Record<CommerceState, string> = {
  'in-stock': 'border-[#CBE0CD] bg-[#E4EFE4] text-[#2C6B43] dark:border-[#5CA877]/30 dark:bg-[#5CA877]/15 dark:text-[#7FC79A]',
  'low-stock': 'border-[#E7D3A6] bg-[#F6EBD2] text-[#8A5A12] dark:border-[#D7A654]/30 dark:bg-[#D7A654]/15 dark:text-[#E0BC72]',
  'out-of-stock': 'border-[#D8CCB3] bg-[#E9E2D2] text-[#2B2622] dark:border-[#4A4233] dark:bg-[#312B20] dark:text-[#B6AB94]',
  preorder: 'border-[#D9CEE6] bg-[#ECE6F3] text-[#574079] dark:border-[#A88AD0]/30 dark:bg-[#A88AD0]/15 dark:text-[#C9B6EC]',
  backorder: 'border-[#E6CDB2] bg-[#F5E6D6] text-[#8A4A18] dark:border-[#D18A50]/30 dark:bg-[#D18A50]/15 dark:text-[#E7AC78]',
  'out-of-print': 'border-[#D8CCB3] bg-[#E9E2D2] text-[#2B2622] dark:border-[#4A4233] dark:bg-[#312B20] dark:text-[#B6AB94]',
  used: 'border-[#C2DDD6] bg-[#DEEEEA] text-[#2C6B5F] dark:border-[#5CA895]/30 dark:bg-[#5CA895]/15 dark:text-[#83C9B8]',
  rare: 'border-[#E2CF9C] bg-[#F2E6C8] text-[#7E5A12] dark:border-[#D7A654]/30 dark:bg-[#D7A654]/15 dark:text-[#E0BC72]',
  sale: 'border-[#E8C7BF] bg-[#F6E1DC] text-[#93291F] dark:border-[#D06152]/30 dark:bg-[#D06152]/15 dark:text-[#E68A7C]',
  'best-price': 'border-[#CBE0CD] bg-[#E4EFE4] text-[#2C6B43] dark:border-[#5CA877]/30 dark:bg-[#5CA877]/15 dark:text-[#7FC79A]',
  'top-ranked': 'border-[#E2CF9C] bg-[#F4E9CF] text-[#8A6312] dark:border-[#D7A654]/30 dark:bg-[#D7A654]/15 dark:text-[#E0BC72]',
  'community-pick': 'border-[#CCD8CD] bg-[#E5EBE5] text-[#354A3D] dark:border-[#789981]/30 dark:bg-[#789981]/15 dark:text-[#A9C5AF]',
  new: 'border-[#F0D9C2] bg-[#FBEFE0] text-[#9C4324] dark:border-[#CE6A41]/30 dark:bg-[#CE6A41]/15 dark:text-[#E89270]',
};

function CommerceBadge({ state }: { state: CommerceState }) {
  const special = state === 'rare' ? '◆' : state === 'top-ranked' ? '★' : null;
  return (
    <span className={`absolute left-2 top-2 inline-flex max-w-[82%] items-center gap-1.5 rounded-[7px] border px-2.5 py-1
                      font-mono text-[10px] font-bold uppercase tracking-[0.04em] shadow-sm backdrop-blur-sm
                      ${COMMERCE_BADGE_STYLES[state]}`}>
      {special ? <span aria-hidden="true">{special}</span> : state === 'best-price' ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      <span className="truncate">{commerceStateLabel(state)}</span>
    </span>
  );
}
