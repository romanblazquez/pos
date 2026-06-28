import Link from 'next/link';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, CatalogFilterPanel, CatalogFilterSection } from '@retail-os/ui-react';
import type { CategoryCount, SortBy } from '@/lib/api';
import { slugify, type Locale } from '@/lib/segments';

export interface FilterState {
  q: string;
  category?: string;
  inStock: boolean;
  sort?: SortBy;
  max?: number;
  players?: number;
}

// Server-rendered faceted filters (no client JS): the whole search view is one
// GET <form>, so changing any control and pressing "Aplicar" reloads with the
// combined query — crawlable, shareable, and works without hydration.
export function SearchFilters({
  locale,
  categories,
  state,
  total,
  clearHref,
}: {
  locale: Locale;
  categories: CategoryCount[];
  state: FilterState;
  total: number;
  clearHref: string;
}) {
  const t =
    locale === 'es'
      ? { filters: 'Filtros', cat: 'Categorías', all: 'Todo el catálogo', avail: 'Disponibilidad', inStock: 'Solo con stock', inStockHint: 'Oculta productos agotados', price: 'Presupuesto', players: 'Jugadores', apply: 'Aplicar filtros', clear: 'Limpiar', allStores: 'Todas las tiendas conectadas' }
      : { filters: 'Filters', cat: 'Categories', all: 'Full catalogue', avail: 'Availability', inStock: 'In stock only', inStockHint: 'Hide sold-out products', price: 'Budget', players: 'Players', apply: 'Apply filters', clear: 'Clear', allStores: 'All connected stores' };

  const budgetOpts = [
    { label: locale === 'es' ? 'Hasta $500' : 'Up to $500', value: 500 },
    { label: locale === 'es' ? 'Hasta $1,000' : 'Up to $1,000', value: 1000 },
    { label: locale === 'es' ? 'Hasta $1,500' : 'Up to $1,500', value: 1500 },
  ];
  const playerOpts = [1, 2, 3, 4, 5];

  const active = Boolean(state.category || state.inStock || state.max || state.players);

  return (
    <CatalogFilterPanel
      title={locale === 'es' ? 'Explorar' : 'Explore'}
      subtitle={`${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${locale === 'es' ? 'resultados' : 'results'}`}
      icon={<SlidersHorizontal size={16} aria-hidden="true" />}
      aria-label={t.filters}
      action={active ? (
        <Link className="filter-reset" href={clearHref}>
          <RotateCcw size={12} aria-hidden="true" /> {t.clear}
        </Link>
      ) : undefined}
    >
      <CatalogFilterSection title={t.avail}>
        <label className="filter-toggle-card market-toggle">
          <span>
            <b>{t.inStock}</b>
            <small>{t.inStockHint}</small>
          </span>
          <input type="checkbox" name="inStock" value="true" defaultChecked={state.inStock} />
        </label>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.price}>
        <div className="market-chip-grid">
          <label className={`market-chip ${state.max === undefined ? 'is-active' : ''}`}>
            <input type="radio" name="max" value="" defaultChecked={state.max == null} />
            {locale === 'es' ? 'Sin tope' : 'No cap'}
          </label>
          {budgetOpts.map((o) => (
            <label key={o.value} className={`market-chip ${state.max === o.value ? 'is-active' : ''}`}>
              <input type="radio" name="max" value={String(o.value)} defaultChecked={state.max === o.value} />
              {o.label}
            </label>
          ))}
        </div>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.players}>
        <div className="market-players-row">
          <label className={`market-player-chip ${state.players === undefined ? 'is-active' : ''}`}>
            <input type="radio" name="players" value="" defaultChecked={state.players == null} />
            {locale === 'es' ? 'Todos' : 'Any'}
          </label>
          {playerOpts.map((p) => (
            <label key={p} className={`market-player-chip ${state.players === p ? 'is-active' : ''}`}>
              <input type="radio" name="players" value={String(p)} defaultChecked={state.players === p} />
              {p === 5 ? '5+' : p}
            </label>
          ))}
        </div>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.cat}>
        <div className="market-category-list">
          <label className={`market-category-card ${!state.category ? 'is-active' : ''}`}>
            <input type="radio" name="category" value="" defaultChecked={!state.category} />
            <span className="market-category-head">
              <span>{t.all}</span>
              <span className="market-category-count">{categories.reduce((sum, c) => sum + c.count, 0)}</span>
            </span>
            <span className="market-category-desc">{t.allStores}</span>
          </label>
          {categories.map((c) => {
            const categoryActive = state.category === c.category;
            return (
              <label key={c.category} className={`market-category-card ${categoryActive ? 'is-active' : ''}`}>
                <input type="radio" name="category" value={c.category} defaultChecked={categoryActive} />
                <span className="market-category-head">
                  <span>{c.category}</span>
                  <span className="market-category-count">{c.count}</span>
                </span>
                <span className="market-category-desc">
                  {locale === 'es' ? 'Colección curada del marketplace.' : 'Curated marketplace collection.'}
                </span>
              </label>
            );
          })}
        </div>
      </CatalogFilterSection>

      <input type="hidden" name="sort" value={state.sort ?? 'rank_score'} />
      <Button type="submit" className="mt-3 w-full">{t.apply}</Button>
    </CatalogFilterPanel>
  );
}

// Reverse-map a category slug from the URL back to the real DB value if needed.
export function categoryFromParam(value: string | undefined, categories: CategoryCount[]): string | undefined {
  if (!value) return undefined;
  return (
    categories.find((c) => c.category === value)?.category ??
    categories.find((c) => slugify(c.category) === value)?.category
  );
}
