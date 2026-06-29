'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils.js';

interface ProductSuggestion {
  kind: 'product';
  slug: string;
  label: string;
  image: string | null;
  publisher: string | null;
  category: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  bggRating: number | null;
  inStock?: boolean;
}

interface FacetSuggestion {
  kind: 'mechanic' | 'publisher' | 'category';
  label: string;
  value: string;
}

interface SuggestionResponse {
  products: ProductSuggestion[];
  mechanics: FacetSuggestion[];
  publishers: FacetSuggestion[];
  categories: FacetSuggestion[];
}

type CommandItem = ProductSuggestion | FacetSuggestion | { kind: 'recent'; label: string; value: string };

export interface CatalogSearchProps {
  endpoint: string;
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  onProduct: (slug: string) => void;
  locale?: 'es' | 'en';
  placeholder?: string;
  inputName?: string;
  globalShortcut?: boolean;
  className?: string;
  inputClassName?: string;
}

const EMPTY: SuggestionResponse = { products: [], mechanics: [], publishers: [], categories: [] };

export function CatalogSearch({
  endpoint,
  value,
  onValueChange,
  onSearch,
  onProduct,
  locale = 'es',
  placeholder,
  inputName,
  globalShortcut = false,
  className,
  inputClassName,
}: CatalogSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<SuggestionResponse>(EMPTY);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>();

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('jp-search-recent') ?? '[]') as unknown;
      if (Array.isArray(parsed)) setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 4));
    } catch {
      setRecent([]);
    }
  }, []);

  React.useEffect(() => {
    if (!globalShortcut) return;
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [globalShortcut]);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('q', value.trim());
        url.searchParams.set('limit', '6');
        const result = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
        if (!result.ok) throw new Error('suggestions failed');
        setResponse(await result.json() as SuggestionResponse);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setResponse(EMPTY);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, value.trim() ? 160 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, open, value]);

  const recentItems: CommandItem[] = value.trim()
    ? []
    : recent.map((label) => ({ kind: 'recent' as const, label, value: label }));
  const items: CommandItem[] = [
    ...recentItems,
    ...response.products,
    ...response.mechanics,
    ...response.publishers,
    ...response.categories,
  ];

  React.useEffect(() => setActiveIndex(items.length ? 0 : -1), [value, response, recent]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(undefined);
      return;
    }

    const positionPanel = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - width - viewportPadding,
      );
      setPanelStyle({ left, top: rect.bottom + 10, width });
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open]);

  function remember(term: string) {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 4);
    setRecent(next);
    localStorage.setItem('jp-search-recent', JSON.stringify(next));
  }

  function choose(item: CommandItem) {
    setOpen(false);
    if (item.kind === 'product') {
      remember(item.label);
      onProduct(item.slug);
      return;
    }
    remember(item.value);
    onValueChange(item.value);
    onSearch(item.value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(items.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        choose(items[activeIndex]);
      } else {
        remember(value);
      }
    }
  }

  const gamesLabel = locale === 'es' ? 'Juegos' : 'Games';
  const facetsLabel = locale === 'es' ? 'Mecánicas · Editoriales · Categorías' : 'Mechanics · Publishers · Categories';

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <SearchGlyph className={cn(
        'pointer-events-none absolute left-3.5 top-1/2 z-10 h-[19px] w-[19px] -translate-y-1/2 transition-colors',
        open ? 'text-[var(--search-accent,var(--accent))]' : 'text-[var(--tx-faint)]',
      )} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        name={inputName}
        value={value}
        onChange={(event) => { onValueChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'h-[46px] w-full appearance-none rounded-xl border bg-[var(--search-input,var(--bg-input))] py-3 pl-[43px] text-[15px] leading-[20px] text-[var(--tx)] transition-[border-color,box-shadow] placeholder:text-[var(--tx-faint)] focus:outline-none [&::-webkit-search-cancel-button]:hidden',
          open
            ? 'border-[1.5px] border-[var(--search-accent,var(--accent))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--search-accent,var(--accent))_14%,transparent)]'
            : 'border-[var(--border)]',
          globalShortcut ? 'pr-[58px]' : 'pr-3.5',
          inputClassName,
        )}
      />
      {globalShortcut && (
        <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border-strong,var(--border))] bg-[var(--bg-subtle)] px-[7px] py-[3px] font-mono text-[11px] font-normal leading-[14px] text-[var(--tx-faint)]">⌘K</kbd>
      )}
      {open && panelStyle && createPortal(
        <div
          id={listboxId}
          role="listbox"
          style={panelStyle}
          className="fixed z-[100] max-h-[26rem] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--tx)] shadow-[0_10px_26px_rgba(43,38,34,.10)]"
        >
          {recentItems.length > 0 && <CommandHeading>{locale === 'es' ? 'Recientes' : 'Recent'}</CommandHeading>}
          {recentItems.map((item, index) => <CommandRow key={`recent-${item.label}`} item={item} active={index === activeIndex} locale={locale} onChoose={() => choose(item)} />)}
          {response.products.length > 0 && <CommandHeading>{value.trim() ? gamesLabel : locale === 'es' ? 'Tendencias' : 'Trending'}</CommandHeading>}
          {response.products.map((item, index) => {
            const flatIndex = recentItems.length + index;
            return <CommandRow key={item.slug} item={item} active={flatIndex === activeIndex} locale={locale} onChoose={() => choose(item)} />;
          })}
          {(response.mechanics.length + response.publishers.length + response.categories.length) > 0 && <CommandHeading>{facetsLabel}</CommandHeading>}
          {[...response.mechanics, ...response.publishers, ...response.categories].map((item, index) => {
            const flatIndex = recentItems.length + response.products.length + index;
            return <CommandRow key={`${item.kind}-${item.value}`} item={item} active={flatIndex === activeIndex} locale={locale} onChoose={() => choose(item)} />;
          })}
          {loading && items.length === 0 && (
            <div className="flex items-center gap-[11px] px-3.5 py-3 text-[12.5px] text-[var(--tx-muted)]">
              <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[var(--border-strong,var(--border))] border-t-[var(--search-accent,var(--accent))]" />
              {locale === 'es' ? 'Buscando juegos…' : 'Searching games…'}
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center px-4 py-6 text-center">
              <span className="mb-2.5 grid h-[38px] w-[38px] place-items-center rounded-full bg-[var(--bg-subtle)] text-[var(--search-accent,var(--accent))]">
                <SearchGlyph className="h-[19px] w-[19px]" aria-hidden="true" />
              </span>
              <span className="text-[14px] font-bold text-[var(--tx)]">{locale === 'es' ? 'No encontramos coincidencias' : 'No matches found'}</span>
              <span className="mt-1 text-[12.5px] leading-[1.45] text-[var(--tx-muted)]">{locale === 'es' ? 'Prueba con el título, la mecánica o la editorial.' : 'Try a title, mechanic, or publisher.'}</span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function CommandHeading({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-[var(--border)] px-3.5 pb-[7px] pt-[11px] first:border-t-0 font-mono text-[10px] font-normal uppercase tracking-[1.5px] text-[var(--tx-faint)]">{children}</p>;
}

function CommandRow({ item, active, locale, onChoose }: { item: CommandItem; active: boolean; locale: 'es' | 'en'; onChoose: () => void }) {
  if (item.kind === 'product') {
    const players = item.minPlayers
      ? `${item.minPlayers}${item.maxPlayers && item.maxPlayers !== item.minPlayers ? `–${item.maxPlayers}` : ''} jug.`
      : null;
    return (
      <button type="button" role="option" aria-selected={active} onMouseDown={(event) => event.preventDefault()} onClick={onChoose} className={cn('flex w-full items-center gap-[11px] px-3.5 py-[9px] text-left', active ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]')}>
        <span className="h-[38px] w-[30px] shrink-0 overflow-hidden rounded-[5px] bg-[var(--bg-subtle)]">
          {item.image
            ? <img src={item.image} alt="" className="h-full w-full object-cover" />
            : <span className="block h-full w-full bg-[repeating-linear-gradient(45deg,#E7D3A6,#E7D3A6_5px,#DEC691_5px,#DEC691_10px)] dark:bg-[repeating-linear-gradient(45deg,#594C32,#594C32_5px,#463B28_5px,#463B28_10px)]" />}
        </span>
        <span className="min-w-0 flex-1">
          <ProductSuggestionLabel label={item.label} />
          <span className="block truncate font-mono text-[11px] text-[var(--tx-muted)]">
            {[players, item.playTimeMinutes ? `${item.playTimeMinutes} min` : null, item.bggRating ? `★ ${item.bggRating.toFixed(1)}` : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        {active && <span className="font-mono text-[11px] text-[var(--search-accent,var(--accent))]">↵</span>}
      </button>
    );
  }

  return (
    <button type="button" role="option" aria-selected={active} onMouseDown={(event) => event.preventDefault()} onClick={onChoose} className={cn('flex w-full items-center gap-[11px] px-3.5 py-[9px] text-left last:pb-3', active ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]')}>
      <span className={cn(
        'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px]',
        item.kind === 'mechanic' ? 'bg-[#E3EAF1] text-[#3A5876] dark:bg-[#26384A] dark:text-[#8EB1D3]' : 'bg-[var(--bg-subtle)] text-[var(--tx-muted)]',
      )}>{item.kind === 'publisher'
        ? <PublisherGlyph />
        : item.kind === 'recent'
          ? <SearchGlyph className="h-[15px] w-[15px]" aria-hidden="true" />
          : item.kind === 'category'
            ? <CategoryGlyph />
            : <MechanicGlyph />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-[var(--tx)]">{item.label}</span>
        <span className="block font-mono text-[11px] text-[var(--tx-muted)]">
          {locale === 'es'
            ? item.kind === 'mechanic' ? 'Mecánica' : item.kind === 'publisher' ? 'Editorial' : item.kind === 'category' ? 'Categoría' : 'Reciente'
            : item.kind === 'mechanic' ? 'Mechanic' : item.kind === 'publisher' ? 'Publisher' : item.kind === 'category' ? 'Category' : 'Recent'}
        </span>
      </span>
    </button>
  );
}

function ProductSuggestionLabel({ label }: { label: string }) {
  const match = label.match(/^(.*?)(\s+\([^()]+\))$/);
  return (
    <span className="block truncate text-[14px] font-semibold text-[var(--tx)]">
      {match ? match[1] : label}
      {match && <span className="font-normal text-[var(--tx-faint)]">{match[2]}</span>}
    </span>
  );
}

function SearchGlyph({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MechanicGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PublisherGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function CategoryGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}
