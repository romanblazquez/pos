import type { ConsentState } from './consent.js';

export interface ConsentChange {
  previous: ConsentState;
  current: ConsentState;
}

/** Vendor-neutral boundary for a certified CMP. */
export interface CmpAdapter {
  readonly name: string;
  initialize(defaultState: ConsentState): Promise<ConsentState>;
  openPreferences(): void;
  subscribe(listener: (change: ConsentChange) => void): () => void;
  destroy(): void;
}

export interface DownstreamAnalyticsAdapter {
  readonly name: string;
  updateConsent(state: ConsentState): void;
  track(event: { type: string; properties: Record<string, unknown> }): void;
  deleteUser?(externalUserId: string): Promise<void>;
}

