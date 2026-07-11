import Link from 'next/link';
import type { Locale } from '@/lib/segments';

// Crawlable numeric pager shared by the catalogue listing and per-category pages.
// Emits real <a> links (rel prev/next) so paginated depth is navigable; page 2+
// is kept out of the index by each page's own metadata (spec §9), with product
// discovery handled by the sitemap.
export function Pager({
  base,
  page,
  total,
  locale,
  pageSize,
  query = '',
}: {
  base: string;
  page: number;
  total: number;
  locale: Locale;
  pageSize: number;
  query?: string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const parts = [query, p > 1 ? `page=${p}` : ''].filter(Boolean);
    return parts.length ? `${base}?${parts.join('&')}` : base;
  };
  // Window of page numbers around the current page.
  const nums = new Set<number>([1, pages, page, page - 1, page + 1]);
  const list = [...nums].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label={locale === 'es' ? 'Paginación' : 'Pagination'}>
      {page > 1 && <Link href={href(page - 1)} rel="prev">‹</Link>}
      {list.map((p, i) => {
        const gap = i > 0 && p - list[i - 1] > 1;
        return (
          <span key={p} style={{ display: 'contents' }}>
            {gap && <span className="gap">…</span>}
            {p === page ? (
              <span className="current" aria-current="page">{p}</span>
            ) : (
              <Link href={href(p)}>{p}</Link>
            )}
          </span>
        );
      })}
      {page < pages && <Link href={href(page + 1)} rel="next">›</Link>}
    </nav>
  );
}
