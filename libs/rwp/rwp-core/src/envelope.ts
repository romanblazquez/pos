/**
 * Retail Workspace Protocol (RWP) — message envelope.
 *
 * RWP is Retail OS's internal communication protocol (our deliberate replacement
 * for FDC3). Every message exchanged between apps/panels/windows is wrapped in a
 * typed envelope so that routing, correlation, tracing and versioning are uniform
 * across events, intents, commands and request/response.
 */
export type RwpKind = 'event' | 'intent' | 'command' | 'request' | 'response';

export interface RwpEnvelope<T = unknown> {
  /** Unique id for this single message. */
  eventId: string;
  /** Ties together every message in one logical flow (a checkout, a sync run…). */
  correlationId: string;
  /** ISO-8601 emission time. */
  timestamp: string;
  /** Logical sender, e.g. 'app:pos' or 'shell'. */
  source: string;
  /** Logical recipient, or null for broadcast. */
  target: string | null;
  /** Protocol/schema version of `payload` for this `type`. */
  version: string;
  kind: RwpKind;
  /** Dot-namespaced message type, e.g. 'rwp.payment.completed'. */
  type: string;
  payload: T;
  /** Set on a `response` to point back at the originating `request`. */
  replyTo?: string;
}

/** Shared context published on a named channel and cached last-value. */
export interface RwpContext<T = unknown> {
  type: string;
  payload: T;
}
