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
  lowestPriceId,
  platformCashbackPct,
  cartItems,
  onAddToCart,
}: {
  allListings: ListingDetail[];
  inStockListings: ListingDetail[];
  outOfStockListings: ListingDetail[];
  lowestPriceId: string | null;
  platformCashbackPct: number;
  cartItems: { listingId: string; quantity: number }[];
  onAddToCart: (listing: ListingDetail) => void;
}) {
  const intl = useIntl();
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display text-2xl font-bold tracking-tight text-[--tx]">Comparar tiendas</h2>
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
        Ordenado por mejor combinación de precio, confianza del vendedor y entrega — fijate en
        el precio si solo te importa pagar menos.
      </p>

      {allListings.length === 0 ? (
        <p className="text-[--tx-muted] text-sm">
          Este juego no está disponible en ninguna tienda conectada por ahora.
        </p>
      ) : (
        <>
          {/* In-stock rows — single container */}
          <div className="rounded-[14px] border border-[--border] overflow-hidden shadow-sm bg-[--bg-raised]">
            {inStockListings.map((listing, idx) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                rank={idx + 1}
                isBest={idx === 0}
                isBestPrice={listing.id === lowestPriceId}
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
              <p className="text-xs font-medium text-[--tx-faint] mb-2">Agotado por ahora</p>
              <div className="rounded-[14px] border border-[--border] overflow-hidden shadow-sm bg-[--bg-raised]">
                {outOfStockListings.map((listing, idx) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    rank={0}
                    isBest={false}
                    isBestPrice={false}
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
  isBestPrice,
  onAddToCart,
  platformCashbackPct = 0.01,
  inCartQuantity = 0,
  isFirst,
}: {
  listing: ListingDetail;
  rank: number;
  isBest: boolean;
  isBestPrice: boolean;
  platformCashbackPct?: number;
  inCartQuantity?: number;
  isFirst: boolean;
  onAddToCart: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const isOutOfStock = l.stockStatus === 'out_of_stock' || l.stock <= 0;
  const atStockLimit = !isOutOfStock && inCartQuantity >= l.stock;
  const showGlass = isOutOfStock && !peeking;

  const bestDelivery = l.deliveryOptions.length
    ? l.deliveryOptions.reduce(
        (b, d) => (d.estimatedDaysMin < b.estimatedDaysMin ? d : b),
        l.deliveryOptions[0],
      )
    : null;

  const totalMinor = l.priceMinorUnits + (bestDelivery?.priceMinorUnits ?? 0);
  const price = fmtPrice(l.priceMinorUnits, l.currency);
  const totalCashback = platformCashbackPct + l.storeCashbackPct + l.promoBonus;

  const stockLabel =
    isOutOfStock ? 'Sin stock'
    : l.stockStatus === 'low_stock' ? 'Poco stock'
    : 'En stock';

  const deliveryLabel = bestDelivery
    ? bestDelivery.priceMinorUnits === 0
      ? `Envío gratis · ${bestDelivery.estimatedDaysMin}-${bestDelivery.estimatedDaysMax}d`
      : `+${fmtTotal(bestDelivery.priceMinorUnits, l.currency)} envío · ${bestDelivery.estimatedDaysMin}-${bestDelivery.estimatedDaysMax}d`
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
      className={`relative flex items-center gap-4 px-[18px] py-[15px] transition-colors
        ${!isFirst ? 'border-t border-[--border]' : ''}
        ${isBest ? 'border-l-4 border-l-emerald-500 bg-emerald-50' : ''}
        ${isOutOfStock ? 'opacity-70 select-none cursor-pointer [-webkit-touch-callout:none]' : ''}
      `}
      {...peekHandlers}
    >
      {showGlass && (
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/40 dark:bg-black/30
                        grayscale flex items-center justify-center pointer-events-none select-none z-10">
          <span className="px-3 py-1 rounded-full bg-[--bg-raised]/90 border border-[--border] text-xs font-medium text-[--tx-muted] shadow-sm">
            No disponible · mantené presionado para ver
          </span>
        </div>
      )}

      {/* Seller info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isBest && (
            <Award className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          )}
          <span className="font-bold text-[15px] text-[--tx] truncate">{l.sellerName}</span>
          {isBest && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-mono text-[9.5px] font-bold uppercase tracking-wide px-[7px] py-[2px] rounded-md">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              Mejor oferta
            </span>
          )}
          {isBestPrice && !isBest && (
            <span className="inline-flex items-center bg-emerald-100 text-emerald-700 font-mono text-[9.5px] font-bold uppercase tracking-wide px-[7px] py-[2px] rounded-md">
              Precio más bajo
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-[--tx-muted] mt-[3px]">
          ★ {(l.sellerScore * 5).toFixed(1)}
          {' · '}{stockLabel}
          {deliveryLabel && ` · ${deliveryLabel}`}
          {totalCashback > 0 && ` · +${Math.round(totalCashback * 100)}% créditos`}
          {l.promoLabel && ` · ${l.promoLabel}`}
        </p>

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
              {showScore ? 'Ocultar ranking' : 'Por qué este ranking'}
            </button>
            {showScore && (
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(l.scoreBreakdown).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="h-1.5 bg-[--bg-subtle] rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
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

      {/* Price + CTA */}
      {!isOutOfStock && (
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="flex items-baseline gap-[1px] justify-end select-none">
              <span className="text-[13px] text-[--tx-muted]">{price.prefix}</span>
              <span
                className={`font-display font-extrabold text-[23px] tabular-nums transition-[filter] duration-300
                  ${showGlass ? 'blur-[5px]' : ''}
                  ${isBestPrice ? 'text-emerald-700' : 'text-[--tx]'}`}
              >
                {showGlass ? 'XXX' : price.integer}
              </span>
              {price.suffix && (
                <span className="text-[13px] text-[--tx-muted]">{price.suffix}</span>
              )}
            </div>
            <p className="font-mono text-[10px] text-[--tx-faint] text-right">
              total {showGlass ? '···' : fmtTotal(totalMinor, l.currency)}
            </p>
          </div>

          <button
            onClick={onAddToCart}
            disabled={atStockLimit}
            title={atStockLimit ? 'Ya agregaste todo el stock disponible' : undefined}
            className={`flex-none inline-flex items-center gap-2 font-bold text-[13.5px] px-4 py-[10px] rounded-[9px]
              cursor-pointer border-0 transition-colors disabled:opacity-50 disabled:pointer-events-none
              ${isBest
                ? 'bg-emerald-500 text-emerald-50 hover:bg-emerald-600'
                : 'bg-[--bg-raised] text-[--tx] border border-[--border-strong] hover:border-emerald-500 hover:text-emerald-500'
              }`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {atStockLimit ? 'Máximo' : 'Agregar'}
          </button>
        </div>
      )}
    </div>
  );
}
