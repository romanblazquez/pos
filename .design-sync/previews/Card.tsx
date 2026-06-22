import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Currency,
} from '@retail-os/ui-react';

// Product card — the storefront workhorse. Image block scales, content stays legible.
export const ProductCard = () => (
  <Card className="w-72 max-w-full overflow-hidden pt-0">
    <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/20 via-accent to-secondary" />
    <CardHeader>
      <CardTitle>Catan — 5th Edition</CardTitle>
      <CardDescription>Strategy board game · 3–4 players</CardDescription>
      <CardAction>
        <Badge variant="success">In stock</Badge>
      </CardAction>
    </CardHeader>
    <CardFooter className="justify-between">
      <span className="text-lg font-semibold tabular-nums">
        <Currency value={{ minorUnits: 89900, currency: 'MXN' }} />
      </span>
      <Button size="sm">Add to cart</Button>
    </CardFooter>
  </Card>
);

// KPI stat cards — a responsive metrics row for a merchant dashboard.
export const StatCards = () => (
  <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[
      { label: "Today's sales", value: '$48,210', delta: '+12.4%' },
      { label: 'Orders', value: '312', delta: '+3.1%' },
      { label: 'Avg. ticket', value: '$154.50', delta: '-1.2%' },
    ].map((s) => (
      <Card key={s.label}>
        <CardHeader>
          <CardDescription>{s.label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
          <CardAction>
            <Badge variant={s.delta.startsWith('-') ? 'danger' : 'success'}>{s.delta}</Badge>
          </CardAction>
        </CardHeader>
      </Card>
    ))}
  </div>
);

// Order summary card with structured content + footer total.
export const OrderSummary = () => (
  <Card className="w-80 max-w-full">
    <CardHeader>
      <CardTitle>Order #10428</CardTitle>
      <CardDescription>3 items · paid by card</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">$108.00</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Tax (16%)</span><span className="tabular-nums">$17.28</span></div>
    </CardContent>
    <CardFooter className="justify-between border-t font-medium">
      <span>Total</span>
      <span className="tabular-nums">$125.28</span>
    </CardFooter>
  </Card>
);
