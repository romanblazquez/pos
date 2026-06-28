'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { GA_MEASUREMENT_ID } from '@/lib/site';

const GA_ENABLED = process.env.NODE_ENV === 'production';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// GA4 for the SSR storefront. Analytics is granted unconditionally for now (no
// consent banner); ad signals stay off. The gtag `config` does NOT auto-send a
// page_view — we emit them ourselves so client-side <Link> navigations (which
// don't trigger a full page load) are counted too.
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ENABLED || !GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent','default',{
            analytics_storage:'granted',
            ad_storage:'denied',
            ad_user_data:'denied',
            ad_personalization:'denied'
          });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            allow_google_signals: false
          });
        `}
      </Script>
    </>
  );
}
