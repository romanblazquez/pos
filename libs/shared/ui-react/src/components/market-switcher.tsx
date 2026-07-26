'use client';

// Hooks (open/close state, outside-click) make this a Client Component. The
// directive lives here rather than at each call site because the shared barrel
// is imported by Server Components too, and without it their build fails.
import { useEffect, useRef, useState } from 'react';

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
   * Where the menu opens. 'top' is required inside a bottom-anchored container
   * such as a mobile settings sheet, where a downward menu falls past the
   * viewport edge and cannot be reached at all.
   */
  placement?: 'bottom' | 'top';
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

/**
 * Canonical market picker shared by the apex and transactional app headers,
 * alongside LocaleSwitcher.
 *
 * Presentational only: the apex navigates to the target market's URL space
 * while the SPA reloads in place, so each host supplies its own `onSelect`. What
 * they must NOT do differently is look different — a shopper moving between
 * juegospedia.com and app.juegospedia.com is in one store.
 *
 * Always shows the currency next to the market. MXN, ARS and USD all render as
 * a bare "$" in a Spanish locale, so the flag and name alone leave a shopper
 * guessing which "$" a price is in — which is the whole question this control
 * answers.
 */
export function MarketSwitcher({
  markets,
  active,
  onSelect,
  ariaLabel = 'Market',
  className,
  placement = 'bottom',
}: MarketSwitcherProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A menu that survives a click elsewhere reads as stuck. Escape closes it too,
  // since it is opened by keyboard as often as by pointer.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (markets.length < 2) return null;
  const current = markets.find((market) => market.code === active.toUpperCase());

  return (
    <div ref={root} className={className ?? 'relative shrink-0'}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        // The visible label is a bare currency code, so the accessible name has
        // to carry what the control actually does.
        aria-label={`${ariaLabel} (${current?.name ?? active})`}
        title={current?.name ?? active}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] border border-(--border)
                   bg-(--bg-raised) px-3 text-sm font-semibold text-(--tx) transition-colors
                   hover:border-(--primary) hover:text-(--primary) sm:h-[34px] sm:px-2.5"
      >
        {/* Currency only. A flag denotes a country, not a market or a money —
            and what the shopper is actually choosing here is which currency the
            prices are quoted in. The market name stays in the open menu, where
            there is room to say it properly. */}
        <span className="font-mono text-[13px] font-bold tracking-wide">
          {current?.currency ?? active.toUpperCase()}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute right-0 z-50 flex w-[min(16rem,calc(100vw-2rem))] list-none flex-col gap-0.5
                      rounded-[12px] border border-(--border) bg-(--bg-raised) p-1.5 shadow-lg sm:w-[13rem] ${
                        placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                      }`}
        >
          {markets.map((market) => {
            const isActive = market.code === active.toUpperCase();
            return (
              <li key={market.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) onSelect(market.code);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[9px] px-2.5 py-2
                              text-left text-sm transition-colors sm:min-h-0 ${
                    isActive
                      ? 'bg-(--bg-hover) font-semibold text-(--tx)'
                      : 'font-medium text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)'
                  }`}
                >
                  <span className="truncate">{market.name}</span>
                  <span className="font-mono text-[11px] font-bold text-(--tx-muted)">{market.currency}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
