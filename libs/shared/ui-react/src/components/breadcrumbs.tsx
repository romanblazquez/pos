import type { ElementType, MouseEvent } from 'react';
import { MeepleMark } from './meeple-mark.js';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  ariaLabel?: string;
  className?: string;
  linkComponent?: ElementType;
}

/** Canonical Juegospedia breadcrumb trail used by the apex and transactional app. */
export function Breadcrumbs({
  items,
  ariaLabel = 'Breadcrumb',
  className,
  linkComponent: LinkComponent = 'a',
}: BreadcrumbsProps) {
  const parent = items.length > 1 ? items[items.length - 2] : null;

  function handleClick(event: MouseEvent<HTMLAnchorElement>, item: BreadcrumbItem) {
    if (!item.onClick) return;
    event.preventDefault();
    item.onClick();
  }

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="m-0 flex min-w-0 list-none items-center p-0 sm:hidden">
        <li className="min-w-0">
          {parent?.href ? (
            <LinkComponent
              href={parent.href}
              {...(parent.onClick
                ? { onClick: (event: MouseEvent<HTMLAnchorElement>) => handleClick(event, parent) }
                : {})}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-[11px] border border-[var(--border)] bg-[var(--bg-raised)] px-3 text-sm font-semibold text-[var(--tx-muted)] transition-colors active:bg-[var(--bg-hover)]"
            >
              <ChevronLeftGlyph />
              <span className="truncate">{parent.label}</span>
            </LinkComponent>
          ) : (
            <span
              className="block max-w-[calc(100vw-3rem)] truncate text-sm font-bold text-[var(--tx)]"
              aria-current="page"
            >
              {items.at(-1)?.label}
            </span>
          )}
        </li>
      </ol>

      <ol className="m-0 hidden flex-wrap items-center gap-2 rounded-[11px] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-2.5 text-[13.5px] text-[var(--tx-muted)] sm:flex">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const home = index === 0;
          return (
            <li
              key={`${item.href ?? item.label}-${index}`}
              className="flex min-w-0 items-center gap-2"
            >
              {index > 0 && <HexSeparator />}
              {current || !item.href ? (
                <span
                  aria-current={current ? 'page' : undefined}
                  title={current ? item.label : undefined}
                  className={
                    current ? 'max-w-[22rem] truncate font-bold text-[var(--tx)]' : undefined
                  }
                >
                  {home ? <MeepleMark className="h-4 w-4" /> : item.label}
                </span>
              ) : (
                <LinkComponent
                  href={item.href}
                  {...(item.onClick
                    ? {
                        onClick: (event: MouseEvent<HTMLAnchorElement>) => handleClick(event, item),
                      }
                    : {})}
                  aria-label={home ? item.label : undefined}
                  title={home ? item.label : undefined}
                  style={
                    home
                      ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                      : undefined
                  }
                  className={
                    home
                      ? 'grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-[var(--primary)] text-[var(--primary-foreground)] transition-transform hover:scale-105'
                      : 'whitespace-nowrap rounded-md px-0.5 py-1 transition-colors hover:text-[var(--primary)]'
                  }
                >
                  {home ? <MeepleMark className="h-[15px] w-[15px]" /> : item.label}
                </LinkComponent>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ChevronLeftGlyph() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-[var(--primary)]"
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

function HexSeparator() {
  return (
    <svg className="h-[9px] w-[9px] shrink-0" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="var(--border-strong)" />
    </svg>
  );
}
