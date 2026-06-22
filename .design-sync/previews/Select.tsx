import * as React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@retail-os/ui-react';

// Closed trigger — the common form-field state (store picker).
export const StorePicker = () => (
  <Select defaultValue="centro">
    <SelectTrigger className="w-56">
      <SelectValue placeholder="Select a store" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="centro">Centro — Mexico City</SelectItem>
      <SelectItem value="polanco">Polanco</SelectItem>
      <SelectItem value="gdl">Guadalajara</SelectItem>
    </SelectContent>
  </Select>
);

// Open state with grouped options — rendered open to show the listbox.
export const PaymentMethod = () => (
  <div className="flex justify-center py-4">
    <Select defaultOpen defaultValue="card">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Payment method" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Cards</SelectLabel>
          <SelectItem value="card">Credit / debit card</SelectItem>
          <SelectItem value="contactless">Contactless</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Other</SelectLabel>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="transfer">Bank transfer</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
