import * as React from 'react';
import { Input } from '@retail-os/ui-react';

// Bare input — product search at the top of the catalog.
export const Search = () => (
  <Input type="search" placeholder="Search products, SKUs, customers…" className="w-80 max-w-full" />
);

// Labeled field with helper text (canonical form usage).
export const WithLabel = () => (
  <div className="w-72 max-w-full">
    <Input label="Retail price (MXN)" type="number" placeholder="0.00" hint="Tax is added at checkout." />
  </div>
);

// Validation state for an invalid SKU.
export const WithError = () => (
  <div className="w-72 max-w-full">
    <Input label="SKU" defaultValue="88" error="SKU must be at least 6 characters." />
  </div>
);

// Disabled field on a locked record.
export const Disabled = () => (
  <div className="w-72 max-w-full">
    <Input label="Barcode" defaultValue="7501031311309" disabled />
  </div>
);
