import * as React from 'react';
import { Skeleton } from '@retail-os/ui-react';

// Loading placeholder for a product card while the catalog fetches.
export const ProductCardLoading = () => (
  <div className="w-72 max-w-full overflow-hidden rounded-xl border bg-card">
    <Skeleton className="aspect-[4/3] w-full rounded-none" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  </div>
);

// A responsive loading grid for the catalog screen.
export const CatalogLoading = () => (
  <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    ))}
  </div>
);
