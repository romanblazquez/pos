import * as React from 'react';
import { Badge } from '@retail-os/ui-react';

// Stock + order status pills — the everyday retail vocabulary.
export const Statuses = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="success">In stock</Badge>
    <Badge variant="warning">Low stock</Badge>
    <Badge variant="destructive">Sold out</Badge>
    <Badge variant="secondary">Backorder</Badge>
    <Badge variant="outline">Pre-order</Badge>
  </div>
);

// Order lifecycle states as the customer moves through fulfillment.
export const OrderFlow = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Paid</Badge>
    <Badge variant="secondary">Packing</Badge>
    <Badge variant="warning">Shipped</Badge>
    <Badge variant="success">Delivered</Badge>
    <Badge variant="danger">Refunded</Badge>
  </div>
);

// Promotions and counts inline with content.
export const Tags = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="destructive">-15%</Badge>
    <Badge variant="muted">New</Badge>
    <Badge variant="success">Free shipping</Badge>
    <Badge variant="outline">SKU 8841-A</Badge>
  </div>
);
