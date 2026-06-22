import * as React from 'react';
import { Label, Input } from '@retail-os/ui-react';

// Label bound to a field — the building block of every POS form.
export const FieldLabel = () => (
  <div className="grid w-72 max-w-full gap-2">
    <Label htmlFor="discount">Discount code</Label>
    <Input id="discount" placeholder="e.g. SUMMER15" />
  </div>
);

// A compact two-column settings row, label on the left.
export const InlineSetting = () => (
  <div className="flex w-80 max-w-full items-center justify-between gap-4">
    <Label htmlFor="restock">Auto-restock alerts</Label>
    <Input id="restock" type="number" defaultValue={5} className="w-20 text-right tabular-nums" />
  </div>
);
