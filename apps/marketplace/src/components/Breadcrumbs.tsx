import { Breadcrumbs as DesignSystemBreadcrumbs, type BreadcrumbItem } from '@retail-os/ui-react';

export type { BreadcrumbItem };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <DesignSystemBreadcrumbs items={items} ariaLabel="Migas de pan" className="mb-5" />;
}
