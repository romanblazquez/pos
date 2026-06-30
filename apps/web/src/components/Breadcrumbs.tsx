import Link from 'next/link';
import { Breadcrumbs as DesignSystemBreadcrumbs, type BreadcrumbItem } from '@retail-os/ui-react';
import type { Crumb } from '@/lib/jsonld';

// The shared design-system component owns structure and styling. This adapter
// only maps the SEO crumb shape and preserves Next.js client navigation.
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const items: BreadcrumbItem[] = crumbs.map((crumb) => ({
    label: crumb.name,
    href: crumb.path,
  }));

  return (
    <DesignSystemBreadcrumbs
      items={items}
      ariaLabel="Breadcrumb"
      className="crumbs"
      linkComponent={Link}
    />
  );
}
