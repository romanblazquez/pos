import { Check, Clock3, Gift, PackageCheck, Star, Users } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  commerceStateEmphasis,
  commerceStateLabel,
  commerceStateTone,
  resolveCommerceState,
  type CommerceState,
} from '@retail-os/ui-react';
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
  /** Currency the range is quoted in; absent when there is no comparable offer. */
  currency?: string;
  /** Offers exist for this product, but not in the active market. */
  availableElsewhere?: boolean;
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
  // No currency means no comparable offer in this market. Showing the number
  // anyway is how an Argentine price came to read as Mexican pesos here.
  const hasPrice = product.minPriceMinor > 0 && Boolean(product.currency);
  const priceLabel = !hasPrice
    ? (product.availableElsewhere
        ? intl.formatMessage({ id: 'productCard.availableElsewhere' })
        : intl.formatMessage({ id: 'productCard.noOffer' }))
    : samePrice
      ? formatMoney(product.minPriceMinor, product.currency as string)
      : `${formatMoney(product.minPriceMinor, product.currency as string)} - ${formatMoney(product.maxPriceMinor, product.currency as string)}`;

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
                 hover:-translate-y-1 hover:border-[--primary] hover:shadow-xl
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary]"
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-[--bg-subtle]">
        <div className="absolute inset-0 flex items-center justify-center bg-[--bg-subtle] text-[--tx-faint]">
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
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[--primary]
                           px-2 py-1 text-[10px] font-bold text-[--primary-foreground] shadow-sm">
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
          <span className="text-base leading-none" style={{ color: isWishlisted ? 'var(--primary)' : undefined }}>
            {isWishlisted ? '♥' : '♡'}
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[--tx-faint]">
          {product.publisher ?? categoryLabel(product.category, uiLocale)}
        </p>
        <h3 className="line-clamp-2 font-display text-[17px] font-bold leading-tight text-[--tx] transition-colors group-hover:text-[--primary]">
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
            <span className="inline-flex items-center gap-1 font-medium text-[--jp-brass]">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {product.bggRating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-[--border] pt-3">
          <span className="font-display text-xl font-extrabold leading-tight text-[--tx]">{priceLabel}</span>
          <span className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase ${hasStock ? 'bg-[--jp-success-tint] text-[--jp-success-text]' : 'bg-[--bg-subtle] text-[--tx-faint]'}`}>
            {hasStock ? intl.formatMessage({ id: 'productCard.inStores' }, { count: product.inStockListings }) : intl.formatMessage({ id: 'productCard.outOfStock' })}
          </span>
        </div>
      </div>
    </div>
  );
}


function CommerceBadge({ state }: { state: CommerceState }) {
  // Colour, weight and wording all come from commerce-state.ts, so a badge
  // cannot look like one thing here and another on the next surface.
  const special = state === 'rare' ? '\u25C6' : state === 'top-ranked' ? '\u2605' : null;
  return (
    <span
      className="commerce-badge absolute left-2 top-2 shadow-sm backdrop-blur-sm"
      data-tone={commerceStateTone(state)}
      data-emphasis={commerceStateEmphasis(state)}
    >
      {special ? (
        <span aria-hidden="true">{special}</span>
      ) : state === 'best-price' ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span className="commerce-badge-mark" aria-hidden="true" />
      )}
      <span className="commerce-badge-label">{commerceStateLabel(state)}</span>
    </span>
  );
}
