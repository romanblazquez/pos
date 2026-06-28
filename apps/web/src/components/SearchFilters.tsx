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
  min?: number;
  max?: number;
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
      ? { filters: 'Filtros', cat: 'Categoría', all: 'Todas', avail: 'Disponibilidad', inStock: 'Solo con stock', sort: 'Ordenar', price: 'Precio (MXN)', min: 'mín', max: 'máx', apply: 'Aplicar filtros', clear: 'Limpiar' }
      : { filters: 'Filters', cat: 'Category', all: 'All', avail: 'Availability', inStock: 'In stock only', sort: 'Sort', price: 'Price (MXN)', min: 'min', max: 'max', apply: 'Apply filters', clear: 'Clear' };

  const sortOpts: { value: SortBy; es: string; en: string }[] = [
    { value: 'rank_score', es: 'Relevancia', en: 'Relevance' },
    { value: 'price_asc', es: 'Precio: menor a mayor', en: 'Price: low to high' },
    { value: 'price_desc', es: 'Precio: mayor a menor', en: 'Price: high to low' },
    { value: 'name', es: 'Nombre (A-Z)', en: 'Name (A-Z)' },
  ];

  const active = Boolean(state.category || state.inStock || state.sort || state.min || state.max);

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
        <label className="filter-toggle-card">
          <span>
            <b>{t.inStock}</b>
            <small>{locale === 'es' ? 'Oculta productos agotados' : 'Hide sold-out products'}</small>
          </span>
          <input type="checkbox" name="inStock" value="true" defaultChecked={state.inStock} />
        </label>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.price}>
        <div className="filter-price">
          <label>
            <span>{locale === 'es' ? 'Mínimo' : 'Minimum'}</span>
            <input type="number" name="min" min={0} defaultValue={state.min ?? ''} placeholder={t.min} aria-label={t.min} />
          </label>
          <label>
            <span>{locale === 'es' ? 'Máximo' : 'Maximum'}</span>
            <input type="number" name="max" min={0} defaultValue={state.max ?? ''} placeholder={t.max} aria-label={t.max} />
          </label>
        </div>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.sort}>
        <select name="sort" defaultValue={state.sort ?? 'rank_score'} className="filter-select">
          {sortOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {locale === 'es' ? o.es : o.en}
            </option>
          ))}
        </select>
      </CatalogFilterSection>

      <CatalogFilterSection title={t.cat}>
        <div className="filter-category-list">
        <label className="filter-opt" aria-current={!state.category || undefined}>
          <input type="radio" name="category" value="" defaultChecked={!state.category} /> {t.all}
        </label>
        {categories.map((c) => {
          const active = state.category === c.category;
          return (
            <label key={c.category} className="filter-opt" aria-current={active || undefined}>
              <input type="radio" name="category" value={c.category} defaultChecked={active} />{' '}
              {c.category} <span className="muted">({c.count})</span>
            </label>
          );
        })}
        </div>
      </CatalogFilterSection>

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
