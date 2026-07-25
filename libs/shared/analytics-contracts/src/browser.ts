import {
  CONSENT_VERSION, allows, defaultConsentState, hasDecided, toGoogleConsent,
  type ConsentState,
} from './consent.js';
import { validateEvent, type AnalyticsEventInput, type AnalyticsEventType } from './events.js';

const CONSENT_KEY = 'jp_consent_v1';
const VISITOR_KEY = 'jp_visitor_v1';
const SESSION_KEY = 'jp_session_v1';
export const ANALYTICS_CONSENT_EVENT = 'juegospedia:consent';

function opaqueId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}_${[...bytes].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function safeStorage(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* privacy mode: memory-only */ }
}

export function loadConsent(policyVersion: string, regime: ConsentState['regime'] = 'default'): ConsentState {
  try {
    const raw = safeStorage(localStorage, CONSENT_KEY);
    if (!raw) return defaultConsentState(regime, policyVersion);
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.policyVersion !== policyVersion || parsed.consentVersion !== CONSENT_VERSION) {
      return defaultConsentState(regime, policyVersion);
    }
    return { ...parsed, source: parsed.source === 'explicit' ? 'restored' : parsed.source };
  } catch {
    return defaultConsentState(regime, policyVersion);
  }
}

export interface BrowserAnalyticsOptions {
  endpoint: string;
  policyVersion: string;
  locale?: string;
  regime?: ConsentState['regime'];
  flushIntervalMs?: number;
}

export class BrowserAnalytics {
  private consent: ConsentState;
  private queue: AnalyticsEventInput[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private visitorId?: string;
  private sessionId?: string;

  constructor(private readonly options: BrowserAnalyticsOptions) {
    this.consent = loadConsent(options.policyVersion, options.regime);
    if (allows(this.consent, 'visitorId')) this.ensureIdentifiers();
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => { void this.flush(); });
    }
  }

  getConsent(): ConsentState { return this.consent; }
  /** Available only after analytics consent, solely for the authenticated link endpoint. */
  getVisitorIdForIdentityLink(): string | undefined { return this.visitorId; }

  async setConsent(state: ConsentState): Promise<void> {
    this.consent = state;
    safeSet(localStorage, CONSENT_KEY, JSON.stringify(state));
    if (allows(state, 'visitorId')) this.ensureIdentifiers();
    if (!allows(state, 'events')) this.queue = [];
    try {
      const response = await fetch(`${this.options.endpoint}/api/v1/analytics/consent`, {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId: this.visitorId, consent: state }),
      });
      if (response.ok) {
        const evidence = await response.json() as { publicId?: string };
        if (evidence.publicId) {
          this.consent = { ...state, consentPublicId: evidence.publicId };
          safeSet(localStorage, CONSENT_KEY, JSON.stringify(this.consent));
        }
      }
    } catch { /* consent UI must never break on telemetry failure */ }
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: this.consent }));
  }

  track(type: AnalyticsEventType, properties: Record<string, unknown> = {}): void {
    const capability = type === 'web_vital' || type === 'client_error'
      ? 'uxDiagnostics'
      : type === 'preference_provided'
        ? 'personalization'
        : type === 'affiliate_click' || type.startsWith('ad_')
          ? 'attribution'
          : 'events';
    if (!allows(this.consent, capability)) return;
    this.ensureIdentifiers();
    const input: AnalyticsEventInput = {
      eventId: opaqueId('evt'), type, occurredAt: new Date().toISOString(),
      url: location.href, referrer: document.referrer, properties,
    };
    const validation = validateEvent(input, location.hostname);
    if (!validation.accepted) return;
    this.queue.push(input);
    if (this.queue.length >= 10) void this.flush();
    else this.schedule();
  }

  page(path = location.pathname): void {
    this.track('page_view', {
      pageType: document.body.dataset.pageType ?? 'unknown',
      title: document.title.slice(0, 200),
      locale: this.options.locale ?? document.documentElement.lang,
      entityId: path,
    });
  }

  async identify(): Promise<void> {
    if (!this.visitorId) return;
    try {
      await fetch(`${this.options.endpoint}/api/v1/analytics/identity/link`, {
        method: 'POST', keepalive: true, credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId: this.visitorId, method: 'login' }),
      });
    } catch { /* authentication must never depend on analytics */ }
  }

  async flush(): Promise<void> {
    if (!this.queue.length || !this.visitorId || !this.sessionId || !allows(this.consent, 'events')) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const events = this.queue.splice(0, 50);
    try {
      const response = await fetch(`${this.options.endpoint}/api/v1/analytics/collect`, {
        method: 'POST', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1, visitorId: this.visitorId, sessionId: this.sessionId,
          consent: this.consent, events,
          context: {
            locale: this.options.locale ?? document.documentElement.lang,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
          },
        }),
      });
      if (!response.ok && response.status >= 500) this.queue.unshift(...events);
    } catch {
      this.queue.unshift(...events);
    }
  }

  private ensureIdentifiers(): void {
    this.visitorId = safeStorage(localStorage, VISITOR_KEY) ?? opaqueId('vis');
    this.sessionId = safeStorage(sessionStorage, SESSION_KEY) ?? opaqueId('ses');
    safeSet(localStorage, VISITOR_KEY, this.visitorId);
    safeSet(sessionStorage, SESSION_KEY, this.sessionId);
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { void this.flush(); }, this.options.flushIntervalMs ?? 3000);
  }
}

