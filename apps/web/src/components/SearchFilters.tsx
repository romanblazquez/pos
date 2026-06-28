import Link from 'next/link';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
    { label: locale === 'es' ? 'Sin tope' : 'No limit', value: '' },
    { label: locale === 'es' ? 'Hasta $500' : 'Up to $500', value: '500' },
    { label: locale === 'es' ? 'Hasta $1,000' : 'Up to $1,000', value: '1000' },
    { label: locale === 'es' ? 'Hasta $1,500' : 'Up to $1,500', value: '1500' },
  ];
  const playerOpts = [
    { label: locale === 'es' ? 'Todos' : 'Any', value: '' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5+', value: '5' },
  ];

  const active = Boolean(state.category || state.inStock || state.max || state.players);

  return (
    <CatalogFilterPanel
      title={locale === 'es' ? 'Explorar' : 'Explore'}
      subtitle={`${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${locale === 'es' ? 'resultados' : 'results'}`}
      icon={<SlidersHorizontal size={16} aria-hidden="true" />}
      aria-label={t.filters}
      action={active ? (
        <Link
          href={clearHref}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]"
        >
          <RotateCcw size={12} aria-hidden="true" />
          {t.clear}
        </Link>
      ) : undefined}
    >
      {/* Availability — styled to match ToggleFilter in marketplace */}
      <CatalogFilterSection title={t.avail}>
        <label className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors
          ${state.inStock
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
            : 'border-[--border] bg-[--bg-subtle] hover:bg-[--bg-hover]'}`}
        >
          <span>
            <span className="block text-sm font-semibold text-[--tx]">{t.inStock}</span>
            <span className="mt-0.5 block text-xs text-[--tx-muted]">{t.inStockHint}</span>
          </span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border
            ${state.inStock ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[--border-strong]'}`}
          >
            {state.inStock && <Check size={12} aria-hidden="true" />}
          </span>
          <input type="checkbox" name="inStock" value="true" defaultChecked={state.inStock} className="sr-only" />
        </label>
      </CatalogFilterSection>

      {/* Budget chips — matches marketplace 2-col grid */}
      <CatalogFilterSection title={t.price}>
        <div className="grid grid-cols-2 gap-1.5">
          {budgetOpts.map((o) => {
            const isActive = o.value === '' ? state.max == null : state.max === Number(o.value);
            return (
              <label
                key={o.value}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors
                  ${isActive
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'}`}
              >
                <input type="radio" name="max" value={o.value} defaultChecked={isActive} className="sr-only" />
                {o.label}
              </label>
            );
          })}
        </div>
      </CatalogFilterSection>

      {/* Players — matches marketplace flex row */}
      <CatalogFilterSection title={t.players}>
        <div className="flex flex-wrap gap-1.5">
          {playerOpts.map((o) => {
            const isActive = o.value === '' ? state.players == null : state.players === Number(o.value);
            return (
              <label
                key={o.value}
                className={`h-8 cursor-pointer rounded-lg border px-2 text-xs font-semibold transition-colors inline-flex items-center justify-center min-w-8
                  ${isActive
                    ? 'border-emerald-600 bg-emerald-700 text-white'
                    : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'}`}
              >
                <input type="radio" name="players" value={o.value} defaultChecked={isActive} className="sr-only" />
                {o.label}
              </label>
            );
          })}
        </div>
      </CatalogFilterSection>

      {/* Categories — matches CategorySideButton in marketplace */}
      <CatalogFilterSection title={t.cat}>
        <div className="space-y-1">
          {[
            {
              value: '',
              label: t.all,
              description: t.allStores,
              count: categories.reduce((sum, c) => sum + c.count, 0),
              isActive: !state.category,
            },
            ...categories.map((c) => ({
              value: c.category,
              label: c.category,
              description: locale === 'es' ? 'Colección curada del marketplace.' : 'Curated marketplace collection.',
              count: c.count,
              isActive: state.category === c.category,
            })),
          ].map((c) => (
            <label
              key={c.value}
              className={`mb-1 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors
                ${c.isActive
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'}`}
            >
              <input type="radio" name="category" value={c.value} defaultChecked={c.isActive} className="sr-only" />
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>{c.label}</span>
                <span className="rounded-full border border-current/15 px-1.5 py-0.5 text-[10px] font-medium opacity-70">{c.count}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-[--tx-muted]">{c.description}</span>
            </label>
          ))}
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
