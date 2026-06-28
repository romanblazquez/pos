import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { ProductCard, type Product } from '../components/ProductCard.js';
import { Button, cn } from '../components/ui/index.js';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import {
  categoryDescription,
  categoryLabel,
  formatMoney,
  getCategoryOptions,
} from '../marketplace-meta.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 24;

interface ProductsResponse {
  results: Product[];
  total: number;
  source: string;
}

type SortOption = 'rank_score' | 'price_asc' | 'price_desc' | 'name';

interface CatalogFilters {
  inStockOnly: boolean;
  maxPrice?: number;
  players?: number;
  sortBy: SortOption;
}

const DEFAULT_FILTERS: CatalogFilters = {
  inStockOnly: false,
  sortBy: 'rank_score',
};

const PRICE_OPTIONS = [
  { label: 'Hasta $500', value: 50_000 },
  { label: 'Hasta $1,000', value: 100_000 },
  { label: 'Hasta $1,500', value: 150_000 },
] as const;

const PLAYER_OPTIONS = [1, 2, 3, 4, 5] as const;

async function fetchProducts(page: number, category: string | undefined, filters: CatalogFilters): Promise<ProductsResponse> {
  const offset = (page - 1) * PAGE_SIZE;
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    sortBy: filters.sortBy,
  });
  if (category) params.set('category', category);
  if (filters.inStockOnly) params.set('inStock', 'true');
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.players) params.set('minPlayers', String(filters.players));

  const res = await fetch(`${API}/api/v1/products?${params.toString()}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<ProductsResponse>;
}

async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  const res = await fetch(`${API}/api/v1/products/categories`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<{ category: string; count: number }[]>;
}

interface HomePageProps {
  onSearch: (q: string, category?: string) => void;
  onProduct: (slug: string) => void;
}

export default function HomePage({ onSearch, onProduct }: HomePageProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', page, activeCategory, filters],
    queryFn: () => fetchProducts(page, activeCategory, filters),
    placeholderData: (prev) => prev,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: fetchCategories,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 0;
  const featuredProduct = data?.results.find((product) => product.images[0]);
  const categoryOptions = getCategoryOptions(categoriesData?.map((c) => c.category));
  const categoryCounts = new Map(categoriesData?.map((item) => [item.category, item.count]) ?? []);
  const activeFilterCount =
    Number(filters.inStockOnly) +
    Number(Boolean(filters.maxPrice)) +
    Number(Boolean(filters.players)) +
    Number(filters.sortBy !== DEFAULT_FILTERS.sortBy);
  const minPrice = data?.results.reduce<number | null>((lowest, product) => {
    if (product.minPriceMinor <= 0) return lowest;
    return lowest === null ? product.minPriceMinor : Math.min(lowest, product.minPriceMinor);
  }, null);

  function selectCategory(category?: string) {
    setActiveCategory(category);
    setPage(1);
  }

  function updateFilters(next: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setActiveCategory(undefined);
    setPage(1);
  }

  return (
    <div>
      <section className="market-surface-pattern border-b border-[--border] bg-[--bg]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-[14px] border border-[--border] bg-[--bg-raised]/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <div className="flex flex-col gap-5">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Marketplace verificado
                  </div>
                  <h1 className="max-w-[18ch] font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-[--tx] sm:text-5xl">
                    Encuentra juegos con stock real, mejor precio y créditos.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[--tx-muted] sm:text-lg">
                    Busca una vez y compara tiendas conectadas, disponibilidad, envío y cashback sin abrir diez pestañas.
                  </p>
                </div>

                <form
                  className="flex flex-col gap-2 rounded-[13px] border border-[--border] bg-[--bg-subtle] p-2 shadow-sm sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSearch(q.trim(), activeCategory);
                  }}
                >
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--tx-faint]" aria-hidden="true" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Busca Catan, Root, Wingspan..."
                      className="h-11 w-full rounded-[10px] border border-[--border] bg-[--bg-input] py-2 pl-9 pr-3 text-sm text-[--tx]
                                 placeholder:text-[--tx-faint] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <Button type="submit" className="h-10 shrink-0">
                    Buscar
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard icon={<PackageCheck className="h-4 w-4" />} label="Catálogo" value={data?.total.toLocaleString('es-MX') ?? '900+'} />
                  <MetricCard icon={<Truck className="h-4 w-4" />} label="Comparación" value="Stock + envío" />
                  <MetricCard icon={<BadgePercent className="h-4 w-4" />} label="Crédito libre" value={`${Math.round(cashbackPct * 100)}%`} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <FeaturedProduct product={featuredProduct} onProduct={onProduct} />
              <SellerCallout />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[--border] bg-[--bg-raised]">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3">
          <CategoryPill active={!activeCategory} label="Todo" onClick={() => selectCategory(undefined)} />
          {categoryOptions.map((category) => (
            <CategoryPill
              key={category.value}
              active={activeCategory === category.value}
              label={category.label}
              onClick={() => selectCategory(category.value)}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <CatalogFilterPanel
            activeCategory={activeCategory}
            activeFilterCount={activeFilterCount}
            categories={categoryOptions}
            categoryCounts={categoryCounts}
            filters={filters}
            total={data?.total}
            onCategory={selectCategory}
            onFilters={updateFilters}
            onReset={resetFilters}
          />
        </aside>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <Button variant="outline" onClick={() => setMobileFiltersOpen(true)}>
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Limpiar todo
              </button>
            )}
          </div>

          <div className="mb-5 flex flex-col justify-between gap-3 rounded-lg border border-[--border] bg-[--bg-raised] p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {activeCategory ? categoryLabel(activeCategory) : 'Catálogo'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-[--tx]">Ofertas disponibles</h2>
              <p className="mt-1 text-sm text-[--tx-muted]">
                {data
                  ? `${data.total.toLocaleString('es-MX')} resultados${minPrice ? ` desde ${formatMoney(minPrice)}` : ''}`
                  : categoryDescription(activeCategory)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-[--tx-muted]" htmlFor="catalog-sort">Ordenar</label>
              <select
                id="catalog-sort"
                value={filters.sortBy}
                onChange={(event) => updateFilters({ sortBy: event.target.value as SortOption })}
                className="h-9 rounded-lg border border-[--border] bg-[--bg-input] px-3 text-sm text-[--tx] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="rank_score">Recomendados</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="name">Nombre A–Z</option>
              </select>
            </div>
          </div>

          {(activeCategory || activeFilterCount > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeCategory && (
                <FilterChip label={categoryLabel(activeCategory)} onClear={() => selectCategory(undefined)} />
              )}
              {filters.inStockOnly && <FilterChip label="Con stock" onClear={() => updateFilters({ inStockOnly: false })} />}
              {filters.maxPrice && (
                <FilterChip label={`Hasta ${formatMoney(filters.maxPrice)}`} onClear={() => updateFilters({ maxPrice: undefined })} />
              )}
              {filters.players && (
                <FilterChip label={`${filters.players}+ jugadores`} onClear={() => updateFilters({ players: undefined })} />
              )}
            </div>
          )}

          {isLoading && !data && <CatalogSkeleton />}

          {isError && (
            <div className="rounded-lg border border-[--border] bg-[--bg-raised] px-4 py-16 text-center text-[--tx-muted]">
              <p className="font-medium text-[--tx]">No se pudo cargar el catálogo.</p>
              <p className="mt-1 text-sm">Intenta de nuevo en unos segundos.</p>
            </div>
          )}

          {data && data.results.length === 0 && (
            <div className="rounded-lg border border-[--border] bg-[--bg-raised] px-4 py-16 text-center text-[--tx-muted]">
              <p className="font-medium text-[--tx]">No hay resultados en esta categoría.</p>
              <button
                onClick={() => selectCategory(undefined)}
                className="mt-3 rounded-lg border border-[--border] bg-[--bg-subtle] px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-[--bg-hover] dark:text-emerald-300"
              >
                Ver todo el catálogo
              </button>
            </div>
          )}

          {data && data.results.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {data.results.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cashbackPct={cashbackPct}
                    priority={index < 8}
                    onClick={() => onProduct(product.slug)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Anterior
                  </Button>

                  <div className="flex gap-1">
                    {getPaginationRange(page, totalPages).map((item, i) =>
                      item === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-[--tx-faint]">...</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={cn(
                            'h-9 w-9 rounded-lg border text-sm transition-colors',
                            item === page
                              ? 'border-emerald-700 bg-emerald-700 font-semibold text-white'
                              : 'border-[--border] bg-[--bg-raised] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
                          )}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>

                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[min(90vw,22rem)] overflow-y-auto bg-[--bg] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[--tx]">Filtrar catálogo</p>
                <p className="text-xs text-[--tx-muted]">Encuentra la mejor opción más rápido</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileFiltersOpen(false)} aria-label="Cerrar filtros">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CatalogFilterPanel
              activeCategory={activeCategory}
              activeFilterCount={activeFilterCount}
              categories={categoryOptions}
              categoryCounts={categoryCounts}
              filters={filters}
              total={data?.total}
              mobile
              onCategory={selectCategory}
              onFilters={updateFilters}
              onReset={resetFilters}
            />
            <Button className="mt-4 w-full" onClick={() => setMobileFiltersOpen(false)}>
              Ver {data?.total.toLocaleString('es-MX') ?? ''} resultados
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[--border] bg-[--bg-raised] p-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
        {icon}
      </div>
      <p className="text-xs text-[--tx-muted]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[--tx]">{value}</p>
    </div>
  );
}

function FeaturedProduct({ product, onProduct }: { product?: Product; onProduct: (slug: string) => void }) {
  if (!product) {
    return (
      <div className="rounded-lg border border-[--border] bg-[--bg-raised] p-4 shadow-sm">
        <div className="aspect-[4/3] rounded-lg bg-[--bg-subtle]" />
      </div>
    );
  }

  return (
    <button
      onClick={() => onProduct(product.slug)}
      className="group overflow-hidden rounded-lg border border-[--border] bg-[--bg-raised] text-left shadow-sm transition-colors hover:bg-[--bg-hover]"
    >
      <div className="aspect-[4/3] bg-[--bg-subtle]">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[--tx-faint]">
            <PackageCheck className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Destacado</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[--tx]">{product.name}</p>
        <p className="mt-2 text-sm text-[--tx-muted]">Desde {formatMoney(product.minPriceMinor)}</p>
      </div>
    </button>
  );
}

function SellerCallout() {
  return (
    <div className="rounded-lg border border-[--border] bg-[--bg-raised] p-4 shadow-sm">
      <Store className="mb-3 h-5 w-5 text-emerald-700" aria-hidden="true" />
      <p className="text-sm font-semibold text-[--tx]">¿Tienes tienda?</p>
      <p className="mt-1 text-sm text-[--tx-muted]">Conecta tu catálogo y publica disponibilidad real.</p>
      <Button asChild variant="outline" className="mt-4 w-full">
        <a href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}>
          Registrar tienda
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

function CategoryPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-emerald-700 bg-emerald-700 text-white'
          : 'border-[--border] bg-[--bg-raised] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
      )}
    >
      {label}
    </button>
  );
}

function CategorySideButton({
  active,
  label,
  description,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors',
        active
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
      )}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        {count !== undefined && (
          <span className="rounded-full border border-current/15 px-1.5 py-0.5 text-[10px] font-medium opacity-70">{count}</span>
        )}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-[--tx-muted]">{description}</span>
    </button>
  );
}

function CatalogFilterPanel({
  activeCategory,
  activeFilterCount,
  categories,
  categoryCounts,
  filters,
  total,
  mobile = false,
  onCategory,
  onFilters,
  onReset,
}: {
  activeCategory?: string;
  activeFilterCount: number;
  categories: ReturnType<typeof getCategoryOptions>;
  categoryCounts: Map<string, number>;
  filters: CatalogFilters;
  total?: number;
  mobile?: boolean;
  onCategory: (category?: string) => void;
  onFilters: (filters: Partial<CatalogFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div className={cn(
      'rounded-xl border border-[--border] bg-[--bg-raised] p-3 shadow-sm',
      !mobile && 'sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto',
    )}>
      <div className="flex items-start justify-between gap-3 border-b border-[--border] px-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[--tx]">Explorar</p>
            <p className="text-[11px] text-[--tx-muted]">{total?.toLocaleString('es-MX') ?? '—'} resultados</p>
          </div>
        </div>
        {(activeCategory || activeFilterCount > 0) && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      <FilterSection title="Disponibilidad">
        <ToggleFilter
          checked={filters.inStockOnly}
          label="Solo con stock"
          description="Oculta productos agotados"
          onClick={() => onFilters({ inStockOnly: !filters.inStockOnly })}
        />
      </FilterSection>

      <FilterSection title="Presupuesto">
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilters({ maxPrice: filters.maxPrice === option.value ? undefined : option.value })}
              className={cn(
                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                filters.maxPrice === option.value
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Jugadores">
        <div className="flex flex-wrap gap-1.5">
          {PLAYER_OPTIONS.map((players) => (
            <button
              key={players}
              onClick={() => onFilters({ players: filters.players === players ? undefined : players })}
              className={cn(
                'h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition-colors',
                filters.players === players
                  ? 'border-emerald-600 bg-emerald-700 text-white'
                  : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
              )}
            >
              {players === 5 ? '5+' : players}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Categorías">
        <div className="space-y-1">
          <CategorySideButton
            active={!activeCategory}
            label="Todo el catálogo"
            description="Todas las tiendas conectadas"
            count={categories.reduce((sum, category) => sum + (categoryCounts.get(category.value) ?? 0), 0)}
            onClick={() => onCategory(undefined)}
          />
          {categories.map((category) => (
            <CategorySideButton
              key={category.value}
              active={activeCategory === category.value}
              label={category.label}
              description={category.description}
              count={categoryCounts.get(category.value)}
              onClick={() => onCategory(category.value)}
            />
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[--border] px-1 py-4 last:border-b-0 last:pb-1">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[--tx-faint]">{title}</p>
      {children}
    </div>
  );
}

function ToggleFilter({
  checked,
  label,
  description,
  onClick,
}: {
  checked: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors',
        checked
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
          : 'border-[--border] bg-[--bg-subtle] hover:bg-[--bg-hover]',
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-[--tx]">{label}</span>
        <span className="mt-0.5 block text-xs text-[--tx-muted]">{description}</span>
      </span>
      <span className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
        checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[--border-strong]',
      )}>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i);
  if (current < total - 2) pages.push('...');
  add(total);
  return pages;
}

function CatalogSkeleton() {
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
