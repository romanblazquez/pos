import { Subject, BehaviorSubject, filter, firstValueFrom, timeout, map } from 'rxjs';
import { nanoid } from 'nanoid';
import type {
  RwpEnvelope,
  RwpKind,
  RwpContext,
  RwpEventMap,
  RwpEventType,
  RwpIntentMap,
  RwpIntentName,
  RwpCommandMap,
  RwpCommandName,
} from '@retail-os/rwp-core';
import { InProcessTransport, type RwpTransport } from './transport.js';

export interface RwpBusOptions {
  /** Logical identity of this bus endpoint, e.g. 'app:pos' or 'shell'. */
  source: string;
  transport?: RwpTransport;
  /** Protocol version stamped on outgoing envelopes. */
  version?: string;
}

export interface PublishOptions {
  target?: string | null;
  correlationId?: string;
}

/**
 * RwpBus — the typed, RxJS-backed Retail Workspace Protocol client.
 *
 * Capabilities (mirroring the spec): `publish` / `subscribe` / `request` /
 * `respond` / `setContext` / `getContext`, plus typed `raiseIntent` /
 * `onIntent` and `sendCommand` / `onCommand` helpers. All traffic flows through
 * a {@link RwpTransport}, so the same API works in-process and across windows.
 */
export class RwpBus {
  private readonly source: string;
  private readonly version: string;
  private readonly transport: RwpTransport;
  /** Every inbound envelope, fanned out to subscribers. */
  private readonly inbound$ = new Subject<RwpEnvelope>();
  /** Last-value cache per context type. */
  private readonly contexts = new Map<string, BehaviorSubject<RwpContext | null>>();

  constructor(opts: RwpBusOptions) {
    this.source = opts.source;
    this.version = opts.version ?? '1.0';
    this.transport = opts.transport ?? new InProcessTransport();
    this.transport.incoming$.subscribe((env) => this.inbound$.next(env));
  }

  private envelope<T>(kind: RwpKind, type: string, payload: T, opts?: PublishOptions): RwpEnvelope<T> {
    return {
      eventId: nanoid(),
      correlationId: opts?.correlationId ?? nanoid(),
      timestamp: new Date().toISOString(),
      source: this.source,
      target: opts?.target ?? null,
      version: this.version,
      kind,
      type,
      payload,
    };
  }

  private dispatch(env: RwpEnvelope): void {
    this.transport.send(env);
  }

  // ─── Events ─────────────────────────────────────────────────────────────
  publish<K extends RwpEventType>(type: K, payload: RwpEventMap[K], opts?: PublishOptions): string {
    const env = this.envelope('event', type, payload, opts);
    this.dispatch(env);
    return env.correlationId;
  }

  subscribe<K extends RwpEventType>(
    type: K,
    handler: (payload: RwpEventMap[K], env: RwpEnvelope<RwpEventMap[K]>) => void,
  ): () => void {
    const sub = this.inbound$
      .pipe(filter((e) => e.kind === 'event' && e.type === type))
      .subscribe((e) => handler(e.payload as RwpEventMap[K], e as RwpEnvelope<RwpEventMap[K]>));
    return () => sub.unsubscribe();
  }

  /** Observe a single event type as an RxJS stream. */
  on$<K extends RwpEventType>(type: K) {
    return this.inbound$.pipe(
      filter((e) => e.kind === 'event' && e.type === type),
      map((e) => e.payload as RwpEventMap[K]),
    );
  }

  // ─── Request / Response ──────────────────────────────────────────────────
  async request<TReq, TRes>(type: string, payload: TReq, timeoutMs = 5000): Promise<TRes> {
    const env = this.envelope('request', type, payload);
    const response = firstValueFrom(
      this.inbound$.pipe(
        filter((e) => e.kind === 'response' && e.replyTo === env.eventId),
        timeout({ first: timeoutMs }),
      ),
    );
    this.dispatch(env);
    const res = await response;
    return res.payload as TRes;
  }

  onRequest<TReq, TRes>(type: string, handler: (payload: TReq, env: RwpEnvelope<TReq>) => TRes | Promise<TRes>): () => void {
    const sub = this.inbound$
      .pipe(filter((e) => e.kind === 'request' && e.type === type))
      .subscribe(async (e) => {
        const result = await handler(e.payload as TReq, e as RwpEnvelope<TReq>);
        this.respond(e, result);
      });
    return () => sub.unsubscribe();
  }

  respond<T>(request: RwpEnvelope, payload: T): void {
    const env = this.envelope('response', request.type, payload, {
      target: request.source,
      correlationId: request.correlationId,
    });
    env.replyTo = request.eventId;
    this.dispatch(env);
  }

  // ─── Intents ─────────────────────────────────────────────────────────────
  raiseIntent<K extends RwpIntentName>(name: K, payload: RwpIntentMap[K], opts?: PublishOptions): string {
    const env = this.envelope('intent', name, payload, opts);
    this.dispatch(env);
    return env.correlationId;
  }

  onIntent<K extends RwpIntentName>(
    name: K,
    handler: (payload: RwpIntentMap[K], env: RwpEnvelope<RwpIntentMap[K]>) => void,
  ): () => void {
    const sub = this.inbound$
      .pipe(filter((e) => e.kind === 'intent' && e.type === name))
      .subscribe((e) => handler(e.payload as RwpIntentMap[K], e as RwpEnvelope<RwpIntentMap[K]>));
    return () => sub.unsubscribe();
  }

  // ─── Commands ────────────────────────────────────────────────────────────
  sendCommand<K extends RwpCommandName>(name: K, payload: RwpCommandMap[K], target?: string): void {
    this.dispatch(this.envelope('command', name, payload, { target }));
  }

  onCommand<K extends RwpCommandName>(
    name: K,
    handler: (payload: RwpCommandMap[K], env: RwpEnvelope<RwpCommandMap[K]>) => void,
  ): () => void {
    const sub = this.inbound$
      .pipe(filter((e) => e.kind === 'command' && e.type === name))
      .subscribe((e) => handler(e.payload as RwpCommandMap[K], e as RwpEnvelope<RwpCommandMap[K]>));
    return () => sub.unsubscribe();
  }

  // ─── Shared context ──────────────────────────────────────────────────────
  private contextSubject(type: string): BehaviorSubject<RwpContext | null> {
    let subject = this.contexts.get(type);
    if (!subject) {
      subject = new BehaviorSubject<RwpContext | null>(null);
      this.contexts.set(type, subject);
    }
    return subject;
  }

  setContext<T>(type: string, payload: T): void {
    this.contextSubject(type).next({ type, payload });
  }

  getContext<T>(type: string): RwpContext<T> | null {
    return this.contextSubject(type).getValue() as RwpContext<T> | null;
  }

  onContext<T>(type: string, handler: (ctx: RwpContext<T> | null) => void): () => void {
    const sub = this.contextSubject(type).subscribe((c) => handler(c as RwpContext<T> | null));
    return () => sub.unsubscribe();
  }
}
