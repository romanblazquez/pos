import Link from 'next/link';
import type { Crumb } from '@/lib/jsonld';
import { MeepleMark } from './MeepleMark';

// Visible breadcrumbs as real crawlable <a> anchors (spec §10). The same crumb
// array feeds breadcrumbLd() so structured data matches what users see.
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol className="crumb-mobile">
        <li>
          {parent ? (
            <Link href={parent.path} className="crumb-back">
              <ChevronLeft />
              <span>{parent.name}</span>
            </Link>
          ) : (
            <span className="crumb-current" aria-current="page">
              {crumbs.at(-1)?.name}
            </span>
          )}
        </li>
      </ol>

      <ol className="crumb-trail">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          const home = index === 0;
          return (
            <li key={crumb.path}>
              {index > 0 && <HexSeparator />}
              {current ? (
                <span className="crumb-current" aria-current="page" title={crumb.name}>
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className={home ? 'crumb-home' : 'crumb-link'}
                  aria-label={home ? crumb.name : undefined}
                  title={home ? crumb.name : undefined}
                >
                  {home ? <MeepleMark size={15} /> : crumb.name}
                </Link>
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
    <svg className="crumb-hex" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
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
