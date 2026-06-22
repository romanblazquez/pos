import * as React from 'react';
import { Button } from '@retail-os/ui-react';

// Primary call-to-action a cashier taps to take payment.
export const Charge = () => (
  <Button size="lg" className="w-full sm:w-auto">Charge $124.50</Button>
);

// The full variant set, wrapping responsively so it never overflows a panel.
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Add to cart</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="outline">Scan item</Button>
    <Button variant="ghost">Clear</Button>
    <Button variant="destructive">Refund</Button>
    <Button variant="link">View receipt</Button>
  </div>
);

// Size scale, from dense table-row actions up to the primary pay button.
export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-3">
    <Button size="sm">Apply</Button>
    <Button size="default">Continue</Button>
    <Button size="lg">Complete sale</Button>
  </div>
);

// Async + disabled states for an in-flight payment.
export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button loading>Processing payment</Button>
    <Button disabled>Out of stock</Button>
  </div>
);

// A real checkout action bar: secondary action collapses under primary on mobile.
export const CheckoutBar = () => (
  <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
    <Button variant="outline" className="sm:w-auto">Hold order</Button>
    <Button className="sm:w-auto">Pay $124.50</Button>
  </div>
);
