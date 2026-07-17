import Link from 'next/link';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, CatalogFilterPanel, CatalogFilterSection, FilterChip } from '@retail-os/ui-react';
import type { CategoryCount, MechanicCount, SortBy } from '@/lib/api';
import { slugify, type Locale } from '@/lib/segments';
import { FormAutoSubmit } from './FormAutoSubmit';
import { ResponsiveFilterPanel } from './ResponsiveFilterPanel';

// Same bggWeight bands as apps/marketplace/src/pages/ProductPage.tsx's
// ComplexityMeter and the API's complexity-bands.ts — keeps the filter and
// the product-page display (and both frontends) all in agreement.
const COMPLEXITY_OPTIONS = [
  { value: 'light', es: 'Ligero', en: 'Light' },
  { value: 'medium-light', es: 'Medio-ligero', en: 'Medium-light' },
  { value: 'medium', es: 'Medio', en: 'Medium' },
  { value: 'heavy', es: 'Pesado', en: 'Heavy' },
  { value: 'expert', es: 'Experto', en: 'Expert' },
] as const;

const CATEGORY_LABELS: Record<string, { es: string; en: string }> = {
  'board-game': { es: 'Juegos de mesa', en: 'Board games' },
  expansion: { es: 'Expansiones', en: 'Expansions' },
  Preventas: { es: 'Preventas', en: 'Preorders' },
};

