import { useQuery } from '@tanstack/react-query';

interface SearchPageProps {
  query: string;
  onProduct: (slug: string) => void;
}

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  images: string[];
  publisher?: string;
  minPlayers?: number;
  maxPlayers?: number;
  minPriceMinor: number;
  maxPriceMinor: number;
  currency: string;
  totalListings: number;
  inStockListings: number;
  bggRating?: number;
}

async function searchProducts(q: string): Promise<{ results: SearchResult[]; total: number }> {
  const res = await fetch(`/api/v1/products?q=${encodeURIComponent(q)}&limit=24`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ results: SearchResult[]; total: number }>;
}

function formatPrice(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(minor / 100);
}

export default function SearchPage({ query, onProduct }: SearchPageProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchProducts(query),
    enabled: query.length > 0,
  });

  const results = data?.results ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          Resultados para <span className="text-emerald-700">"{query}"</span>
        </h1>
        {data && (
          <p className="text-sm text-stone-500 mt-1">{data.total} juegos encontrados</p>
        )}
      </div>

      {isLoading && <SearchSkeleton />}

      {isError && (
        <div className="text-center py-16 text-stone-500">
          <p className="text-4xl mb-3">😕</p>
          <p>Hubo un error al buscar. Intentá de nuevo.</p>
        </div>
      )}

      {data && results.length === 0 && (
        <div className="text-center py-16 text-stone-500">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No encontramos "{query}"</p>
          <p className="text-sm mt-1">Probá con otro nombre o categoría</p>
        </div>
      )}

      {data && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {results.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => onProduct(product.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  onClick,
}: {
  product: SearchResult;
  onClick: () => void;
}) {
  const hasStock = product.inStockListings > 0;
  const priceRange =
    product.minPriceMinor === product.maxPriceMinor
      ? formatPrice(product.minPriceMinor, product.currency)
      : `${formatPrice(product.minPriceMinor, product.currency)} – ${formatPrice(product.maxPriceMinor, product.currency)}`;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-stone-200 overflow-hidden
                 hover:border-emerald-400 hover:shadow-md transition-all group"
    >
      <div className="aspect-square bg-stone-100 overflow-hidden">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-stone-300">
            🎲
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm text-stone-900 line-clamp-2 group-hover:text-emerald-700">
          {product.name}
        </h3>
        {product.publisher && (
          <p className="text-xs text-stone-400">{product.publisher}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-stone-900">{priceRange}</span>
          {product.bggRating && (
            <span className="text-xs text-amber-600 font-medium">
              ★ {product.bggRating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              hasStock ? 'bg-emerald-500' : 'bg-red-400'
            }`}
          />
          <span className="text-xs text-stone-500">
            {hasStock
              ? `${product.inStockListings} tienda${product.inStockListings > 1 ? 's' : ''}`
              : 'Sin stock'}
          </span>
        </div>
      </div>
    </button>
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-stone-200 overflow-hidden animate-pulse">
          <div className="aspect-square bg-stone-200" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-stone-200 rounded w-3/4" />
            <div className="h-3 bg-stone-200 rounded w-1/2" />
            <div className="h-4 bg-stone-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
