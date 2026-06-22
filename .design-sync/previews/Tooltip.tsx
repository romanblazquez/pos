import * as React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, Button } from '@retail-os/ui-react';

// Explaining a metric — rendered open so the bubble is visible in the card.
export const MetricHelp = () => (
  <div className="flex items-center justify-center py-10">
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm">Net margin</Button>
      </TooltipTrigger>
      <TooltipContent>Revenue minus cost of goods, after refunds.</TooltipContent>
    </Tooltip>
  </div>
);
