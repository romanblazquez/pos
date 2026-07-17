import Link from 'next/link';
import { Clock3, Users } from 'lucide-react';
import type { ProductSummary } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { listingPath, type Locale } from '@/lib/segments';
import {
  commerceStateEmphasis,
  commerceStateLabel,
  commerceStateText,
  resolveCommerceState,
} from '@retail-os/ui-react';

// Glyph marks (§04). Stock states take a colour dot instead — an empty mark span
// renders as one — and every other state carries no mark at all.
const MARKS: Partial<Record<string, string>> = { rare: '◆', 'top-ranked': '★', 'best-price': '✓' };
const DOTTED = new Set(['in-stock', 'low-stock', 'out-of-stock']);

// Catalog card for a price-comparison storefront: image, name, lowest price,
// and how many stores carry it. Crawlable <a> to the product page.
export function ProductCard({ product, locale }: { product: ProductSummary; locale: Locale }) {
  const href = `${listingPath('games', locale)}/${product.slug}`;
  const inStock = product.inStockListings > 0;
  const commerceState = resolveCommerceState(product.tags, product.inStockListings);
  const hasPrice = product.minPriceMinor > 0;
  // `category` is base-game vs expansion, so this qualifier is the one extra
  // badge the catalogue can back today. The design system's detail suffixes
  // (Sale −19%, Low · 3 left, Used · VG) need BO data we don't have yet.
  const isExpansion = product.category === 'expansion';

  return (
    <Link className="card-link" href={href}>
      <div className="card-media">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} width={300} height={300} loading="lazy" />
        ) : (
          <div className="card-noimg" aria-hidden="true">🎲</div>
        )}
        <div className="card-badges">
          <span
            className={`commerce-badge commerce-badge--${commerceState}`}
            data-emphasis={commerceStateEmphasis(commerceState)}
          >
            {(MARKS[commerceState] || DOTTED.has(commerceState)) && (
              <span className="commerce-badge-mark" aria-hidden="true">{MARKS[commerceState] ?? ''}</span>
            )}
            {commerceStateText(commerceState, locale)}
          </span>
          {isExpansion && (
            <span className="commerce-badge commerce-badge--expansion" data-emphasis="soft">
              {commerceStateLabel('expansion', locale)}
            </span>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="card-category">{product.publisher ?? product.category}</div>
        <h3 className="card-title">{product.name}</h3>
        <div className="card-meta">
          {(product.minPlayers || product.maxPlayers) && (
            <span>
              <Users size={12} aria-hidden="true" />{' '}
              {product.minPlayers ?? '?'}
              {product.maxPlayers && product.maxPlayers !== product.minPlayers ? `–${product.maxPlayers}` : ''}
            </span>
          )}
          {product.playTimeMinutes && (
            <span><Clock3 size={12} aria-hidden="true" /> {product.playTimeMinutes}m</span>
          )}
        </div>
        <div className="card-foot">
          {hasPrice ? (
            <span className="card-price">
              <span className="card-price-label">{locale === 'es' ? 'desde' : 'from'}</span>{' '}
              {formatMoney(product.minPriceMinor, undefined, locale)}
            </span>
          ) : (
            <span className="card-price card-price--na">{locale === 'es' ? 'Sin oferta' : 'No offer'}</span>
          )}
          {commerceState !== 'in-stock' && commerceState !== 'out-of-stock' && (
            <span className={`stock-pill${inStock ? '' : ' out'}`}>
              {inStock
                ? locale === 'es' ? 'En stock' : 'In stock'
                : locale === 'es' ? 'Agotado' : 'Sold out'}
            </span>
          )}
        </div>
        {product.totalListings > 0 && (
          <span className="card-stores">
            {product.totalListings}{' '}
            {product.totalListings === 1
              ? locale === 'es' ? 'tienda comparada' : 'store compared'
              : locale === 'es' ? 'tiendas comparadas' : 'stores compared'}
          </span>
        )}
      </div>
    </Link>
  );
}
