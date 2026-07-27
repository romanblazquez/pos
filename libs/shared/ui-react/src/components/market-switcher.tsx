'use client';

// Hooks (open/close state, outside-click) make this a Client Component. The
// directive lives here rather than at each call site because the shared barrel
// is imported by Server Components too, and without it their build fails.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface MarketOption {
  /** Uppercase market code, conventionally the ISO country code. */
  code: string;
  /** Market name in the market's own language, e.g. "México". */
  name: string;
  /** ISO 4217 code of the currency this market trades in. */
  currency: string;
}

export interface MarketSwitcherProps {
  markets: readonly MarketOption[];
  /** Uppercase code of the market currently in effect. */
  active: string;
  onSelect: (code: string) => void;
  ariaLabel?: string;
  className?: string;
  /**
   * Where the *desktop* menu opens. 'top' is required inside a bottom-anchored
   * container such as a settings row near the foot of a drawer, where a
   * downward menu falls past the viewport edge.
   *
   * Ignored on phones, which get a bottom sheet anchored to the viewport
   * instead of a menu anchored to the button.
   */
  placement?: 'bottom' | 'top';
  /** Heading shown above the options on the mobile sheet. Defaults to `ariaLabel`. */
  sheetTitle?: string;
}

/**
 * Turn a country code into its flag emoji.
 *
 * Derived rather than configured: a flag is a pure function of the country
 * code, so a hardcoded table is one more place to forget when a market launches
 * — and a table that disagrees with the code shows the wrong country's flag.
 */
export function countryFlag(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  // Regional indicator symbols sit 0x1F1E6 above 'A'.
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Phones get the sheet; everything else keeps the anchored menu. Matches Tailwind's `sm`. */
const COMPACT_QUERY = '(max-width: 639px)';

/**
 * True on a phone-width viewport.
 *
 * Starts false so the server and the first client render agree — a `matchMedia`
 * read during render would differ between them and trip hydration. The menu
 * cannot be open before a click, and the click cannot precede this effect, so
 * the correction always lands before either layout is shown.
 */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return compact;
}

/**
 * Hold the page still behind an open sheet.
 *
 * A full-width overlay over a scrollable page means a drag on the scrim scrolls
 * the page underneath, which on iOS also drags the sheet out of alignment with
 * the viewport. The scroll position is restored on close so dismissing the sheet
 * does not jump the shopper back to the top of a long catalogue.
 */
function useScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return undefined;
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function ChevronIcon() {
  // Inlined rather than imported from lucide-react, matching the rest of this
  // lib: it is consumed by two apps whose bundlers treat that dependency
  // differently, and one glyph is not worth the coupling.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 opacity-60"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Canonical market picker shared by the apex and transactional app headers,
 * alongside LocaleSwitcher.
 *
 * Presentational only: the apex navigates to the target market's URL space
 * while the SPA reloads in place, so each host supplies its own `onSelect`. What
 * they must NOT do differently is look different — a shopper moving between
 * juegospedia.com and app.juegospedia.com is in one store.
 *
 * Always shows the currency on the trigger. MXN, ARS and USD all render as a
 * bare "$" in a Spanish locale, so a flag and a country name leave a shopper
 * guessing which "$" a price is in — which is the whole question this control
 * answers. The flag earns its place inside the list, where the name is next to
 * it and it speeds up scanning rather than standing in for the answer.
 *
 * **On phones this opens a bottom sheet, not a dropdown.** Both headers hide
 * their controls below `sm`, so the only way to this control on a phone is
 * inside the nav drawer — where a `position: absolute` menu was opening as a
 * popup nested inside another popup, clipped by the drawer, anchored to a
 * button in the far corner of the screen. A sheet is anchored to the viewport
 * instead: it cannot be clipped by whatever contains the trigger, its rows are
 * full-width thumb targets, and it opens at the bottom of the screen where the
 * thumb already is.
 */
export function MarketSwitcher({
  markets,
  active,
  onSelect,
  ariaLabel = 'Market',
  className,
  placement = 'bottom',
  sheetTitle,
}: MarketSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const compact = useCompactViewport();
  const asSheet = compact && open;

  useScrollLock(asSheet);

  const activeCode = active.toUpperCase();
  const activeIndex = Math.max(0, markets.findIndex((market) => market.code === activeCode));

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setEntered(false);
    // Returning focus to the trigger is what makes Escape and a completed
    // selection feel like the same control rather than a dead end. Skipped when
    // the pointer dismissed it, where moving focus would be unexpected.
    if (restoreFocus) trigger.current?.focus();
  }, []);

  // Slide the sheet in from its off-screen position on the frame after mount.
  // Transition, not a keyframe: this lib ships no stylesheet of its own to
  // either app, so animation has to live in utilities that both already build.
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Move focus onto the current market so a keyboard or screen-reader user
  // starts where they already are, rather than at the top of the list.
  useEffect(() => {
    if (!open) return;
    options.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // A menu that survives a click elsewhere reads as stuck. Escape closes it too,
  // since it is opened by keyboard as often as by pointer.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      // The sheet is portalled out of `root`, so an outside-click test against
      // the trigger's subtree would close it on every tap inside the sheet.
      if (compact) return;
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    // Capture, so Escape dismisses this before the drawer that may contain it —
    // otherwise one press closes both and the shopper loses their place.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, compact, close]);

  if (markets.length < 2) return null;
  const current = markets.find((market) => market.code === activeCode);

  /** Roving focus across the options, so the list behaves like a real listbox. */
  function onListKeyDown(event: ReactKeyboardEvent, index: number) {
    const last = markets.length - 1;
    const move = (to: number) => {
      event.preventDefault();
      options.current[Math.max(0, Math.min(last, to))]?.focus();
    };
    if (event.key === 'ArrowDown') move(index === last ? 0 : index + 1);
    else if (event.key === 'ArrowUp') move(index === 0 ? last : index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(last);
  }

  function choose(code: string) {
    close();
    if (code !== activeCode) onSelect(code);
  }

  const optionRows = markets.map((market, index) => {
    const isActive = market.code === activeCode;
    const flag = countryFlag(market.code);
    return (
      <li key={market.code}>
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          ref={(node) => { options.current[index] = node; }}
          onKeyDown={(event) => onListKeyDown(event, index)}
          onClick={() => choose(market.code)}
          className={`flex w-full items-center gap-3 rounded-[10px] text-left transition-colors
                      ${asSheet ? 'min-h-14 px-3 py-3 text-base' : 'min-h-11 px-2.5 py-2 text-sm sm:min-h-0'}
                      ${isActive
                        ? 'bg-(--bg-hover) font-semibold text-(--tx)'
                        : 'font-medium text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)'}`}
        >
          {flag && (
            <span aria-hidden="true" className={asSheet ? 'text-2xl leading-none' : 'text-base leading-none'}>
              {flag}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{market.name}</span>
          <span className={`font-mono font-bold tabular-nums ${asSheet ? 'text-sm text-(--tx-muted)' : 'text-[11px] text-(--tx-muted)'}`}>
            {market.currency}
          </span>
          {/* Reserved whether or not it is filled, so the currency codes stay on
              one vertical line instead of shifting as the selection moves. */}
          <span className={`flex shrink-0 justify-center text-(--primary) ${asSheet ? 'w-5' : 'w-0'}`}>
            {isActive && asSheet ? <CheckIcon /> : null}
          </span>
        </button>
      </li>
    );
  });

  return (
    <div ref={root} className={className ?? 'relative shrink-0'}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // The visible label is a bare currency code, so the accessible name has
        // to carry what the control actually does.
        aria-label={`${ariaLabel} (${current?.name ?? active})`}
        title={current?.name ?? active}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] border border-(--border)
                   bg-(--bg-raised) px-3 text-sm font-semibold text-(--tx) transition-colors
                   hover:border-(--primary) hover:text-(--primary) sm:h-[34px] sm:px-2.5"
      >
        <span className="font-mono text-[13px] font-bold tracking-wide">
          {current?.currency ?? activeCode}
        </span>
        {/* The trigger was a bare three-letter code with no affordance — it read
            as a label rather than a control, which is the wrong reading for the
            thing that decides what currency every price is in. */}
        <ChevronIcon />
      </button>

      {open && !compact && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute right-0 z-50 flex w-[min(16rem,calc(100vw-2rem))] list-none flex-col gap-0.5
                      rounded-[12px] border border-(--border) bg-(--bg-raised) p-1.5 shadow-lg sm:w-[13rem] ${
                        placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                      }`}
        >
          {optionRows}
        </ul>
      )}

      {asSheet && typeof document !== 'undefined' && createPortal(
        // Portalled to the body so the sheet is measured against the viewport,
        // not against the drawer or header that happens to contain the trigger.
        <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:hidden">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => close(false)}
            className={`absolute inset-0 h-full w-full cursor-default bg-black/45 transition-opacity duration-200
                        motion-reduce:transition-none ${entered ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle ?? ariaLabel}
            className={`relative w-full rounded-t-2xl border-t border-(--border) bg-(--bg-raised)
                        pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,.28)]
                        transition-transform duration-200 ease-out motion-reduce:transition-none
                        ${entered ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-(--border)" />
            </div>
            <p className="px-4 pb-1 pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-(--tx-faint)">
              {sheetTitle ?? ariaLabel}
            </p>
            <ul id={listId} role="listbox" aria-label={ariaLabel} className="flex list-none flex-col gap-0.5 px-2 pb-2 pt-1">
              {optionRows}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
