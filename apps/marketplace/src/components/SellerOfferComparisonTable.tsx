import { useState } from 'react';
import { Award, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { useIntl } from 'react-intl';

export interface ListingDetail {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  sellerScore: number;
  priceMinorUnits: number;
  condition: string;
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

function fmtPrice(minor: number, currency: string) {
  const n = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
  // Split into currency symbol/code and numeric part for design split display
  const match = n.match(/^([^\d\s]*)\s*([\d.,]+)(.*)$/);
  if (match) return { prefix: match[1] || currency, integer: match[2], suffix: match[3] };
  return { prefix: currency, integer: n, suffix: '' };
}

function fmtTotal(minor: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function SellerOfferComparisonTable({
  allListings,
  inStockListings,
  outOfStockListings,
  platformCashbackPct,
  cartItems,
  onAddToCart,
}: {
  allListings: ListingDetail[];
  inStockListings: ListingDetail[];
  outOfStockListings: ListingDetail[];
  platformCashbackPct: number;
  cartItems: { listingId: string; quantity: number }[];
  onAddToCart: (listing: ListingDetail) => void;
}) {
  const intl = useIntl();
  const rankedInStock = [...inStockListings].sort((left, right) =>
    offerTotal(left) - offerTotal(right) || right.sellerScore - left.sellerScore,
  );
  const lowestTotalId = rankedInStock[0]?.id ?? null;
  return (
    <section>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight text-[--tx]">{intl.formatMessage({ id: 'offers.compareStores' })}</h2>
        {inStockListings.length > 0 && (
          <span className="text-xs text-[--tx-faint]">
            {intl.formatMessage(
              { id: 'offers.stockSummary' },
              { inStock: inStockListings.length, outOfStock: outOfStockListings.length },
            )}
          </span>
        )}
      </div>
      <p className="text-xs text-[--tx-faint] mb-4">
        {intl.formatMessage({ id: 'offers.sortHint' })}
      </p>

      {allListings.length === 0 ? (
        <p className="text-[--tx-muted] text-sm">
          {intl.formatMessage({ id: 'offers.noStores' })}
        </p>
      ) : (
        <>
          {/* In-stock rows — single container */}
          <div className="rounded-[14px] border border-[--border] overflow-hidden shadow-sm bg-[--bg-raised]">
            {rankedInStock.map((listing, idx) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                rank={idx + 1}
                isBest={idx === 0}
                isLowestTotal={listing.id === lowestTotalId}
                platformCashbackPct={platformCashbackPct}
                inCartQuantity={cartItems.find((i) => i.listingId === listing.id)?.quantity ?? 0}
                isFirst={idx === 0}
                onAddToCart={() => onAddToCart(listing)}
              />
            ))}
          </div>

          {/* Out-of-stock section */}
          {outOfStockListings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed border-[--border]">
              <p className="text-xs font-medium text-[--tx-faint] mb-2">{intl.formatMessage({ id: 'offers.outOfStockForNow' })}</p>
              <div className="rounded-[14px] border border-[--border] overflow-hidden shadow-sm bg-[--bg-raised]">
                {outOfStockListings.map((listing, idx) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    rank={0}
                    isBest={false}
                    isLowestTotal={false}
                    platformCashbackPct={platformCashbackPct}
                    inCartQuantity={0}
                    isFirst={idx === 0}
                    onAddToCart={() => onAddToCart(listing)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ListingRow({
  listing: l,
  isBest,
  isLowestTotal,
  onAddToCart,
  platformCashbackPct = 0.01,
  inCartQuantity = 0,
  isFirst,
}: {
  listing: ListingDetail;
  rank: number;
  isBest: boolean;
  isLowestTotal: boolean;
  platformCashbackPct?: number;
  inCartQuantity?: number;
  isFirst: boolean;
  onAddToCart: () => void;
}) {
  const intl = useIntl();
  const [showScore, setShowScore] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const isOutOfStock = l.stockStatus === 'out_of_stock' || l.stock <= 0;
  const atStockLimit = !isOutOfStock && inCartQuantity >= l.stock;
  const showGlass = isOutOfStock && !peeking;

  const bestDelivery = l.deliveryOptions.length
    ? l.deliveryOptions.reduce(
        (best, option) => option.priceMinorUnits < best.priceMinorUnits
          || (option.priceMinorUnits === best.priceMinorUnits && option.estimatedDaysMin < best.estimatedDaysMin)
          ? option
          : best,
        l.deliveryOptions[0],
      )
    : null;

  const totalMinor = l.priceMinorUnits + (bestDelivery?.priceMinorUnits ?? 0);
  const price = fmtPrice(l.priceMinorUnits, l.currency);
  const shippingPrice = fmtTotal(bestDelivery?.priceMinorUnits ?? 0, l.currency);
  const totalCashback = platformCashbackPct + l.storeCashbackPct + l.promoBonus;

  const stockLabel =
    isOutOfStock ? intl.formatMessage({ id: 'offers.stockNone' })
    : l.stockStatus === 'low_stock' ? intl.formatMessage({ id: 'offers.stockLow' })
    : intl.formatMessage({ id: 'offers.stockInStock' });

  const deliveryLabel = bestDelivery
    ? bestDelivery.priceMinorUnits === 0
      ? intl.formatMessage({ id: 'offers.freeShipping' }, { min: bestDelivery.estimatedDaysMin, max: bestDelivery.estimatedDaysMax })
      : intl.formatMessage({ id: 'offers.shippingCost' }, { price: fmtTotal(bestDelivery.priceMinorUnits, l.currency), min: bestDelivery.estimatedDaysMin, max: bestDelivery.estimatedDaysMax })
    : null;

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

  return (
    <div
      className={`relative flex flex-col gap-3 px-[18px] py-[15px] transition-colors
        sm:flex-row sm:items-center sm:gap-4
        ${!isFirst ? 'border-t border-[--border]' : ''}
        ${isBest ? 'border-l-4 border-l-[--success] bg-[--success-bg]' : ''}
        ${isOutOfStock ? 'opacity-70 select-none cursor-pointer [-webkit-touch-callout:none]' : ''}
      `}
      {...peekHandlers}
    >
      {showGlass && (
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/40 dark:bg-black/30
                        grayscale flex items-center justify-center pointer-events-none select-none z-10">
          <span className="px-3 py-1 rounded-full bg-[--bg-raised]/90 border border-[--border] text-xs font-medium text-[--tx-muted] shadow-sm">
            {intl.formatMessage({ id: 'offers.notAvailableHint' })}
          </span>
        </div>
      )}

      {/* Seller info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isBest && (
            <Award className="h-3.5 w-3.5 text-[--success] shrink-0" aria-hidden="true" />
          )}
          <span className="font-bold text-[15px] text-[--tx] truncate">{l.sellerName}</span>
          {isBest && (
            <span className="inline-flex items-center gap-1 bg-[--success-solid] text-[--success-fg] font-mono text-[9.5px] font-bold uppercase tracking-wide px-[7px] py-[2px] rounded-md">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              {intl.formatMessage({ id: 'offers.bestOffer' })}
            </span>
          )}
        </div>
        <p className="mt-[3px] break-words font-mono text-[11px] text-[--tx-muted]">
          {stockLabel}
          {deliveryLabel && ` · ${deliveryLabel}`}
          {totalCashback > 0 && ` · ${intl.formatMessage({ id: 'offers.creditsPct' }, { pct: Math.round(totalCashback * 100) })}`}
          {l.promoLabel && ` · ${l.promoLabel}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
          <span className="rounded-md border border-[--border] bg-[--bg-subtle] px-2 py-1 text-[--tx-muted]">
            {intl.formatMessage({ id: 'offers.sellerTrust' })}: {(l.sellerScore * 5).toFixed(1)}/5
          </span>
          <span className="rounded-md border border-[--border] bg-[--bg-subtle] px-2 py-1 text-[--tx-muted]">
            {intl.formatMessage({ id: 'offers.condition' })}: {conditionLabel(l.condition, intl.locale)}
          </span>
        </div>

        {/* Score breakdown */}
        {!isOutOfStock && (
          <div className="mt-[6px]">
            <button
              onClick={() => setShowScore(!showScore)}
              className="inline-flex items-center gap-1 text-[11px] text-[--tx-faint] hover:text-[--tx-muted] transition-colors"
            >
              {showScore
                ? <ChevronUp className="h-3 w-3" aria-hidden="true" />
                : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
              {showScore ? intl.formatMessage({ id: 'offers.hideRanking' }) : intl.formatMessage({ id: 'offers.whyRanking' })}
            </button>
            {showScore && (
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(l.scoreBreakdown).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="h-1.5 bg-[--bg-subtle] rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-[--success-solid] rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-[--tx-faint] capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </p>
                    <p className="text-[11px] font-medium text-[--tx-muted]">{Math.round(val * 100)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price + CTA — full-width row on mobile, inline shrink-0 block from sm: up */}
      {!isOutOfStock && (
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:shrink-0">
          <div className="grid grid-cols-3 gap-2 text-right">
            <PriceCell label={intl.formatMessage({ id: 'offers.itemPrice' })} value={`${price.prefix}${price.integer}${price.suffix}`} />
            <PriceCell label={intl.formatMessage({ id: 'offers.shipping' })} value={bestDelivery?.priceMinorUnits === 0 ? intl.formatMessage({ id: 'offers.free' }) : shippingPrice} />
            <PriceCell label={intl.formatMessage({ id: 'offers.totalPrice' })} value={fmtTotal(totalMinor, l.currency)} emphasis={isLowestTotal} />
          </div>

          <button
            onClick={onAddToCart}
            disabled={atStockLimit}
            title={atStockLimit ? intl.formatMessage({ id: 'offers.maxStockTitle' }) : undefined}
            className={`flex-none inline-flex items-center gap-2 font-bold text-[13.5px] px-4 py-[10px] rounded-[9px]
              cursor-pointer border-0 transition-colors disabled:opacity-50 disabled:pointer-events-none
              ${isLowestTotal
                ? 'bg-[--success-solid] text-[--success-fg] hover:opacity-90'
                : 'bg-[--bg-raised] text-[--tx] border border-[--border-strong] hover:border-[--success] hover:text-[--success]'
              }`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {atStockLimit ? intl.formatMessage({ id: 'offers.max' }) : intl.formatMessage({ id: 'offers.add' })}
          </button>
        </div>
      )}
    </div>
  );
}

function offerTotal(listing: ListingDetail): number {
  const shipping = listing.deliveryOptions.length
    ? Math.min(...listing.deliveryOptions.map((option) => option.priceMinorUnits))
    : 0;
  return listing.priceMinorUnits + shipping;
}

function conditionLabel(condition: string, locale: string): string {
  const labels: Record<string, { es: string; en: string }> = {
    new: { es: 'Nuevo', en: 'New' },
    used: { es: 'Usado', en: 'Used' },
    like_new: { es: 'Como nuevo', en: 'Like new' },
    damaged: { es: 'Dañado', en: 'Damaged' },
  };
  return labels[condition]?.[locale.startsWith('es') ? 'es' : 'en']
    ?? condition.replace(/_/g, ' ');
}

function PriceCell({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`min-w-[72px] rounded-lg border px-2 py-1.5 ${emphasis ? 'border-[--success] bg-[--success-bg]' : 'border-[--border] bg-[--bg-subtle]'}`}>
      <span className="block font-mono text-[9px] uppercase tracking-wide text-[--tx-faint]">{label}</span>
      <strong className={`block whitespace-nowrap font-display text-sm tabular-nums ${emphasis ? 'text-[--success]' : 'text-[--tx]'}`}>{value}</strong>
    </div>
  );
}
