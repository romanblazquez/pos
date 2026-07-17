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
