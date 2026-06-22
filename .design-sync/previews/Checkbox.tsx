import * as React from 'react';
import { Checkbox, Label } from '@retail-os/ui-react';

// Single line-item selector with its label.
export const Fulfilled = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="ff" defaultChecked />
    <Label htmlFor="ff">Mark line item as fulfilled</Label>
  </div>
);

// A fulfillment checklist — selectable rows for batch actions.
export const PickList = () => (
  <div className="grid w-80 max-w-full gap-3">
    {[
      { id: 'a', label: 'Catan — 5th Edition', done: true },
      { id: 'b', label: 'Ticket to Ride', done: true },
      { id: 'c', label: 'Carcassonne', done: false },
    ].map((i) => (
      <div key={i.id} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id={i.id} defaultChecked={i.done} />
          <Label htmlFor={i.id}>{i.label}</Label>
        </div>
        <span className="text-xs text-muted-foreground">{i.done ? 'Packed' : 'Pending'}</span>
      </div>
    ))}
  </div>
);

// States: checked, unchecked, disabled.
export const States = () => (
  <div className="flex items-center gap-6">
    <Checkbox defaultChecked />
    <Checkbox />
    <Checkbox disabled defaultChecked />
  </div>
);
