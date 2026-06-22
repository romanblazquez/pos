import * as React from 'react';
import { Separator } from '@retail-os/ui-react';

// Horizontal rule splitting a receipt total from its line items.
export const ReceiptDivider = () => (
  <div className="w-72 max-w-full text-sm">
    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">$108.00</span></div>
    <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">$17.28</span></div>
    <Separator className="my-3" />
    <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">$125.28</span></div>
  </div>
);

// Vertical separators between summary metrics in a toolbar.
export const MetricBar = () => (
  <div className="flex h-10 items-center gap-4 text-sm">
    <span><span className="font-semibold tabular-nums">312</span> <span className="text-muted-foreground">orders</span></span>
    <Separator orientation="vertical" />
    <span><span className="font-semibold tabular-nums">$48k</span> <span className="text-muted-foreground">sales</span></span>
    <Separator orientation="vertical" />
    <span><span className="font-semibold tabular-nums">98%</span> <span className="text-muted-foreground">in stock</span></span>
  </div>
);
