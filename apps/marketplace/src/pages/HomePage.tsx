import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
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

async function fetchProducts(page: number, category?: string): Promise<ProductsResponse> {
  const offset = (page - 1) * PAGE_SIZE;
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (category) params.set('category', category);

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
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', page, activeCategory],
    queryFn: () => fetchProducts(page, activeCategory),
    placeholderData: (prev) => prev,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: fetchCategories,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 0;
  const featuredProduct = data?.results.find((product) => product.images[0]);
  const categoryOptions = getCategoryOptions(categoriesData?.map((c) => c.category));
  const minPrice = data?.results.reduce<number | null>((lowest, product) => {
    if (product.minPriceMinor <= 0) return lowest;
    return lowest === null ? product.minPriceMinor : Math.min(lowest, product.minPriceMinor);
  }, null);

  function selectCategory(category?: string) {
    setActiveCategory(category);
    setPage(1);
  }

  return (
    <div>
      <section className="border-b border-[--border] bg-[--bg-raised]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-lg border border-[--border] bg-[--bg-raised] p-5 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="max-w-3xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Marketplace verificado
                  </div>
                  <h1 className="text-3xl font-bold leading-tight tracking-normal text-[--tx] sm:text-4xl">
                    Encuentra juegos con stock real, mejor precio y créditos.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[--tx-muted] sm:text-base">
                    Busca una vez y compara tiendas conectadas, disponibilidad, envío y cashback sin abrir diez pestañas.
                  </p>
                </div>

                <form
                  className="flex flex-col gap-2 rounded-lg border border-[--border] bg-[--bg-subtle] p-2 sm:flex-row"
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
                      className="h-10 w-full rounded-md border border-[--border] bg-[--bg-input] py-2 pl-9 pr-3 text-sm text-[--tx]
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
          <div className="sticky top-24 rounded-lg border border-[--border] bg-[--bg-raised] p-3 shadow-sm">
            <div className="flex items-center gap-2 px-2 pb-3">
              <SlidersHorizontal className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <p className="text-sm font-semibold text-[--tx]">Explorar</p>
            </div>
            <CategorySideButton active={!activeCategory} label="Todo el catálogo" description="Todas las tiendas" onClick={() => selectCategory(undefined)} />
            {categoryOptions.map((category) => (
              <CategorySideButton
                key={category.value}
                active={activeCategory === category.value}
                label={category.label}
                description={category.description}
                onClick={() => selectCategory(category.value)}
              />
            ))}
          </div>
        </aside>

        <div className="min-w-0">
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
            {data && totalPages > 1 && (
              <p className="text-sm text-[--tx-muted]">Página {page} de {totalPages}</p>
            )}
          </div>

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
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
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
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-[--tx-muted]">{description}</span>
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
