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
        'catalog-filter-panel rounded-[14px] border border-[--border] bg-[--bg-raised] p-3 shadow-sm',
        sticky && 'sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto',
        className,
      )}
      {...props}
    >
      <div className="catalog-filter-header flex items-start justify-between gap-3 border-b border-[--border] px-2 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[--accent-bg] text-[--accent]">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-[--tx]">{title}</p>
            {subtitle ? <p className="text-[11px] text-[--tx-muted]">{subtitle}</p> : null}
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
    <section className={cn('catalog-filter-section border-b border-[--border] px-1 py-4 last:border-b-0 last:pb-1', className)}>
      <h3 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[--tx-faint]">
        {title}
      </h3>
      {children}
    </section>
  );
}