export interface GoogleAdapterOptions {
  measurementId?: string;
  adsId?: string;
}

/** Google is downstream: no provider script is inserted before consent permits it. */
export function updateGoogleAdapter(state: ConsentState, options: GoogleAdapterOptions): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = w.gtag ?? ((...args: unknown[]) => { w.dataLayer!.push(args); });
  w.gtag('consent', hasDecided(state) ? 'update' : 'default', toGoogleConsent(state));
  const permitted = state.decisions.analytics || state.decisions.advertisingStorage;
  const id = options.measurementId ?? options.adsId;
  if (!permitted || !id || document.querySelector(`script[data-google-tag="${id}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.dataset.googleTag = id;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  w.gtag('js', new Date());
  if (options.measurementId && state.decisions.analytics) {
    w.gtag('config', options.measurementId, {
      send_page_view: false,
      allow_google_signals: state.decisions.advertisingPersonalization,
    });
  }
  if (options.adsId && state.decisions.advertisingStorage) {
    w.gtag('config', options.adsId, { allow_ad_personalization_signals: state.decisions.advertisingPersonalization });
  }
}

export interface WebVitalMeasurement {
  name: 'CLS' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function rating(name: WebVitalMeasurement['name'], value: number): WebVitalMeasurement['rating'] {
  const limits: Record<WebVitalMeasurement['name'], [number, number]> = {
    CLS: [0.1, 0.25], FCP: [1800, 3000], LCP: [2500, 4000], TTFB: [800, 1800],
  };
  return value <= limits[name][0] ? 'good' : value <= limits[name][1] ? 'needs-improvement' : 'poor';
}

/** Small provider-free Web Vitals observer; unsupported entry types are skipped. */
export function observeWebVitals(report: (measurement: WebVitalMeasurement) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => undefined;
  const observers: PerformanceObserver[] = [];
  const watch = (type: string, handler: (entries: PerformanceEntryList) => void) => {
    try {
      const observer = new PerformanceObserver((list) => handler(list.getEntries()));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch { /* unsupported browser */ }
  };
  watch('paint', (entries) => {
    const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) report({ name: 'FCP', value: fcp.startTime, rating: rating('FCP', fcp.startTime) });
  });
  watch('largest-contentful-paint', (entries) => {
    const last = entries.at(-1);
    if (last) report({ name: 'LCP', value: last.startTime, rating: rating('LCP', last.startTime) });
  });
  let cls = 0;
  watch('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      if (!shift.hadRecentInput) cls += shift.value ?? 0;
    }
    report({ name: 'CLS', value: cls, rating: rating('CLS', cls) });
  });
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation) {
    const ttfb = navigation.responseStart;
    report({ name: 'TTFB', value: ttfb, rating: rating('TTFB', ttfb) });
  }
  return () => observers.forEach((observer) => observer.disconnect());
}
