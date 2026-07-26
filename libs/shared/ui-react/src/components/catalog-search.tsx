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

type CommandItem =
  | ProductSuggestion
  | FacetSuggestion
  | { kind: 'recent'; label: string; value: string };

export interface CatalogSearchProps {
  endpoint: string;
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  /**
   * Resets the *applied* query behind the field — the results, not the textbox.
   *
   * Clearing only calls `onValueChange('')`, which empties the input and leaves
   * whatever the page is already showing. On a results view that reads as
   * broken: the box is empty but the list is still filtered. Pass this wherever
   * the field reflects an applied query so clear puts the full listing back.
   *
   * Deliberately opt-in, and it should be conditional on there being something
   * to restore. A field that leads *into* search (a home hero) has no applied
   * query, so navigating on clear would teleport the user to a results page
   * they never asked for.
   */
  onClear?: () => void;
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
  onClear,
  onProduct,
  locale = 'es',
  placeholder,
  inputName,
  globalShortcut = false,
  className,
  inputClassName,
}: CatalogSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLElement>(null);
  const suppressNextOpenRef = React.useRef(false);
  const listboxId = React.useId();
  const dialogTitleId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<SuggestionResponse>(EMPTY);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>();
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const onChange = () => setCompact(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('jp-search-recent') ?? '[]') as unknown;
      if (Array.isArray(parsed))
        setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 4));
    } catch {
      setRecent([]);
    }
  }, []);

  React.useEffect(() => {
    if (!globalShortcut) return;
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.requestAnimationFrame(() => {
          (compact ? mobileInputRef.current : inputRef.current)?.focus();
        });
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [compact, globalShortcut]);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        try {
          const url = new URL(endpoint, window.location.origin);
          url.searchParams.set('q', value.trim());
          url.searchParams.set('limit', compact ? '8' : '6');
          const result = await fetch(url, {
            signal: controller.signal,
            headers: { accept: 'application/json' },
          });
          if (!result.ok) throw new Error('suggestions failed');
          setResponse((await result.json()) as SuggestionResponse);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setResponse(EMPTY);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      value.trim() ? 160 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [compact, endpoint, open, value]);

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
    if (!open || compact) {
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
  }, [compact, open]);

  React.useEffect(() => {
    if (!open || !compact) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => mobileInputRef.current?.focus());
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => {
          suppressNextOpenRef.current = true;
          inputRef.current?.focus({ preventScroll: true });
        });
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, [compact, open]);

  function remember(term: string) {
    const clean = term.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, 4);
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

  function closeSearch(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        suppressNextOpenRef.current = true;
        inputRef.current?.focus({ preventScroll: true });
      });
    }
  }

  function submitValue() {
    const clean = value.trim();
    remember(clean);
    setOpen(false);
    onSearch(clean);
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
      closeSearch(false);
    } else if (event.key === 'Enter') {
      if (!compact && open && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        choose(items[activeIndex]);
      } else {
        event.preventDefault();
        submitValue();
      }
    }
  }

  const gamesLabel = locale === 'es' ? 'Juegos' : 'Games';
  const facetsLabel =
    locale === 'es'
      ? 'Mecánicas · Editoriales · Categorías'
      : 'Mechanics · Publishers · Categories';

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <SearchGlyph
        className={cn(
          'pointer-events-none absolute left-3.5 top-1/2 z-10 h-[19px] w-[19px] -translate-y-1/2 transition-colors',
          open ? 'text-[var(--search-accent,var(--accent))]' : 'text-[var(--tx-faint)]',
        )}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        name={inputName}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (suppressNextOpenRef.current) {
            suppressNextOpenRef.current = false;
            return;
          }
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          if (!compact) window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        readOnly={compact}
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
          globalShortcut ? 'pr-[88px]' : value ? 'pr-11' : 'pr-3.5',
          inputClassName,
        )}
      />
      {value && (
        <button
          type="button"
          aria-label={locale === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
          title={locale === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
          className={cn(
            'absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--tx-faint)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--tx)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            globalShortcut ? 'right-[52px]' : 'right-1.5',
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange('');
            setOpen(false);
            setActiveIndex(-1);
            onClear?.();
            inputRef.current?.focus();
          }}
        >
          <CloseSearchIcon />
        </button>
      )}
      {globalShortcut && (
        <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border-strong,var(--border))] bg-[var(--bg-subtle)] px-[7px] py-[3px] font-mono text-[11px] font-normal leading-[14px] text-[var(--tx-faint)] sm:block">
          ⌘K
        </kbd>
      )}
      {open &&
        createPortal(
          <>
            {!compact && panelStyle && (
              <div
                id={listboxId}
                role="listbox"
                style={panelStyle}
                className="fixed z-[100] hidden max-h-[26rem] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--tx)] shadow-[0_10px_26px_rgba(43,38,34,.10)] sm:block"
              >
                <CommandResults
                  recentItems={recentItems}
                  response={response}
                  value={value}
                  loading={loading}
                  items={items}
                  activeIndex={activeIndex}
                  locale={locale}
                  gamesLabel={gamesLabel}
                  facetsLabel={facetsLabel}
                  onChoose={choose}
                />
              </div>
            )}

            {compact && (
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="fixed inset-0 z-[110] flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-raised)] text-[var(--tx)] sm:hidden"
              >
                <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-raised)] px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
                  <div className="mb-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => closeSearch()}
                      aria-label={locale === 'es' ? 'Cerrar búsqueda' : 'Close search'}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--tx)] active:scale-[.97]"
                    >
                      <ArrowLeftGlyph />
                    </button>
                    <div className="min-w-0">
                      <p className="font-mono text-[9.5px] uppercase tracking-[1.6px] text-[var(--search-accent,var(--accent))]">
                        Juegospedia
                      </p>
                      <h1
                        id={dialogTitleId}
                        className="truncate font-display text-[19px] font-bold leading-tight tracking-[-.02em]"
                      >
                        {locale === 'es' ? 'Encuentra tu próximo juego' : 'Find your next game'}
                      </h1>
                    </div>
                  </div>

                  <div>
                    <div className="relative">
                      <SearchGlyph
                        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--search-accent,var(--accent))]"
                        aria-hidden="true"
                      />
                      <input
                        ref={mobileInputRef}
                        type="search"
                        value={value}
                        onChange={(event) => onValueChange(event.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={
                          placeholder ??
                          (locale === 'es'
                            ? 'Título, mecánica o editorial'
                            : 'Title, mechanic, or publisher')
                        }
                        autoComplete="off"
                        enterKeyHint="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded="true"
                        aria-controls={listboxId}
                        className="h-[50px] w-full appearance-none rounded-xl border-[1.5px] border-[var(--search-accent,var(--accent))] bg-[var(--search-input,var(--bg-input))] py-3 pl-11 pr-11 text-[16px] leading-5 text-[var(--tx)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--search-accent,var(--accent))_14%,transparent)] outline-none placeholder:text-[var(--tx-faint)] [&::-webkit-search-cancel-button]:hidden"
                      />
                      {value && (
                        <button
                          type="button"
                          onClick={() => {
                            onValueChange('');
                            mobileInputRef.current?.focus();
                          }}
                          aria-label={locale === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--tx-muted)] active:bg-[var(--bg-hover)]"
                        >
                          <CloseGlyph />
                        </button>
                      )}
                    </div>
                  </div>
                </header>

                <div
                  id={listboxId}
                  role="listbox"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
                >
                  {!value.trim() && (
                    <div className="my-4 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                      <p className="font-mono text-[9.5px] uppercase tracking-[1.5px] text-[var(--search-accent,var(--accent))]">
                        {locale === 'es' ? 'Busca como juegas' : 'Search the way you play'}
                      </p>
                      <h2 className="mt-1 font-display text-[20px] font-bold tracking-[-.025em]">
                        {locale === 'es'
                          ? '¿Qué quieres llevar a la mesa?'
                          : 'What do you want to bring to the table?'}
                      </h2>
                      <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--tx-muted)]">
                        {locale === 'es'
                          ? 'Prueba un título, “2 jugadores”, “cooperativo” o tu editorial favorita.'
                          : 'Try a title, “2 players”, “cooperative”, or your favorite publisher.'}
                      </p>
                    </div>
                  )}
                  <CommandResults
                    recentItems={recentItems}
                    response={response}
                    value={value}
                    loading={loading}
                    items={items}
                    activeIndex={activeIndex}
                    locale={locale}
                    gamesLabel={gamesLabel}
                    facetsLabel={facetsLabel}
                    onChoose={choose}
                    mobile
                  />
                </div>

                <footer className="shrink-0 border-t border-[var(--border)] bg-[color:color-mix(in_srgb,var(--bg-raised)_94%,transparent)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={submitValue}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--search-accent,var(--accent))] px-4 text-[14px] font-bold text-[var(--brand-mark,#fff)] shadow-[0_6px_18px_color-mix(in_srgb,var(--search-accent,var(--accent))_24%,transparent)] active:scale-[.99]"
                  >
                    <SearchGlyph className="h-[17px] w-[17px]" aria-hidden="true" />
                    <span className="truncate">
                      {value.trim()
                        ? locale === 'es'
                          ? `Ver todos los resultados para “${value.trim()}”`
                          : `See all results for “${value.trim()}”`
                        : locale === 'es'
                          ? 'Explorar todo el catálogo'
                          : 'Explore the full catalog'}
                    </span>
                  </button>
                </footer>
              </section>
            )}
          </>,
          document.body,
        )}
    </div>
  );
}

function CloseSearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function CommandResults({
  recentItems,
  response,
  value,
  loading,
  items,
  activeIndex,
  locale,
  gamesLabel,
  facetsLabel,
  onChoose,
  mobile = false,
}: {
  recentItems: CommandItem[];
  response: SuggestionResponse;
  value: string;
  loading: boolean;
  items: CommandItem[];
  activeIndex: number;
  locale: 'es' | 'en';
  gamesLabel: string;
  facetsLabel: string;
  onChoose: (item: CommandItem) => void;
  mobile?: boolean;
}) {
  const facets = [...response.mechanics, ...response.publishers, ...response.categories];

  return (
    <>
      {recentItems.length > 0 && (
        <CommandHeading mobile={mobile}>
          {locale === 'es' ? 'Búsquedas recientes' : 'Recent searches'}
        </CommandHeading>
      )}
      {recentItems.map((item, index) => (
        <CommandRow
          key={`recent-${item.label}`}
          item={item}
          active={index === activeIndex}
          locale={locale}
          onChoose={() => onChoose(item)}
          mobile={mobile}
        />
      ))}

      {response.products.length > 0 && (
        <CommandHeading mobile={mobile}>
          {value.trim() ? gamesLabel : locale === 'es' ? 'Juegos en tendencia' : 'Trending games'}
        </CommandHeading>
      )}
      {response.products.map((item, index) => {
        const flatIndex = recentItems.length + index;
        return (
          <CommandRow
            key={item.slug}
            item={item}
            active={flatIndex === activeIndex}
            locale={locale}
            onChoose={() => onChoose(item)}
            mobile={mobile}
          />
        );
      })}

      {facets.length > 0 && <CommandHeading mobile={mobile}>{facetsLabel}</CommandHeading>}
      {facets.map((item, index) => {
        const flatIndex = recentItems.length + response.products.length + index;
        return (
          <CommandRow
            key={`${item.kind}-${item.value}`}
            item={item}
            active={flatIndex === activeIndex}
            locale={locale}
            onChoose={() => onChoose(item)}
            mobile={mobile}
          />
        );
      })}

      {loading && items.length === 0 && (
        <div
          className={cn(
            'flex items-center gap-[11px] text-[12.5px] text-[var(--tx-muted)]',
            mobile ? 'px-1 py-5' : 'px-3.5 py-3',
          )}
        >
          <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[var(--border-strong,var(--border))] border-t-[var(--search-accent,var(--accent))]" />
          {locale === 'es' ? 'Buscando los mejores juegos…' : 'Searching the best games…'}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          className={cn(
            'flex flex-col items-center text-center',
            mobile ? 'px-4 py-10' : 'px-4 py-6',
          )}
        >
          <span
            className={cn(
              'mb-2.5 grid place-items-center rounded-full bg-[var(--bg-subtle)] text-[var(--search-accent,var(--accent))]',
              mobile ? 'h-12 w-12' : 'h-[38px] w-[38px]',
            )}
          >
            <SearchGlyph className={mobile ? 'h-6 w-6' : 'h-[19px] w-[19px]'} aria-hidden="true" />
          </span>
          <span className="text-[14px] font-bold text-[var(--tx)]">
            {value.trim()
              ? locale === 'es'
                ? 'No encontramos coincidencias'
                : 'No matches found'
              : locale === 'es'
                ? 'Empieza a explorar'
                : 'Start exploring'}
          </span>
          <span className="mt-1 max-w-[18rem] text-[12.5px] leading-[1.5] text-[var(--tx-muted)]">
            {locale === 'es'
              ? 'Prueba con el título, la mecánica, el número de jugadores o la editorial.'
              : 'Try a title, mechanic, player count, or publisher.'}
          </span>
        </div>
      )}
    </>
  );
}

