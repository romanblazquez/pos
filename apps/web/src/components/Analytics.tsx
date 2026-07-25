'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  BrowserAnalytics,
  observeWebVitals,
  updateGoogleAdapter,
  type ConsentState,
} from '@retail-os/analytics-contracts';
import { ConsentBanner } from '@retail-os/ui-react';
import { GA_MEASUREMENT_ID } from '@/lib/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.juegospedia.com';
// Temporary operator switch. Defaults off until the consent experience is put
// back; optional collection and Google tags remain governed by denied consent.
const CONSENT_UI_ENABLED = (process.env.NEXT_PUBLIC_CONSENT_UI_ENABLED ?? 'false') === 'true';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function Analytics({ locale = 'es' }: { locale?: 'es' | 'en' }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const analytics = useMemo(() => new BrowserAnalytics({
    endpoint: API,
    policyVersion: process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION ?? '2026-07',
    locale,
  }), [locale]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const apply = (state: ConsentState) => updateGoogleAdapter(state, {
      measurementId: GA_MEASUREMENT_ID,
      adsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    });
    apply(analytics.getConsent());
    const changed = (event: Event) => apply((event as CustomEvent<ConsentState>).detail);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, changed);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, changed);
  }, [analytics]);

  useEffect(() => observeWebVitals((metric) => analytics.track('web_vital', { ...metric })), [analytics]);

  useEffect(() => {
    analytics.page(pathname);
    const state = analytics.getConsent();
    if (state.decisions.analytics && GA_MEASUREMENT_ID && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: pathname, page_location: window.location.href, page_title: document.title,
      });
    }
  }, [analytics, pathname]);

  useEffect(() => {
    const error = (event: ErrorEvent) => analytics.track('client_error', {
      errorType: 'window_error', component: event.filename?.split('/').at(-1), fatal: false,
    });
    const rejection = () => analytics.track('client_error', {
      errorType: 'unhandled_rejection', fatal: false,
    });
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    return () => {
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    };
  }, [analytics]);

  return mounted && CONSENT_UI_ENABLED
    ? <ConsentBanner analytics={analytics} locale={locale} />
    : null;
}
