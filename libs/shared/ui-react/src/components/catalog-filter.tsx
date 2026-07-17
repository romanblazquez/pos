import * as React from 'react';
import { cn } from '../lib/utils.js';

export interface CatalogFilterPanelProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  sticky?: boolean;
}

export function CatalogFilterPanel({
  title,
  subtitle,
  icon,
  action,
  sticky = true,
  className,
  children,
  ...props
}: CatalogFilterPanelProps) {
  return (
    <aside
      className={cn(
        'catalog-filter-panel rounded-[14px] border border-(--border) bg-(--bg-raised) p-3 shadow-sm',
        sticky && 'sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto',
        className,
      )}
      {...props}
    >
      <div className="catalog-filter-header flex items-start justify-between gap-3 border-b border-(--border) px-2 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* --accent is a light parchment *surface* (#f1e8d6), not an accent
              colour — on --accent-bg it renders invisible. The icon takes the
              brand clay, matching .mobile-nav-link-icon in globals.css. */}
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--accent-bg) text-(--primary)">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-(--tx)">{title}</p>
            {subtitle ? <p className="text-[11px] text-(--tx-muted)">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </aside>
  );
}

export function CatalogFilterSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('catalog-filter-section border-b border-(--border) px-1 py-4 last:border-b-0 last:pb-1', className)}>
      <h3 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-(--tx-faint)">
        {title}
      </h3>
      {children}
    </section>
  );
}

// A single filter chip, shared by both frontends (§04).
//
// It exists because the chip was hand-copied at four call sites in the SEO app
// and four more in the SPA, and one copy silently lost `data-filter="chip"` —
// which killed live selection feedback for the Players filter on mobile with no
// other symptom. The attribute is emitted here so a call site cannot forget it.
//
// Two modes, because the frontends genuinely differ and neither should bend:
//   form — a <label> wrapping a visually-hidden native input. The SEO app's
//          filter panel is one no-JS GET <form>, so chips must submit unhydrated.
//   button — a plain button driving React state, for the SPA.
// The `active` prop paints both, but note it is only trustworthy where the
// component re-renders on change. In the SEO app's mobile modal FormAutoSubmit
// deliberately batches (it bails below 861px), so server-computed `active` goes
// stale on tap and the [data-filter="chip"]:has(input:checked) rules in the web
// app's globals.css are what actually paint it. That is why the attribute is
// load-bearing rather than decorative.
type FilterChipShape = 'pill' | 'compact';

interface FilterChipBaseProps {
  active: boolean;
  /** pill: wraps text (mechanics, budget, complexity). compact: fixed-height, for short labels (players). */
  shape?: FilterChipShape;
  children: React.ReactNode;
  className?: string;
}

interface FilterChipFormProps extends FilterChipBaseProps {
  /** Submitted field name. Presence of `name` selects form mode. */
  name: string;
  value: string;
  inputType: 'radio' | 'checkbox';
  onClick?: never;
}

interface FilterChipButtonProps extends FilterChipBaseProps {
  onClick: () => void;
  name?: never;
  value?: never;
  inputType?: never;
}

export type FilterChipProps = FilterChipFormProps | FilterChipButtonProps;

const CHIP_SHAPE: Record<FilterChipShape, string> = {
  pill: 'rounded-full px-3.5 py-1.5 text-center text-[13px]',
  compact: 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs',
};

function filterChipClass(active: boolean, shape: FilterChipShape, className?: string) {
  return cn(
    'mobile-filter-choice border font-semibold transition-colors',
    CHIP_SHAPE[shape],
    active
      ? 'border-(--primary) bg-(--primary) text-(--primary-foreground)'
      : 'border-(--border) bg-(--bg-subtle) text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)',
    className,
  );
}

export function FilterChip(props: FilterChipProps) {
  const { active, shape = 'pill', children, className } = props;

  if (props.name !== undefined) {
    return (
      <label data-filter="chip" className={cn('cursor-pointer', filterChipClass(active, shape, className))}>
        <input
          type={props.inputType}
          name={props.name}
          value={props.value}
          defaultChecked={active}
          className="sr-only"
        />
        {children}
      </label>
    );
  }

  return (
    <button type="button" data-filter="chip" onClick={props.onClick} className={filterChipClass(active, shape, className)}>
      {children}
    </button>
  );
}

export function FilterToggle({
  checked,
  label,
  description,
  onClick,
}: {
  checked: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors',
        checked
          ? 'border-(--primary) bg-(--accent-bg)'
          : 'border-(--border) bg-(--bg-subtle) hover:bg-(--bg-hover)',
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-(--tx)">{label}</span>
        <span className="mt-0.5 block text-xs text-(--tx-muted)">{description}</span>
      </span>
      <span className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
        checked
          ? 'border-(--primary) bg-(--primary) text-(--primary-foreground)'
          : 'border-(--border-strong)',
      )}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        )}
      </span>
    </button>
  );
}

export function FilterCategoryButton({
  active,
  label,
  description,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors',
        active
          ? 'border border-(--primary) bg-(--accent-bg) text-(--tx)'
          : 'border border-(--border) bg-(--bg-subtle) text-(--tx-muted) hover:bg-(--bg-hover) hover:text-(--tx)',
      )}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        {count !== undefined && (
          <span className="rounded-full border border-current/15 px-1.5 py-0.5 text-[10px] font-medium opacity-70">{count}</span>
        )}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-(--tx-muted)">{description}</span>
    </button>
  );
}
