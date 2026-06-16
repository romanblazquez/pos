import { useQuery } from '@tanstack/react-query';
import { ProductCard, type Product } from '../components/ProductCard.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';

interface SearchPageProps {
  query: string;
  onProduct: (slug: string) => void;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function searchProducts(q: string): Promise<{ results: Product[]; total: number }> {
  const res = await fetch(`${API}/api/v1/products?q=${encodeURIComponent(q)}&limit=48`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ results: Product[]; total: number }>;
}

export default function SearchPage({ query, onProduct }: SearchPageProps) {
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchProducts(query),
    enabled: query.length > 0,
  });

  const results = data?.results ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              cashbackPct={cashbackPct}
              onClick={() => onProduct(product.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
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
