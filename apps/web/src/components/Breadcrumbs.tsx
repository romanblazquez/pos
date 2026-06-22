import Link from 'next/link';
import type { Crumb } from '@/lib/jsonld';

// Visible breadcrumbs as real crawlable <a> anchors (spec §10). The same crumb
// array feeds breadcrumbLd() so structured data matches what users see.
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="crumbs container" aria-label="Breadcrumb" style={{ paddingBottom: 0 }}>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.path}>
            {last ? (
              <span aria-current="page">{c.name}</span>
            ) : (
              <Link href={c.path}>{c.name}</Link>
            )}
            {!last && ' › '}
          </span>
        );
      })}
    </nav>
  );
}
