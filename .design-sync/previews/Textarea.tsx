import * as React from 'react';
import { Textarea, Label } from '@retail-os/ui-react';

// Order note — free text the cashier attaches to a sale.
export const OrderNote = () => (
  <div className="grid w-80 max-w-full gap-2">
    <Label htmlFor="note">Order note</Label>
    <Textarea id="note" placeholder="Gift wrap, leave at front desk, call on arrival…" />
  </div>
);

// Pre-filled product description with content.
export const ProductDescription = () => (
  <Textarea
    className="w-96 max-w-full"
    defaultValue="Award-winning strategy board game for 3–4 players. Includes base set, expansion-ready board, and resource cards."
  />
);
