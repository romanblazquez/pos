import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from '@retail-os/ui-react';

// Row-action menu for an order — rendered open so the menu shows in the card.
export const OrderActions = () => (
  <div className="flex justify-center py-6">
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Order #10428</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          View receipt <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Print invoice</DropdownMenuItem>
        <DropdownMenuItem>Duplicate order</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Refund order</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
