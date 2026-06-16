import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductCard, type Product } from '../components/ProductCard.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 24;

interface ProductsResponse {
  results: Product[];
  total: number;
  source: string;
}

async function fetchProducts(page: number): Promise<ProductsResponse> {
  const offset = (page - 1) * PAGE_SIZE;
  const res = await fetch(`${API}/api/v1/products?limit=${PAGE_SIZE}&offset=${offset}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<ProductsResponse>;
}

interface HomePageProps {
  onSearch: (q: string) => void;
  onProduct: (slug: string) => void;
}

export default function HomePage({ onSearch, onProduct }: HomePageProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', page],
    queryFn: () => fetchProducts(page),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-900 to-emerald-800 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Encuentra el mejor precio para tu juego de mesa
          </h1>
          <p className="text-emerald-200 text-lg">
            {data ? `${data.total.toLocaleString('es-AR')} juegos disponibles` : 'Comparamos disponibilidad y precio entre múltiples tiendas.'}
          </p>
          <form
            className="flex gap-2 max-w-lg mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) onSearch(q.trim());
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: Catan, Spirit Island, Wingspan..."
              className="flex-1 px-5 py-3 text-base rounded-xl text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-400 text-emerald-900 font-semibold
                         rounded-xl hover:bg-emerald-300 transition-colors"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* Catalog */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Todos los juegos</h2>
            {data && (
              <p className="text-sm text-stone-500 mt-0.5">
                {data.total.toLocaleString('es-AR')} juegos · página {page} de {totalPages}
              </p>
            )}
          </div>
        </div>

        {isLoading && !data && <CatalogSkeleton />}

        {isError && (
          <div className="text-center py-16 text-stone-500">
            <p className="text-4xl mb-3">😕</p>
            <p>No se pudo cargar el catálogo. Intentá de nuevo.</p>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {data.results.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => onProduct(product.slug)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700
                             hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>

                {/* Page number pills — show at most 7 around current */}
                <div className="flex gap-1">
                  {getPaginationRange(page, totalPages).map((item, i) =>
                    item === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-2 py-2 text-stone-400 text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`w-9 h-9 text-sm rounded-lg border transition-colors ${
                          item === page
                            ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                            : 'border-stone-300 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-700
                             hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Seller CTA */}
      <section className="bg-stone-100 border-t border-stone-200 py-10 px-4 mt-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <h2 className="text-xl font-bold text-stone-900">
            ¿Tenés una tienda de juegos de mesa?
          </h2>
          <p className="text-stone-600 text-sm">
            Conectá tu catálogo y empezá a vender en el marketplace sin cambiar tu sistema actual.
          </p>
          <a
            href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
            className="inline-block px-5 py-2.5 bg-emerald-700 text-white font-semibold text-sm
                       rounded-xl hover:bg-emerald-800 transition-colors"
          >
            Registrá tu tienda →
          </a>
        </div>
      </section>
    </div>
  );
}

function getPaginationRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i);
  if (current < total - 2) pages.push('…');
  add(total);
  return pages;
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-stone-200 overflow-hidden animate-pulse">
          <div className="aspect-square bg-stone-200" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 bg-stone-200 rounded w-3/4" />
            <div className="h-3 bg-stone-200 rounded w-1/2" />
            <div className="h-4 bg-stone-200 rounded w-2/3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
