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
  CatalogSearchBar,
  FilterChip,
  FilterSheet,
  FilterSheetPanel,
  FilterSheetTrigger,
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
import {
  COMPLEXITY_OPTIONS,
  MECHANICS_RANKED,
  MECHANICS_SHOWN,
  PLAYER_OPTIONS,
  PRICE_OPTIONS,
  SORT_OPTIONS,
  type SortBy,
} from '../catalog-filter-options.js';

// Filter axes live in catalog-filter-options.ts, shared with HomePage.
// `sortBy` stays undefined until the user picks one: the API counts it in
// hasStructuredFilters, so always sending it would silently disable semantic
// search for natural-language queries.

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** react-intl's `locale` is bare ('es'/'en'); Intl.NumberFormat wants a full BCP47 tag. */
function numberLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'es-MX';
}
const PAGE_SIZE = 24;

async function searchProducts(
  q: string,
  page: number,
  locale: string,
  category?: string,
  inStockOnly?: boolean,
  maxPrice?: number,
  players?: number,
  mechanics: string[] = [],
  complexity?: string,
  sortBy?: SortBy,
): Promise<{ results: Product[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    locale,
  });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (inStockOnly) params.set('inStock', 'true');
  if (maxPrice) params.set('maxPrice', String(maxPrice));
  if (players) params.set('minPlayers', String(players));
  if (complexity) params.set('complexity', complexity);
  if (sortBy) params.set('sortBy', sortBy);
  for (const mechanic of mechanics) params.append('mechanics', mechanic);
  // Mirrors the API's hasStructuredFilters, which counts sortBy — so an explicit
  // sort turns semantic search off rather than sending a contradictory pair.
  const hasFilters = Boolean(category || inStockOnly || maxPrice || players || mechanics.length || complexity || sortBy);
  if (!hasFilters && isNaturalLanguageQuery(q)) params.set('semantic', 'true');

  const res = await fetch(`${API}/api/v1/products?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ results: Product[]; total: number }>;
}

function isNaturalLanguageQuery(query: string): boolean {
  return query.trim().length >= 18 && query.trim().split(/\s+/).length >= 4;
}

async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  const res = await fetch(`${API}/api/v1/products/categories`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<{ category: string; count: number }[]>;
}

async function fetchMechanics(): Promise<{ mechanic: string; count: number }[]> {
  const res = await fetch(`${API}/api/v1/products/mechanics`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<{ mechanic: string; count: number }[]>;
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
  const [mechanics, setMechanics] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data: platformCfg } = usePlatformConfig();
  const cashbackPct = platformCfg?.platformCashbackPct ?? 0.01;

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setPage(1), [query, category, inStockOnly, maxPrice, players, mechanics, complexity, sortBy]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, inStockOnly, maxPrice, players, mechanics, complexity, sortBy, page, intl.locale],
    queryFn: () => searchProducts(query, page, intl.locale, category, inStockOnly, maxPrice, players, mechanics, complexity, sortBy),
    placeholderData: (previous) => previous,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: fetchCategories,
  });

  const { data: mechanicsData } = useQuery({
    queryKey: ['marketplace-mechanics'],
    queryFn: fetchMechanics,
  });

  const rankedMechanics = (mechanicsData ?? []).slice(0, MECHANICS_RANKED);
  const hiddenMechanics = rankedMechanics.slice(MECHANICS_SHOWN);
  const mechanicChip = (mechanic: string) => {
    const active = mechanics.includes(mechanic);
    return (
      <FilterChip
        key={mechanic}
        active={active}
        onClick={() => setMechanics((current) => (
          active ? current.filter((m) => m !== mechanic) : [...current, mechanic]
        ))}
      >
        {mechanic}
      </FilterChip>
    );
  };

  const activeFilterCount =
    Number(inStockOnly) + Number(maxPrice !== undefined) + Number(players !== undefined)
    + Number(complexity !== undefined) + Number(sortBy !== undefined) + mechanics.length;

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
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 min-[861px]:grid-cols-[17rem_1fr] min-[861px]:py-8">
      <FilterSheet
        labels={{
          open: intl.formatMessage({ id: 'home.filterCatalog' }),
          title: intl.formatMessage({ id: 'home.filters' }),
          close: intl.formatMessage({ id: 'home.closeFilters' }),
          apply: intl.formatMessage({ id: 'home.viewResults' }, { count: data?.total.toLocaleString(numberLocale(intl.locale)) ?? '' }),
        }}
        activeCount={activeFilterCount}
        // Filters apply on change here; the sheet only has to close.
        onApply={() => undefined}
      >
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
      <aside>
        <FilterSheetPanel>
        <CatalogFilterPanel
          title={intl.formatMessage({ id: 'home.explore' })}
          subtitle={intl.formatMessage({ id: 'home.resultsCount' }, { count: data?.total.toLocaleString(numberLocale(intl.locale)) ?? '—' })}
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          action={(inStockOnly || maxPrice !== undefined || players !== undefined || mechanics.length > 0 || complexity !== undefined || sortBy !== undefined || category) ? (
            <button
              type="button"
              onClick={() => {
                setInStockOnly(false);
                setMaxPrice(undefined);
                setPlayers(undefined);
                setMechanics([]);
                setComplexity(undefined);
                setSortBy(undefined);
                onSearch(query, undefined);
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]"
            >
              <RotateCcw className="h-3 w-3" />
              {intl.formatMessage({ id: 'home.clear' })}
            </button>
          ) : undefined}
        >
          {/* Sort leads the panel, matching the SEO app's rail order. */}
          <CatalogFilterSection title={intl.formatMessage({ id: 'home.sort' })}>
            <select
              className="filter-select"
              aria-label={intl.formatMessage({ id: 'home.sort' })}
              value={sortBy ?? 'rank_score'}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{intl.formatMessage({ id: o.labelId })}</option>
              ))}
            </select>
          </CatalogFilterSection>

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
                <FilterChip
                  key={option.value ?? 'none'}
                  active={maxPrice === option.value}
                  onClick={() => setMaxPrice(maxPrice === option.value ? undefined : option.value)}
                >
                  {intl.formatMessage({ id: option.labelId })}
                </FilterChip>
              ))}
            </div>
          </CatalogFilterSection>

          <CatalogFilterSection title={intl.formatMessage({ id: 'home.players' })}>
            <div className="flex flex-wrap gap-1.5">
              {PLAYER_OPTIONS.map((p) => (
                <FilterChip
                  key={p ?? 'any'}
                  shape="compact"
                  active={players === p}
                  onClick={() => setPlayers(players === p ? undefined : p)}
                >
                  {p === undefined ? intl.formatMessage({ id: 'search.playersAny' }) : p === 5 ? '5+' : p}
                </FilterChip>
              ))}
            </div>
          </CatalogFilterSection>

          <CatalogFilterSection title={intl.formatMessage({ id: 'product.complexity' })}>
            <div className="flex flex-wrap gap-1.5">
              {COMPLEXITY_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  active={complexity === option.value}
                  onClick={() => setComplexity(complexity === option.value ? undefined : option.value)}
                >
                  {intl.formatMessage({ id: option.labelId })}
                </FilterChip>
              ))}
            </div>
          </CatalogFilterSection>

          {mechanicsData && mechanicsData.length > 0 && (
            <CatalogFilterSection title={intl.formatMessage({ id: 'home.mechanics' })}>
              <div className="flex flex-wrap gap-1.5">
                {rankedMechanics.slice(0, MECHANICS_SHOWN).map(({ mechanic }) => mechanicChip(mechanic))}
              </div>
              {hiddenMechanics.length > 0 && (
                // Opened when one of the user's own picks is in here — never
                // hide an active filter behind a disclosure.
                <details className="filter-more" open={hiddenMechanics.some((m) => mechanics.includes(m.mechanic))}>
                  <summary className="filter-more-summary">
                    {intl.formatMessage({ id: 'home.showMore' }, { count: hiddenMechanics.length })}
                  </summary>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {hiddenMechanics.map(({ mechanic }) => mechanicChip(mechanic))}
                  </div>
                </details>
              )}
            </CatalogFilterSection>
          )}

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
        </FilterSheetPanel>
      </aside>

      <main className="min-w-0">
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
              className="min-w-0 md:w-[26rem]"
              onSubmit={(e) => {
                e.preventDefault();
                trackEvent('search', {
                  search_term: draft.trim(),
                  category: category ?? 'all',
                });
                onSearch(draft.trim(), category);
              }}
            >
              <CatalogSearchBar
                endpoint={`${API}/api/v1/products/suggestions`}
                value={draft}
                onValueChange={setDraft}
                onSearch={(term) => onSearch(term, category)}
                onProduct={onProduct}
                placeholder={intl.formatMessage({ id: 'search.refine' })}
                submitLabel={intl.formatMessage({ id: 'search.search' })}
                trailing={<FilterSheetTrigger />}
              />
            </form>
          </div>

          {(category || inStockOnly || maxPrice !== undefined || players !== undefined || mechanics.length > 0 || complexity !== undefined) && (
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
              {complexity !== undefined && (
                <ActiveChip
                  label={intl.formatMessage({ id: COMPLEXITY_OPTIONS.find((o) => o.value === complexity)?.labelId ?? 'product.complexity' })}
                  onClear={() => setComplexity(undefined)}
                />
              )}
              {mechanics.map((mechanic) => (
                <ActiveChip
                  key={mechanic}
                  label={mechanic}
                  onClear={() => setMechanics((current) => current.filter((m) => m !== mechanic))}
                />
              ))}
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
      </FilterSheet>
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
