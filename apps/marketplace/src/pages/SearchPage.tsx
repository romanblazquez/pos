import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import { ProductCard, type Product } from '../components/ProductCard.js';
import { Button, cn } from '../components/ui/index.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { SeoHead } from '../components/SeoHead.js';
import { trackEvent } from '../analytics.js';
import {
  categoryDescription,
  categoryLabel,
  getCategoryOptions,
} from '../marketplace-meta.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 24;

async function searchProducts(
  q: string,
  page: number,
  category?: string,
  inStockOnly?: boolean,
): Promise<{ results: Product[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (inStockOnly) params.set('inStock', 'true');

  const res = await fetch(`${API}/api/v1/products?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ results: Product[]; total: number }>;
}

async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  const res = await fetch(`${API}/api/v1/products/categories`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<{ category: string; count: number }[]>;
}

export default function SearchPage({
  query,
  category,
  onSearch,
  onProduct,
  onHome,
}: {
  query: string;
  category?: string;
  onSearch: (q: string, category?: string) => void;
  onProduct: (slug: string) => void;
  onHome: () => void;
}) {
  const [draft, setDraft] = useState(query);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setPage(1), [query, category, inStockOnly]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, inStockOnly, page],
    queryFn: () => searchProducts(query, page, category, inStockOnly),
    placeholderData: (previous) => previous,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: fetchCategories,
  });

  const results = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const categoryOptions = getCategoryOptions(categoriesData?.map((c) => c.category));
  const title = query
    ? `Resultados para "${query}"`
    : category
    ? categoryLabel(category)
    : 'Buscar juegos';

  function goToPage(nextPage: number) {
    setPage(Math.min(totalPages, Math.max(1, nextPage)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[17rem_1fr] lg:py-8">
      <SeoHead
        title={`${title} | Juegospedia`}
        description={category
          ? `${categoryDescription(category)} Compara precio, stock y envío en tiendas de México.`
          : `Busca ${query || 'juegos de mesa'} y compara disponibilidad, precios y tiendas en Juegospedia.`}
        path={`/search?${new URLSearchParams({
          ...(query ? { q: query } : {}),
          ...(category ? { category } : {}),
        }).toString()}`}
        noindex={Boolean(query)}
        jsonLd={category ? breadcrumbJsonLd([
          ['Inicio', 'https://juegospedia.com/'],
          ['Categorías', 'https://juegospedia.com/search'],
          [categoryLabel(category), `https://juegospedia.com/search?category=${encodeURIComponent(category)}`],
        ]) : undefined}
      />
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
        <Breadcrumbs items={[
          { label: 'Inicio', href: '/', onClick: onHome },
          ...(category
            ? [
                { label: 'Categorías', href: '/search', onClick: () => onSearch('', undefined) },
                { label: categoryLabel(category) },
              ]
            : [{ label: query ? `Búsqueda: ${query}` : 'Catálogo' }]),
        ]} />
        <section className="mb-6 rounded-lg border border-[--border] bg-[--bg-raised] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {category ? categoryLabel(category) : 'Marketplace'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[--tx]">{title}</h1>
              <p className="mt-1 text-sm text-[--tx-muted]">
                {data
                  ? `${data.total.toLocaleString('es-MX')} juegos encontrados · página ${page} de ${totalPages}`
                  : categoryDescription(category)}
              </p>
            </div>

            <form
              className="flex min-w-0 gap-2 md:w-[26rem]"
              onSubmit={(e) => {
                e.preventDefault();
                trackEvent('search', {
                  search_term: draft.trim(),
                  category: category ?? 'all',
                });
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
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {results.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cashbackPct={cashbackPct}
                  priority={page === 1 && index < 8}
                  onClick={() => onProduct(product.slug)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Paginación del catálogo"
                className="mt-8 flex flex-wrap items-center justify-center gap-2"
              >
                <Button
                  variant="outline"
                  disabled={page === 1 || isLoading}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {getPaginationRange(page, totalPages).map((item, index) =>
                    item === '...' ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 py-2 text-sm text-[--tx-faint]"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => goToPage(item)}
                        aria-label={`Ir a la página ${item}`}
                        aria-current={item === page ? 'page' : undefined}
                        className={cn(
                          'h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition-colors',
                          item === page
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-[--border] bg-[--bg-raised] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>

                <Button
                  variant="outline"
                  disabled={page === totalPages || isLoading}
                  onClick={() => goToPage(page + 1)}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function getPaginationRange(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: Array<number | '...'> = [1];
  if (current > 3) pages.push('...');
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    pages.push(page);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function breadcrumbJsonLd(items: Array<[string, string]>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item,
    })),
  };
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