function CommandHeading({
  children,
  mobile = false,
}: {
  children: React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <p
      className={cn(
        'font-mono text-[10px] font-normal uppercase tracking-[1.5px] text-[var(--tx-faint)]',
        mobile
          ? 'border-b border-[var(--border)] px-1 pb-2 pt-5 first:pt-1'
          : 'border-t border-[var(--border)] px-3.5 pb-[7px] pt-[11px] first:border-t-0',
      )}
    >
      {children}
    </p>
  );
}

function CommandRow({
  item,
  active,
  locale,
  onChoose,
  mobile = false,
}: {
  item: CommandItem;
  active: boolean;
  locale: 'es' | 'en';
  onChoose: () => void;
  mobile?: boolean;
}) {
  if (item.kind === 'product') {
    const players = item.minPlayers
      ? `${item.minPlayers}${item.maxPlayers && item.maxPlayers !== item.minPlayers ? `–${item.maxPlayers}` : ''} jug.`
      : null;
    return (
      <button
        type="button"
        role="option"
        aria-selected={active}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onChoose}
        className={cn(
          'flex w-full items-center gap-[11px] text-left',
          mobile
            ? 'min-h-[72px] border-b border-[var(--border)] px-1 py-2.5 active:bg-[var(--bg-hover)]'
            : 'px-3.5 py-[9px]',
          !mobile && (active ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]'),
        )}
      >
        <span
          className={cn(
            'shrink-0 overflow-hidden bg-[var(--bg-subtle)]',
            mobile ? 'h-[52px] w-[41px] rounded-[7px]' : 'h-[38px] w-[30px] rounded-[5px]',
          )}
        >
          {item.image ? (
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="block h-full w-full"
              style={{
                background:
                  'repeating-linear-gradient(45deg, var(--jp-line-strong) 0 5px, var(--jp-line) 5px 10px)',
              }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <ProductSuggestionLabel label={item.label} />
          {mobile && (item.publisher || item.category) && (
            <span className="mb-0.5 block truncate text-[11.5px] text-[var(--tx-faint)]">
              {[item.publisher, item.category].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="block truncate font-mono text-[11px] text-[var(--tx-muted)]">
            {[
              players,
              item.playTimeMinutes ? `${item.playTimeMinutes} min` : null,
              item.bggRating ? `★ ${item.bggRating.toFixed(1)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {mobile ? (
          <span className="flex shrink-0 flex-col items-end gap-2">
            {item.inStock !== undefined && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[.4px]',
                  item.inStock
                    ? 'bg-[--jp-success-tint] text-[--jp-success-text]'
                    : 'bg-[var(--bg-subtle)] text-[var(--tx-faint)]',
                )}
              >
                {item.inStock
                  ? locale === 'es'
                    ? 'Stock'
                    : 'In stock'
                  : locale === 'es'
                    ? 'Agotado'
                    : 'Sold out'}
              </span>
            )}
            <ChevronRightGlyph />
          </span>
        ) : (
          active && (
            <span className="font-mono text-[11px] text-[var(--search-accent,var(--accent))]">
              ↵
            </span>
          )
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      className={cn(
        'flex w-full items-center gap-[11px] text-left',
        mobile
          ? 'min-h-[60px] border-b border-[var(--border)] px-1 py-2.5 active:bg-[var(--bg-hover)]'
          : 'px-3.5 py-[9px] last:pb-3',
        !mobile && (active ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]'),
      )}
    >
      <span
        className={cn(
          'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px]',
          item.kind === 'mechanic'
            ? 'bg-[#E3EAF1] text-[#3A5876] dark:bg-[#26384A] dark:text-[#8EB1D3]'
            : 'bg-[var(--bg-subtle)] text-[var(--tx-muted)]',
        )}
      >
        {item.kind === 'publisher' ? (
          <PublisherGlyph />
        ) : item.kind === 'recent' ? (
          <SearchGlyph className="h-[15px] w-[15px]" aria-hidden="true" />
        ) : item.kind === 'category' ? (
          <CategoryGlyph />
        ) : (
          <MechanicGlyph />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-[var(--tx)]">
          {item.label}
        </span>
        <span className="block font-mono text-[11px] text-[var(--tx-muted)]">
          {locale === 'es'
            ? item.kind === 'mechanic'
              ? 'Mecánica'
              : item.kind === 'publisher'
                ? 'Editorial'
                : item.kind === 'category'
                  ? 'Categoría'
                  : 'Reciente'
            : item.kind === 'mechanic'
              ? 'Mechanic'
              : item.kind === 'publisher'
                ? 'Publisher'
                : item.kind === 'category'
                  ? 'Category'
                  : 'Recent'}
        </span>
      </span>
      {mobile && <ChevronRightGlyph />}
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
    <svg
      className={className}
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ArrowLeftGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronRightGlyph() {
  return (
    <svg
      className="shrink-0 text-[var(--tx-faint)]"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MechanicGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PublisherGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function CategoryGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}
