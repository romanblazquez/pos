export interface LocaleSwitcherProps {
  locales: readonly string[];
  active: string;
  onSelect: (locale: string) => void;
  ariaLabel?: string;
  className?: string;
}

/** Canonical ES/EN pill toggle shared by the apex and transactional app headers. */
export function LocaleSwitcher({ locales, active, onSelect, ariaLabel = 'Language', className }: LocaleSwitcherProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        className
          ?? 'flex shrink-0 items-center gap-0.5 rounded-[10px] border border-(--border) bg-(--bg-raised) p-0.5'
      }
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => onSelect(locale)}
            aria-current={isActive ? 'true' : undefined}
            className={
              isActive
                ? 'grid h-[30px] min-w-[30px] place-items-center rounded-[8px] bg-(--primary) px-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-(--primary-foreground)'
                : 'grid h-[30px] min-w-[30px] place-items-center rounded-[8px] px-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-(--tx-muted) transition-colors hover:text-(--primary)'
            }
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
