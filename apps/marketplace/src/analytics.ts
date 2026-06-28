const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

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
  if (!MEASUREMENT_ID || document.querySelector(`script[data-ga-id="${MEASUREMENT_ID}"]`)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => window.dataLayer.push(args);
  // Analytics is granted unconditionally for now (no consent banner). Ad
  // signals stay off so we only collect first-party analytics.
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
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
}

export function trackPageView(path: string, title = document.title) {
  trackEvent('page_view', {
    page_location: new URL(path, window.location.origin).toString(),
    page_path: path,
    page_title: title,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', name, params);
}
