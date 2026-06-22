import * as React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Button,
  Input,
  Label,
} from '@retail-os/ui-react';

// Refund confirmation — shown open so the modal content renders inside the card.
export const ConfirmRefund = () => (
  <Dialog defaultOpen modal={false}>
    <DialogTrigger asChild>
      <Button variant="destructive">Refund order</Button>
    </DialogTrigger>
    <DialogContent className="relative left-0 top-0 translate-x-0 translate-y-0">
      <DialogHeader>
        <DialogTitle>Refund order #10428?</DialogTitle>
        <DialogDescription>
          This refunds $125.28 to the original card. The customer is notified by email.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Input id="reason" placeholder="Damaged in transit…" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button variant="destructive">Refund $125.28</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
