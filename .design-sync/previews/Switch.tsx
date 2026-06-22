import * as React from 'react';
import { Switch, Label } from '@retail-os/ui-react';

// A store-settings toggle row, label and control justified across the row.
export const SettingRow = () => (
  <div className="flex w-80 max-w-full items-center justify-between gap-4">
    <div className="grid gap-0.5">
      <Label htmlFor="card">Accept card payments</Label>
      <span className="text-xs text-muted-foreground">Process Visa, Mastercard & contactless.</span>
    </div>
    <Switch id="card" defaultChecked />
  </div>
);

// A small group of register settings.
export const SettingsGroup = () => (
  <div className="grid w-80 max-w-full gap-4">
    {[
      { id: 's1', label: 'Print receipts automatically', on: true },
      { id: 's2', label: 'Round cash to nearest peso', on: true },
      { id: 's3', label: 'Require manager PIN for refunds', on: false },
    ].map((s) => (
      <div key={s.id} className="flex items-center justify-between gap-4">
        <Label htmlFor={s.id}>{s.label}</Label>
        <Switch id={s.id} defaultChecked={s.on} />
      </div>
    ))}
  </div>
);
