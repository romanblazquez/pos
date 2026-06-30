import type { MouseEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { BrandMark } from './BrandMark.js';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const parent = items.length > 1 ? items[items.length - 2] : null;

  function handleClick(event: MouseEvent<HTMLAnchorElement>, item: BreadcrumbItem) {
    if (!item.onClick) return;
    event.preventDefault();
    item.onClick();
  }

  return (
    <nav aria-label="Migas de pan" className="mb-5">
      <ol className="flex min-w-0 items-center sm:hidden">
        <li className="min-w-0">
          {parent?.href ? (
            <a
              href={parent.href}
              onClick={(event) => handleClick(event, parent)}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-[--border] bg-[--bg-raised] px-3 text-sm font-semibold text-[--tx-muted] transition-colors active:bg-[--bg-hover]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <span className="truncate">{parent.label}</span>
            </a>
          ) : (
            <span className="text-sm font-semibold text-[--tx]" aria-current="page">
              {items.at(-1)?.label}
            </span>
          )}
        </li>
      </ol>

      <ol className="hidden flex-wrap items-center gap-2 rounded-[11px] border border-[--border] bg-[--bg-raised] px-3.5 py-2.5 text-[13.5px] text-[--tx-muted] sm:flex">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const home = index === 0;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && <HexSeparator />}
              {current || !item.href ? (
                <span
                  aria-current={current ? 'page' : undefined}
                  title={current ? item.label : undefined}
                  className={current ? 'max-w-[18rem] truncate font-bold text-[--tx]' : undefined}
                >
                  {home ? <BrandMark className="h-4 w-4" /> : item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  onClick={(event) => handleClick(event, item)}
                  aria-label={home ? item.label : undefined}
                  title={home ? item.label : undefined}
                  className={
                    home
                      ? 'grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] text-[var(--brand-mark)] transition-transform hover:scale-105'
                      : 'whitespace-nowrap rounded-md px-0.5 py-1 transition-colors hover:text-[var(--accent)]'
                  }
                >
                  {home ? <BrandMark className="h-[15px] w-[15px]" /> : item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function HexSeparator() {
  return (
    <svg className="h-[9px] w-[9px] shrink-0" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="var(--border-strong)" />
    </svg>
  );
}
