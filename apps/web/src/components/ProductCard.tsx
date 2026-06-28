import Link from 'next/link';
import { Clock3, Users } from 'lucide-react';
import type { ProductSummary } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { listingPath, type Locale } from '@/lib/segments';

// Catalog card for a price-comparison storefront: image, name, lowest price,
// and how many stores carry it. Crawlable <a> to the product page.
export function ProductCard({ product, locale }: { product: ProductSummary; locale: Locale }) {
  const href = `${listingPath('games', locale)}/${product.slug}`;
  const inStock = product.inStockListings > 0;
  const hasPrice = product.minPriceMinor > 0;

  return (
    <Link className="card-link" href={href}>
      <div className="card-media">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} width={300} height={300} loading="lazy" />
        ) : (
          <div className="card-noimg" aria-hidden="true">🎲</div>
        )}
        {!inStock && (
          <span className="card-flag">{locale === 'es' ? 'Sin stock' : 'Out of stock'}</span>
        )}
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
          <span className={`stock-pill${inStock ? '' : ' out'}`}>
            {inStock
              ? locale === 'es' ? 'En stock' : 'In stock'
              : locale === 'es' ? 'Agotado' : 'Sold out'}
          </span>
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
