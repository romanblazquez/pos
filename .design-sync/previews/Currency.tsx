import * as React from 'react';
import { Currency } from '@retail-os/ui-react';

// The money primitive — integer minor units in, localized price out (MXN default).
export const Price = () => (
  <span className="text-2xl font-semibold tabular-nums">
    <Currency value={{ minorUnits: 12450, currency: 'MXN' }} />
  </span>
);

// A price row pattern: was/now with a discount, right-aligned and tabular.
export const PriceRow = () => (
  <div className="flex items-baseline justify-between gap-6">
    <span className="text-sm text-muted-foreground">Subtotal</span>
    <span className="flex items-baseline gap-2">
      <span className="text-sm text-muted-foreground line-through tabular-nums">
        <Currency value={{ minorUnits: 14999, currency: 'MXN' }} />
      </span>
      <span className="text-lg font-semibold tabular-nums">
        <Currency value={{ minorUnits: 12450, currency: 'MXN' }} />
      </span>
    </span>
  </div>
);

// Multi-currency display for a marketplace storefront.
export const Currencies = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {[
      { minorUnits: 12450, currency: 'MXN' },
      { minorUnits: 6999, currency: 'USD' },
      { minorUnits: 5950, currency: 'EUR' },
    ].map((m) => (
      <div key={m.currency} className="rounded-md border bg-card px-3 py-2">
        <div className="text-xs text-muted-foreground">{m.currency}</div>
        <div className="font-semibold tabular-nums">
          <Currency value={m} />
        </div>
      </div>
    ))}
  </div>
);
