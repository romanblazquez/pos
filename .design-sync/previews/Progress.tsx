import * as React from 'react';
import { Progress } from '@retail-os/ui-react';

// A daily sales-goal tracker.
export const SalesGoal = () => (
  <div className="w-80 max-w-full space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Daily sales goal</span>
      <span className="text-muted-foreground tabular-nums">$48.2k / $60k</span>
    </div>
    <Progress value={80} />
  </div>
);

// Fulfillment progress across several open orders.
export const Fulfillment = () => (
  <div className="grid w-80 max-w-full gap-4">
    {[
      { label: 'Order #10428', value: 100 },
      { label: 'Order #10429', value: 60 },
      { label: 'Order #10430', value: 25 },
    ].map((o) => (
      <div key={o.label} className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{o.label}</span>
          <span className="tabular-nums">{o.value}%</span>
        </div>
        <Progress value={o.value} />
      </div>
    ))}
  </div>
);
