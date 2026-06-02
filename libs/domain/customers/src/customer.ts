import { type CustomerId } from '@retail-os/shared-kernel';

/**
 * Customer — minimal aggregate for the POS customer-assignment and loyalty
 * accrual flows. The full CRM context (segments, contact history, consents)
 * lives in the backoffice and is out of scope for the POS slice.
 */
export interface Customer {
  readonly id: CustomerId;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  loyaltyPoints: number;
}

/** Earn 1 loyalty point per whole major currency unit spent (configurable). */
export function accrueLoyalty(current: number, amountMinorUnits: number, pointsPerMajorUnit = 1): number {
  return current + Math.floor(amountMinorUnits / 100) * pointsPerMajorUnit;
}
