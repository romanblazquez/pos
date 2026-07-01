import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import { ProductCard, type Product } from '../components/ProductCard.js';
import { Button, cn } from '../components/ui/index.js';
import {
  CatalogFilterPanel,
  CatalogFilterSection,
  CatalogSearch,
  FilterToggle,
  FilterCategoryButton,
} from '@retail-os/ui-react';
import { usePlatformConfig } from '../hooks/usePlatformConfig.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { SeoHead } from '../components/SeoHead.js';
import { trackEvent } from '../analytics.js';
import {
  categoryDescription,
  categoryLabel,
  getCategoryOptions,
} from '../marketplace-meta.js';

const PRICE_OPTIONS = [
  { labelId: 'search.noLimit', value: undefined },
  { labelId: 'home.priceUpTo500', value: 50_000 },
  { labelId: 'home.priceUpTo1000', value: 100_000 },
  { labelId: 'home.priceUpTo1500', value: 150_000 },
] as const;
const PLAYER_OPTIONS = [undefined, 1, 2, 3, 4, 5] as const;

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** react-intl's `locale` is bare ('es'/'en'); Intl.NumberFormat wants a full BCP47 tag. */
function numberLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'es-MX';
}
const PAGE_SIZE = 24;

async function searchProducts(
  q: string,
  page: number,
  category?: string,
  inStockOnly?: boolean,
  maxPrice?: number,
  players?: number,
): Promise<{ results: Product[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (inStockOnly) params.set('inStock', 'true');
  if (maxPrice) params.set('maxPrice', String(maxPrice));
  if (players) params.set('minPlayers', String(players));

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
  const intl = useIntl();
  const [draft, setDraft] = useState(query);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [players, setPlayers] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setPage(1), [query, category, inStockOnly, maxPrice, players]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, inStockOnly, maxPrice, players, page],
    queryFn: () => searchProducts(query, page, category, inStockOnly, maxPrice, players),
    placeholderData: (previous) => previous,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: fetchCategories,
  });

  const results = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const categoryOptions = getCategoryOptions(categoriesData?.map((c) => c.category), intl.locale as 'es' | 'en');
  const title = query
    ? intl.formatMessage({ id: 'search.resultsFor' }, { query })
    : category
    ? categoryLabel(category, intl.locale as 'es' | 'en')
    : intl.formatMessage({ id: 'search.title' });

  function goToPage(nextPage: number) {
    setPage(Math.min(totalPages, Math.max(1, nextPage)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[17rem_1fr] lg:py-8">
      <SeoHead
        title={`${title} | Juegospedia`}
        description={category
          ? `${categoryDescription(category, intl.locale as 'es' | 'en')} Compara precio, stock y envío en tiendas de México.`
          : `Busca ${query || 'juegos de mesa'} y compara disponibilidad, precios y tiendas en Juegospedia.`}
        path={`/search?${new URLSearchParams({
          ...(query ? { q: query } : {}),
          ...(category ? { category } : {}),
        }).toString()}`}
        noindex={Boolean(query)}
        jsonLd={category ? breadcrumbJsonLd([
          [intl.formatMessage({ id: 'search.home' }), 'https://juegospedia.com/'],
          [intl.formatMessage({ id: 'search.categoriesCrumb' }), 'https://juegospedia.com/search'],
          [categoryLabel(category, intl.locale as 'es' | 'en'), `https://juegospedia.com/search?category=${encodeURIComponent(category)}`],
        ]) : undefined}
      />
      <aside className="order-2 lg:order-1">
        <CatalogFilterPanel
          title={intl.formatMessage({ id: 'home.explore' })}
          subtitle={intl.formatMessage({ id: 'home.resultsCount' }, { count: data?.total.toLocaleString(numberLocale(intl.locale)) ?? '—' })}
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          action={(inStockOnly || maxPrice !== undefined || players !== undefined || category) ? (
            <button
              type="button"
              onClick={() => { setInStockOnly(false); setMaxPrice(undefined); setPlayers(undefined); onSearch(query, undefined); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]"
            >
              <RotateCcw className="h-3 w-3" />
              {intl.formatMessage({ id: 'home.clear' })}
            </button>
          ) : undefined}
        >
          <CatalogFilterSection title={intl.formatMessage({ id: 'home.availability' })}>
            <FilterToggle
              checked={inStockOnly}
              label={intl.formatMessage({ id: 'home.inStockOnly' })}
              description={intl.formatMessage({ id: 'home.inStockOnlyHint' })}
              onClick={() => setInStockOnly((v) => !v)}
            />
          </CatalogFilterSection>

          <CatalogFilterSection title={intl.formatMessage({ id: 'home.budget' })}>
            <div className="grid grid-cols-2 gap-1.5">
              {PRICE_OPTIONS.map((option) => (
                <button
                  key={option.value ?? 'none'}
                  type="button"
                  onClick={() => setMaxPrice(maxPrice === option.value ? undefined : option.value)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    maxPrice === option.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
                  )}
                >
                  {intl.formatMessage({ id: option.labelId })}
                </button>
              ))}
            </div>
          </CatalogFilterSection>

          <CatalogFilterSection title={intl.formatMessage({ id: 'home.players' })}>
            <div className="flex flex-wrap gap-1.5">
              {PLAYER_OPTIONS.map((p) => (
                <button
                  key={p ?? 'any'}
                  type="button"
                  onClick={() => setPlayers(players === p ? undefined : p)}
                  className={cn(
                    'h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition-colors',
                    players === p
                      ? 'border-emerald-600 bg-emerald-700 text-white'
                      : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]',
                  )}
                >
                  {p === undefined ? intl.formatMessage({ id: 'search.playersAny' }) : p === 5 ? '5+' : p}
                </button>
              ))}
            </div>
          </CatalogFilterSection>

          <CatalogFilterSection title={intl.formatMessage({ id: 'home.categories' })}>
            <div className="space-y-1">
              <FilterCategoryButton
                active={!category}
                label={intl.formatMessage({ id: 'home.allCatalog' })}
                description={intl.formatMessage({ id: 'home.allStoresConnected' })}
                count={categoriesData?.reduce((sum, item) => sum + item.count, 0)}
                onClick={() => onSearch(query, undefined)}
              />
              {categoryOptions.map((option) => (
                <FilterCategoryButton
                  key={option.value}
                  active={category === option.value}
                  label={option.label}
                  description={option.description}
                  count={categoriesData?.find((item) => item.category === option.value)?.count}
                  onClick={() => onSearch(query, option.value)}
                />
              ))}
            </div>
          </CatalogFilterSection>
        </CatalogFilterPanel>
      </aside>

      <main className="order-1 min-w-0 lg:order-2">
        <Breadcrumbs items={[
          { label: intl.formatMessage({ id: 'search.home' }), href: '/', onClick: onHome },
          ...(category
            ? [
                { label: intl.formatMessage({ id: 'search.categoriesCrumb' }), href: '/search', onClick: () => onSearch('', undefined) },
                { label: categoryLabel(category, intl.locale as 'es' | 'en') },
              ]
            : [{ label: query ? intl.formatMessage({ id: 'search.searchCrumb' }, { query }) : intl.formatMessage({ id: 'home.catalog' }) }]),
        ]} />
        <section className="mb-6 rounded-lg border border-[--border] bg-[--bg-raised] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {category ? categoryLabel(category, intl.locale as 'es' | 'en') : intl.formatMessage({ id: 'search.marketplace' })}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[--tx]">{title}</h1>
              <p className="mt-1 text-sm text-[--tx-muted]">
                {data
                  ? intl.formatMessage({ id: 'search.resultsSummary' }, { count: data.total.toLocaleString(numberLocale(intl.locale)), page, totalPages })
                  : categoryDescription(category, intl.locale as 'es' | 'en')}
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
              <CatalogSearch
                endpoint={`${API}/api/v1/products/suggestions`}
                value={draft}
                onValueChange={setDraft}
                onSearch={(term) => onSearch(term, category)}
                onProduct={onProduct}
                placeholder={intl.formatMessage({ id: 'search.refine' })}
              />
              <Button type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{intl.formatMessage({ id: 'search.search' })}</span>
              </Button>
            </form>
          </div>

          {(category || inStockOnly || maxPrice !== undefined || players !== undefined) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {category && (
                <ActiveChip label={categoryLabel(category, intl.locale as 'es' | 'en')} onClear={() => onSearch(query, undefined)} />
              )}
              {inStockOnly && (
                <ActiveChip label={intl.formatMessage({ id: 'search.inStock' })} onClear={() => setInStockOnly(false)} />
              )}
              {maxPrice !== undefined && (
                <ActiveChip
                  label={intl.formatMessage({ id: PRICE_OPTIONS.find((option) => option.value === maxPrice)?.labelId ?? 'search.budget' })}
                  onClear={() => setMaxPrice(undefined)}
                />
              )}
              {players !== undefined && (
                <ActiveChip label={intl.formatMessage({ id: 'search.players' }, { count: players === 5 ? '5+' : players })} onClear={() => setPlayers(undefined)} />
              )}
            </div>
          )}
        </section>

        {isLoading && <SearchSkeleton />}

        {isError && (
          <EmptyState
            icon={<SearchX className="h-9 w-9" aria-hidden="true" />}
            title={intl.formatMessage({ id: 'search.errorTitle' })}
            body={intl.formatMessage({ id: 'search.errorBody' })}
          />
        )}

        {!isLoading && !isError && !data && (
          <EmptyState
            icon={<Search className="h-9 w-9" aria-hidden="true" />}
            title={intl.formatMessage({ id: 'search.startTitle' })}
            body={intl.formatMessage({ id: 'search.startBody' })}
          />
        )}

        {data && results.length === 0 && (
          <EmptyState
            icon={<SearchX className="h-9 w-9" aria-hidden="true" />}
            title={intl.formatMessage({ id: 'search.noResultsTitle' })}
            body={intl.formatMessage({ id: 'search.noResultsBody' })}
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
                aria-label={intl.formatMessage({ id: 'search.paginationLabel' })}
                className="mt-8 flex flex-wrap items-center justify-center gap-2"
              >
                <Button
                  variant="outline"
                  disabled={page === 1 || isLoading}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  {intl.formatMessage({ id: 'search.previous' })}
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
                        aria-label={intl.formatMessage({ id: 'search.goToPage' }, { page: item })}
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
                  {intl.formatMessage({ id: 'search.next' })}
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
          <div className="aspect-square animate-pulse bg-[--bg-subtle]" />
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
