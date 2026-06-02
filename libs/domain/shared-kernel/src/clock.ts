/**
 * Clock — injectable time source. Domain code never calls `Date.now()`
 * directly so that behaviour (timeouts, expirations, saga deadlines) is
 * deterministic and testable.
 */
export interface Clock {
  now(): Date;
  isoNow(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  isoNow: () => new Date().toISOString(),
};

/** A controllable clock for tests. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  isoNow(): string {
    return this.current.toISOString();
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date): void {
    this.current = date;
  }
}
