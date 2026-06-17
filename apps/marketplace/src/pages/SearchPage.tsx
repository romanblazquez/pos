import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { ProductCard, type Product } from '../components/ProductCard.js';
import { Button, cn } from '../components/ui/index.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import {
  categoryDescription,
  categoryLabel,
  getCategoryOptions,
} from '../marketplace-meta.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function searchProducts(
  q: string,
  category?: string,
  inStockOnly?: boolean,
): Promise<{ results: Product[]; total: number }> {
  const params = new URLSearchParams({ limit: '48' });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (inStockOnly) params.set('inStock', 'true');

  const res = await fetch(`${API}/api/v1/products?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ results: Product[]; total: number }>;
}

export default function SearchPage({
  query,
  category,
  onSearch,
  onProduct,
}: {
  query: string;
  category?: string;
  onSearch: (q: string, category?: string) => void;
  onProduct: (slug: string) => void;
}) {
  const [draft, setDraft] = useState(query);
  const [inStockOnly, setInStockOnly] = useState(false);
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  useEffect(() => setDraft(query), [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, inStockOnly],
    queryFn: () => searchProducts(query, category, inStockOnly),
    enabled: query.length > 0 || !!category || inStockOnly,
  });

  const results = data?.results ?? [];
  const categoryOptions = getCategoryOptions();
  const title = query
    ? `Resultados para "${query}"`
    : category
    ? categoryLabel(category)
    : 'Buscar juegos';

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[17rem_1fr] lg:py-8">
      <aside className="order-2 lg:order-1">
        <div className="sticky top-24 rounded-lg border border-[--border] bg-[--bg-raised] p-4">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-[--tx]">Filtros</p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--tx-muted]">Categoría</p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                <FilterButton
                  active={!category}
                  label="Todas"
                  description="Sin filtro"
                  onClick={() => onSearch(query, undefined)}
                />
                {categoryOptions.map((option) => (
                  <FilterButton
                    key={option.value}
                    active={category === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => onSearch(query, option.value)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-[--border] pt-4">
              <button
                onClick={() => setInStockOnly((value) => !value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                  inStockOnly
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-[--border] bg-[--bg-raised] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">Solo con stock</span>
                  <span className="block text-xs text-[--tx-muted]">Evita ofertas agotadas</span>
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border',
                    inStockOnly ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[--border]',
                  )}
                >
                  {inStockOnly && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="order-1 min-w-0 lg:order-2">
        <section className="mb-6 rounded-lg border border-[--border] bg-[--bg-raised] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {category ? categoryLabel(category) : 'Marketplace'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[--tx]">{title}</h1>
              <p className="mt-1 text-sm text-[--tx-muted]">
                {data
                  ? `${data.total.toLocaleString('es-MX')} juegos encontrados`
                  : categoryDescription(category)}
              </p>
            </div>

            <form
              className="flex min-w-0 gap-2 md:w-[26rem]"
              onSubmit={(e) => {
                e.preventDefault();
                onSearch(draft.trim(), category);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--tx-faint]" aria-hidden="true" />
                <input
                  type="search"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Refinar búsqueda"
                  className="h-10 w-full rounded-lg border border-[--border] bg-[--bg-input] py-2 pl-9 pr-3 text-sm
                             text-[--tx] placeholder:text-[--tx-faint] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <Button type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Buscar</span>
              </Button>
            </form>
          </div>

          {(category || inStockOnly) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {category && (
                <ActiveChip label={categoryLabel(category)} onClear={() => onSearch(query, undefined)} />
              )}
              {inStockOnly && (
                <ActiveChip label="Con stock" onClear={() => setInStockOnly(false)} />
              )}
            </div>
          )}
        </section>

        {isLoading && <SearchSkeleton />}

        {isError && (
          <EmptyState
            icon={<SearchX className="h-9 w-9" aria-hidden="true" />}
            title="Hubo un error al buscar"
            body="Revisa la conexión con el API e intenta nuevamente."
          />
        )}

        {!isLoading && !isError && !data && (
          <EmptyState
            icon={<Search className="h-9 w-9" aria-hidden="true" />}
            title="Encuentra tu próximo juego"
            body="Busca por nombre, editorial o elige una categoría para empezar."
          />
        )}

        {data && results.length === 0 && (
          <EmptyState
            icon={<SearchX className="h-9 w-9" aria-hidden="true" />}
            title="No encontramos resultados"
            body="Prueba otro nombre o limpia los filtros activos."
          />
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {results.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                cashbackPct={cashbackPct}
                priority={index < 8}
                onClick={() => onProduct(product.slug)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterButton({
  active,
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-[12rem] shrink-0 rounded-lg px-3 py-2 text-left transition-colors lg:w-full',
        active
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
      )}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-[--tx-muted]">{description}</span>
    </button>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold
                 text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800
                 dark:bg-emerald-950 dark:text-emerald-200"
    >
      {label} x
    </button>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--bg-raised] px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted]">
        {icon}
      </div>
      <p className="mt-4 font-semibold text-[--tx]">{title}</p>
      <p className="mt-1 text-sm text-[--tx-muted]">{body}</p>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-[--border] bg-[--bg-raised]">
          <div className="aspect-[4/3] animate-pulse bg-[--bg-subtle]" />
          <div className="space-y-3 p-3.5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[--bg-subtle]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[--bg-subtle]" />
            <div className="h-8 animate-pulse rounded bg-[--bg-subtle]" />
          </div>
        </div>
      ))}
    </div>
  );
}
