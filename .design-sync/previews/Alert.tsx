import * as React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@retail-os/ui-react';

// Informational alert — operational notice on the POS.
export const Notice = () => (
  <Alert className="max-w-md">
    <AlertTitle>Cash drawer reconciled</AlertTitle>
    <AlertDescription>Today's till matched the expected total. Safe to close the register.</AlertDescription>
  </Alert>
);

// Destructive alert — a payment failure the cashier must act on.
export const PaymentFailed = () => (
  <Alert variant="destructive" className="max-w-md">
    <AlertTitle>Card declined</AlertTitle>
    <AlertDescription>The payment was declined by the issuer. Ask the customer for another method or retry.</AlertDescription>
  </Alert>
);

// Low-inventory warning shown above a product list.
export const LowInventory = () => (
  <Alert className="max-w-md">
    <AlertTitle>3 products below reorder point</AlertTitle>
    <AlertDescription>Review the inventory tab to create purchase orders before you run out.</AlertDescription>
  </Alert>
);
