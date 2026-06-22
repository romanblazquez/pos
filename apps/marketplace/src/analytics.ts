const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const CONSENT_KEY = 'juegospedia.analytics-consent';

export type AnalyticsConsent = 'granted' | 'denied' | null;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function analyticsConfigured() {
  return Boolean(MEASUREMENT_ID);
}

export function getAnalyticsConsent(): AnalyticsConsent {
  const stored = localStorage.getItem(CONSENT_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

export function initializeAnalytics() {
  if (!MEASUREMENT_ID || document.querySelector(`script[data-ga-id="${MEASUREMENT_ID}"]`)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => window.dataLayer.push(args);
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.dataset.gaId = MEASUREMENT_ID;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  if (getAnalyticsConsent() === 'granted') updateAnalyticsConsent('granted');
}

export function updateAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
  localStorage.setItem(CONSENT_KEY, consent);
  window.gtag?.('consent', 'update', {
    analytics_storage: consent,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function trackPageView(path: string, title = document.title) {
  trackEvent('page_view', {
    page_location: new URL(path, window.location.origin).toString(),
    page_path: path,
    page_title: title,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!MEASUREMENT_ID || getAnalyticsConsent() !== 'granted' || !window.gtag) return;
  window.gtag('event', name, params);
}
