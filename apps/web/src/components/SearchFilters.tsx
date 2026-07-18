import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, CatalogFilterPanel, CatalogFilterSection, FilterCategoryButton, FilterChip, FilterToggle } from '@retail-os/ui-react';
import type { CatalogFacets, CategoryCount, MechanicCount, SortBy } from '@/lib/api';
import { slugify, type Locale } from '@/lib/segments';
import { FormAutoSubmit } from './FormAutoSubmit';

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
  publisher?: string;
  yearPublished?: number;
  minAge?: number;
  playTimeMinutes?: number;
}


/** Badge count for the filter sheet trigger. Lives here so the rule that decides
 *  "how many filters are on" stays next to the controls that set them. */
export function filterActiveCount(state: FilterState) {
  return [state.category, state.inStock, state.max, state.players, state.complexity,
    state.publisher, state.yearPublished, state.minAge, state.playTimeMinutes]
    .filter(Boolean).length + state.mechanics.length;
}

/** Labels for the filter sheet. The page owns <FilterSheet> (the trigger sits by
 *  the search field, the rail inside the panel), so the strings live here beside
 *  the rest of the filter copy rather than being reinvented at the call site. */
export function filterSheetLabels(locale: Locale, total?: number) {
  const subtitle = total == null
    ? undefined
    : `${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${locale === 'es' ? 'resultados' : 'results'}`;
  return locale === 'es'
    ? { open: 'Abrir filtros', title: 'Filtros', subtitle, close: 'Cerrar filtros', apply: 'Ver resultados' }
    : { open: 'Open filters', title: 'Filters', subtitle, close: 'Close filters', apply: 'View results' };
}

// Server-rendered faceted filters (no client JS): the whole search view is one
// GET <form>, so changing any control and pressing "Aplicar" reloads with the
// combined query — crawlable, shareable, and works without hydration.
export function SearchFilters({
  locale,
  categories,
  mechanics,
  facets,
  state,
  total,
  clearHref,
}: {
  locale: Locale;
  categories: CategoryCount[];
  mechanics: MechanicCount[];
  facets: CatalogFacets;
  state: FilterState;
  total: number;
  clearHref: string;
}) {
  const t =
    locale === 'es'
      ? { filters: 'Filtros', cat: 'Categorías', all: 'Todo el catálogo', avail: 'Disponibilidad', inStock: 'Solo con stock', inStockHint: 'Oculta productos agotados', price: 'Presupuesto', players: 'Jugadores', apply: 'Aplicar filtros', clear: 'Limpiar', allStores: 'Todas las tiendas conectadas', complexity: 'Complejidad', mechanics: 'Mecánicas', sort: 'Ordenar', publisher: 'Editorial', year: 'Año', age: 'Edad recomendada', duration: 'Duración', any: 'Cualquiera', more: (n: number) => `Ver ${n} más` }
      : { filters: 'Filters', cat: 'Categories', all: 'Full catalogue', avail: 'Availability', inStock: 'In stock only', inStockHint: 'Hide sold-out products', price: 'Budget', players: 'Players', apply: 'Apply filters', clear: 'Clear', allStores: 'All connected stores', complexity: 'Complexity', mechanics: 'Mechanics', sort: 'Sort', publisher: 'Publisher', year: 'Year', age: 'Recommended age', duration: 'Duration', any: 'Any', more: (n: number) => `Show ${n} more` };

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

  const active = Boolean(state.category || state.inStock || state.max || state.players
    || state.mechanics.length > 0 || state.complexity || state.publisher
    || state.yearPublished || state.minAge || state.playTimeMinutes);

  return (
    <CatalogFilterPanel
      title={locale === 'es' ? 'Explorar' : 'Explore'}
      subtitle={`${total.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')} ${locale === 'es' ? 'resultados' : 'results'}`}
      icon={<SlidersHorizontal size={16} aria-hidden="true" />}
      aria-label={t.filters}
      action={active ? (
        // A native <a>, not next/link: the chips are uncontrolled inputs
        // (defaultChecked), and a soft client nav updates the URL and classes
        // but leaves their checked DOM state intact — so the filters would look
        // cleared yet resubmit on the next change. A full-document load
        // remounts the form with fresh, empty defaults, which is what actually
        // clears it (and matches this panel's no-JS-first contract).
        <a
          href={clearHref}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)"
        >
          <RotateCcw size={12} aria-hidden="true" />
          {t.clear}
        </a>
      ) : undefined}
      footer={<Button type="submit" className="w-full js-hidden">{t.apply}</Button>}
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

      <CatalogFilterSection title={t.avail}>
        <FilterToggle
          name="inStock"
          checked={state.inStock}
          label={t.inStock}
          description={t.inStockHint}
          className="mobile-filter-choice"
        />
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

      <CatalogFilterSection title={locale === 'es' ? 'Detalles del juego' : 'Game details'}>
        <div className="grid gap-2">
          <label className="grid gap-1 text-[11px] font-semibold text-(--tx-muted)">
            {t.publisher}
            <select name="publisher" defaultValue={state.publisher ?? ''} className="filter-select" aria-label={t.publisher}>
              <option value="">{t.any}</option>
              {facets.publishers.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-semibold text-(--tx-muted)">
              {t.year}
              <select name="year" defaultValue={state.yearPublished ?? ''} className="filter-select" aria-label={t.year}>
                <option value="">{t.any}</option>
                {facets.years.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-(--tx-muted)">
              {t.age}
              <select name="age" defaultValue={state.minAge ?? ''} className="filter-select" aria-label={t.age}>
                <option value="">{t.any}</option>
                {facets.ages.map((item) => <option key={item.value} value={item.value}>{item.value}+ ({item.count})</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[11px] font-semibold text-(--tx-muted)">
            {t.duration}
            <select name="duration" defaultValue={state.playTimeMinutes ?? ''} className="filter-select" aria-label={t.duration}>
              <option value="">{t.any}</option>
              {facets.durations.map((item) => <option key={item.value} value={item.value}>{item.value} min ({item.count})</option>)}
            </select>
          </label>
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
            <FilterCategoryButton
              key={c.value}
              name="category"
              value={c.value}
              active={c.isActive}
              label={c.label}
              description={c.description}
              count={c.count}
              className="mobile-filter-choice"
            />
          ))}
        </div>
      </CatalogFilterSection>

      <FormAutoSubmit />
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
