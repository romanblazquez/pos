import * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from '@retail-os/ui-react';

const lines = [
  { sku: '8841-A', name: 'Catan — 5th Edition', qty: 1, price: '$899.00', status: 'In stock' },
  { sku: '2290-B', name: 'Ticket to Ride', qty: 2, price: '$1,180.00', status: 'Low stock' },
  { sku: '5512-C', name: 'Carcassonne', qty: 1, price: '$540.00', status: 'In stock' },
];

// Order line-items — money right-aligned & tabular, status as a badge, total in footer.
export const OrderLines = () => (
  <div className="w-full max-w-2xl">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="hidden sm:table-cell">SKU</TableHead>
          <TableHead className="text-center">Qty</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.sku}>
            <TableCell className="font-medium">{l.name}</TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{l.sku}</TableCell>
            <TableCell className="text-center tabular-nums">{l.qty}</TableCell>
            <TableCell>
              <Badge variant={l.status === 'Low stock' ? 'warning' : 'success'}>{l.status}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{l.price}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Total</TableCell>
          <TableCell className="text-right tabular-nums">$2,619.00</TableCell>
        </TableRow>
      </TableFooter>
      <TableCaption>Order #10428 · 3 items</TableCaption>
    </Table>
  </div>
);
