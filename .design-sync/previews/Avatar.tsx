import * as React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@retail-os/ui-react';

// Cashier identity on the register, falling back to initials.
export const Cashier = () => (
  <div className="flex items-center gap-3">
    <Avatar>
      <AvatarImage src="https://i.pravatar.cc/64?img=12" alt="Lucía R." />
      <AvatarFallback>LR</AvatarFallback>
    </Avatar>
    <div className="text-sm">
      <div className="font-medium leading-none">Lucía Reyes</div>
      <div className="text-muted-foreground">Register 2 · Cashier</div>
    </div>
  </div>
);

// Initials-only fallbacks at a couple of sizes for a team list.
export const Team = () => (
  <div className="flex items-center gap-3">
    <Avatar className="size-10"><AvatarFallback>LR</AvatarFallback></Avatar>
    <Avatar className="size-10"><AvatarFallback className="bg-primary/15 text-primary">JM</AvatarFallback></Avatar>
    <Avatar className="size-10"><AvatarFallback>AT</AvatarFallback></Avatar>
  </div>
);
