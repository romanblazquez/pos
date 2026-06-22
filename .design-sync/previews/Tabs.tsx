import * as React from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
} from '@retail-os/ui-react';

// Product-detail tabs — the standard shadcn Tabs in a retail context.
export const ProductTabs = () => (
  <Tabs defaultValue="overview" className="w-96 max-w-full">
    <TabsList className="w-full">
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="inventory">Inventory</TabsTrigger>
      <TabsTrigger value="pricing">Pricing</TabsTrigger>
    </TabsList>
    <TabsContent value="overview" className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
      Award-winning strategy board game for 3–4 players. Ships next business day.
    </TabsContent>
    <TabsContent value="inventory" className="rounded-md border bg-card p-4 text-sm">
      <div className="flex items-center justify-between">
        <span>On hand</span>
        <Badge variant="success">42 units</Badge>
      </div>
    </TabsContent>
    <TabsContent value="pricing" className="rounded-md border bg-card p-4 text-sm">
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Retail</span><span className="tabular-nums">$899.00</span></div>
    </TabsContent>
  </Tabs>
);

// Order filters as a segmented control.
export const OrderFilters = () => (
  <Tabs defaultValue="open" className="w-96 max-w-full">
    <TabsList className="w-full">
      <TabsTrigger value="open">Open</TabsTrigger>
      <TabsTrigger value="paid">Paid</TabsTrigger>
      <TabsTrigger value="shipped">Shipped</TabsTrigger>
      <TabsTrigger value="all">All</TabsTrigger>
    </TabsList>
  </Tabs>
);
