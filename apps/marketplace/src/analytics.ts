import {
  ANALYTICS_CONSENT_EVENT,
  BrowserAnalytics,
  observeWebVitals,
  updateGoogleAdapter,
  type AnalyticsEventType,
  type ConsentState,
} from '@retail-os/analytics-contracts';
import { API_BASE } from './lib/api-client.js';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim();

export const firstPartyAnalytics = new BrowserAnalytics({
  endpoint: API_BASE,
  policyVersion: import.meta.env.VITE_PRIVACY_POLICY_VERSION ?? '2026-07',
  locale: document.documentElement.lang || 'es',
});

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function analyticsConfigured() {
  return Boolean(MEASUREMENT_ID);
}

export function initializeAnalytics() {
  const apply = (state: ConsentState) =>
    updateGoogleAdapter(state, { measurementId: MEASUREMENT_ID, adsId: ADS_ID });
  apply(firstPartyAnalytics.getConsent());
  window.addEventListener(ANALYTICS_CONSENT_EVENT, (event) =>
    apply((event as CustomEvent<ConsentState>).detail));

  window.addEventListener('error', (event) => {
    firstPartyAnalytics.track('client_error', {
      errorType: 'window_error', component: event.filename?.split('/').at(-1), fatal: false,
    });
  });
  window.addEventListener('unhandledrejection', () => {
    firstPartyAnalytics.track('client_error', { errorType: 'unhandled_rejection', fatal: false });
  });
  observeWebVitals((metric) => firstPartyAnalytics.track('web_vital', { ...metric }));
}

export function trackPageView(path: string, title = document.title) {
  firstPartyAnalytics.page(path);
  if (firstPartyAnalytics.getConsent().decisions.analytics && window.gtag && MEASUREMENT_ID) {
    window.gtag('event', 'page_view', {
      page_location: new URL(path, window.location.origin).toString(),
      page_path: path, page_title: title,
    });
  }
}

const EVENT_MAP: Record<string, AnalyticsEventType> = {
  page_view: 'page_view',
  search: 'search_submitted',
  view_item: 'game_viewed',
  select_item: 'offer_viewed',
  affiliate_click: 'affiliate_click',
  add_to_wishlist: 'wishlist_changed',
  remove_from_wishlist: 'wishlist_changed',
  login: 'login_completed',
  sign_up: 'account_completed',
};

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  const type = EVENT_MAP[name] ?? 'navigation';
  firstPartyAnalytics.track(type, params);
  if (firstPartyAnalytics.getConsent().decisions.analytics && MEASUREMENT_ID && window.gtag) {
    window.gtag('event', name, params);
  }
}