function categoryLabel(category: string, locale: Locale) {
  return CATEGORY_LABELS[category]?.[locale] ?? category.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryDescription(category: string, locale: Locale) {
  if (category === 'board-game') return locale === 'es' ? 'Clásicos modernos, estrategia, familiares y party games.' : 'Modern classics, strategy, family and party games.';
  if (category === 'expansion') return locale === 'es' ? 'Amplía los juegos que ya están en tu mesa.' : 'Expand games already on your table.';
  return locale === 'es' ? 'Colección curada del marketplace.' : 'Curated marketplace collection.';
}

export interface FilterState {
  q: string;
  category?: string;
  inStock: boolean;
  sort?: SortBy;
  max?: number;
  players?: number;
  mechanics: string[];
  complexity?: string;
}

// Server-rendered faceted filters (no client JS): the whole search view is one
// GET <form>, so changing any control and pressing "Aplicar" reloads with the
// combined query — crawlable, shareable, and works without hydration.
export function SearchFilters({
  locale,
  categories,
  mechanics,
  state,
  total,
  clearHref,
}: {
  locale: Locale;
  categories: CategoryCount[];
  mechanics: MechanicCount[];
  state: FilterState;
  total: number;
  clearHref: string;
}) {
  const t =
    locale === 'es'
      ? { filters: 'Filtros', cat: 'Categorías', all: 'Todo el catálogo', avail: 'Disponibilidad', inStock: 'Solo con stock', inStockHint: 'Oculta productos agotados', price: 'Presupuesto', players: 'Jugadores', apply: 'Aplicar filtros', clear: 'Limpiar', allStores: 'Todas las tiendas conectadas', complexity: 'Complejidad', mechanics: 'Mecánicas', sort: 'Ordenar', more: (n: number) => `Ver ${n} más` }
      : { filters: 'Filters', cat: 'Categories', all: 'Full catalogue', avail: 'Availability', inStock: 'In stock only', inStockHint: 'Hide sold-out products', price: 'Budget', players: 'Players', apply: 'Apply filters', clear: 'Clear', allStores: 'All connected stores', complexity: 'Complexity', mechanics: 'Mechanics', sort: 'Sort', more: (n: number) => `Show ${n} more` };

  // Every one of these already worked end-to-end (FilterState.sort -> API
  // sortBy) but had no control — `sort` was a hidden input, so the only way to
  // reorder results was to hand-edit the URL. §04 lists Sort as a form control.
  const sortOpts: { value: SortBy; es: string; en: string }[] = [
    { value: 'rank_score', es: 'Mejor coincidencia', en: 'Best match' },
    { value: 'price_asc', es: 'Precio: de menor a mayor', en: 'Price: low to high' },
    { value: 'price_desc', es: 'Precio: de mayor a menor', en: 'Price: high to low' },
    { value: 'name', es: 'Nombre (A–Z)', en: 'Name (A–Z)' },
  ];

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

  // Keep the rail short enough that the sections below Mecánicas stay reachable
  // without scrolling inside a sticky panel.
  const MECHANICS_SHOWN = 6;
  const rankedMechanics = mechanics.slice(0, 15);
  const visibleMechanics = rankedMechanics.slice(0, MECHANICS_SHOWN);
  const hiddenMechanics = rankedMechanics.slice(MECHANICS_SHOWN);

  const mechanicChip = (m: MechanicCount) => (
    <FilterChip
      key={m.mechanic}
      name="mechanics"
      value={m.mechanic}
      inputType="checkbox"
      active={state.mechanics.includes(m.mechanic)}
    >
      {m.mechanic}
    </FilterChip>
  );

  const active = Boolean(state.category || state.inStock || state.max || state.players || state.mechanics.length > 0 || state.complexity);
  const activeCount = [state.category, state.inStock, state.max, state.players, state.complexity]
    .filter(Boolean).length + state.mechanics.length;

  return (
    <ResponsiveFilterPanel locale={locale} activeCount={activeCount}>
    <CatalogFilterPanel
      title={locale === 'es' ? 'Explorar' : 'Explore'}
      subtitle={`${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${locale === 'es' ? 'resultados' : 'results'}`}
      icon={<SlidersHorizontal size={16} aria-hidden="true" />}
      aria-label={t.filters}
      action={active ? (
        <Link
          href={clearHref}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)"
        >
          <RotateCcw size={12} aria-hidden="true" />
          {t.clear}
        </Link>
      ) : undefined}
    >
      {/* Sort — a native select, not the Radix one: this panel is a no-JS GET
          form (see FormAutoSubmit), so the control has to work unhydrated. */}
      <CatalogFilterSection title={t.sort}>
        <select name="sort" defaultValue={state.sort ?? 'rank_score'} className="filter-select" aria-label={t.sort}>
          {sortOpts.map((o) => (
            <option key={o.value} value={o.value}>{o[locale]}</option>
          ))}
        </select>
      </CatalogFilterSection>

      {/* Availability — styled to match ToggleFilter in marketplace */}
      <CatalogFilterSection title={t.avail}>
        <label data-filter="row"
          className={`mobile-filter-choice flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors
          ${state.inStock
            ? 'border-(--primary) bg-(--accent-bg)'
            : 'border-(--border) bg-(--bg-subtle) hover:bg-(--bg-hover)'}`}
        >
          <span>
            <span className="block text-sm font-semibold text-(--tx)">{t.inStock}</span>
            <span className="mt-0.5 block text-xs text-(--tx-muted)">{t.inStockHint}</span>
          </span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border
            ${state.inStock ? 'border-(--primary) bg-(--primary) text-(--primary-foreground)' : 'border-(--border-strong)'}`}
          >
            {state.inStock && <Check size={12} aria-hidden="true" />}
          </span>
          <input type="checkbox" name="inStock" value="true" defaultChecked={state.inStock} className="sr-only" />
        </label>
      </CatalogFilterSection>

      {/* Budget chips — matches marketplace 2-col grid */}
      <CatalogFilterSection title={t.price}>
        <div className="grid grid-cols-2 gap-1.5">
          {budgetOpts.map((o) => (
            <FilterChip
              key={o.value}
              name="max"
              value={o.value}
              inputType="radio"
              active={o.value === '' ? state.max == null : state.max === Number(o.value)}
            >
              {o.label}
            </FilterChip>
          ))}
        </div>
      </CatalogFilterSection>

      {/* Players — matches marketplace flex row */}
      <CatalogFilterSection title={t.players}>
        <div className="flex flex-wrap gap-1.5">
          {playerOpts.map((o) => (
            <FilterChip
              key={o.value}
              name="players"
              value={o.value}
              inputType="radio"
              shape="compact"
              active={o.value === '' ? state.players == null : state.players === Number(o.value)}
            >
              {o.label}
            </FilterChip>
          ))}
        </div>
      </CatalogFilterSection>

      {/* Complexity — matches apps/marketplace's complexity band chips */}
      <CatalogFilterSection title={t.complexity}>
        <div className="flex flex-wrap gap-1.5">
          {COMPLEXITY_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              name="complexity"
              value={o.value}
              inputType="radio"
              active={state.complexity === o.value}
            >
              {o[locale]}
            </FilterChip>
          ))}
        </div>
      </CatalogFilterSection>

      {/* Mechanics — checkboxes, natively submit multiple values in a GET form.
          15 chips ran 468px, over a third of the rail, pushing Categorías behind
          an internal scroll. Only the top few show; the rest live in a <details>
          so the disclosure works with no JS, like the rest of this panel.
          Collapsed inputs still submit — <details> hides its content, it doesn't
          remove it from the form. */}
      {mechanics.length > 0 && (
        <CatalogFilterSection title={t.mechanics}>
          <div className="flex flex-wrap gap-1.5">
            {visibleMechanics.map(mechanicChip)}
          </div>
          {hiddenMechanics.length > 0 && (
            // Opened when one of the user's own picks is in here — never hide
            // an active filter behind a disclosure.
            <details className="filter-more" open={hiddenMechanics.some((m) => state.mechanics.includes(m.mechanic))}>
              <summary className="filter-more-summary">{t.more(hiddenMechanics.length)}</summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {hiddenMechanics.map(mechanicChip)}
              </div>
            </details>
          )}
        </CatalogFilterSection>
      )}

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
              label: categoryLabel(c.category, locale),
              description: categoryDescription(c.category, locale),
              count: c.count,
              isActive: state.category === c.category,
            })),
          ].map((c) => (
            <label
              key={c.value}
              data-filter="row"
              className={`mobile-filter-choice mb-1 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors
                ${c.isActive
                  ? 'border border-(--primary) bg-(--accent-bg) text-(--tx)'
                  : 'border border-(--border) bg-(--bg-subtle) text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)'}`}
            >
              <input type="radio" name="category" value={c.value} defaultChecked={c.isActive} className="sr-only" />
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>{c.label}</span>
                <span className="rounded-full border border-current/15 px-1.5 py-0.5 text-[10px] font-medium opacity-70">{c.count}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-(--tx-muted)">{c.description}</span>
            </label>
          ))}
        </div>
      </CatalogFilterSection>

      <FormAutoSubmit />
      {/* Fallback submit for no-JS environments */}
      <Button type="submit" className="mt-3 w-full js-hidden">{t.apply}</Button>
    </CatalogFilterPanel>
    </ResponsiveFilterPanel>
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
