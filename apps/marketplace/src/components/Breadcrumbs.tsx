import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="mb-5 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-sm text-[--tx-muted]">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[--tx-faint]" aria-hidden="true" />}
              {current || !item.href ? (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'max-w-[16rem] truncate font-medium text-[--tx]' : undefined}
                >
                  {index === 0 && <Home className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  onClick={(event) => {
                    if (!item.onClick) return;
                    event.preventDefault();
                    item.onClick();
                  }}
                  className="rounded px-1 py-0.5 transition-colors hover:bg-[--bg-hover] hover:text-emerald-700"
                >
                  {index === 0 && <Home className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
