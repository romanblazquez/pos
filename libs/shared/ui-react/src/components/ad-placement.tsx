'use client';

import * as React from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  createAdRequest,
  type AdCreative,
  type AdvertisingAdapter,
  type BrowserAnalytics,
  type ConsentState,
} from '@retail-os/analytics-contracts';

/**
 * Provider-neutral ad slot. A provider receives the resolved ad mode and cannot
 * silently turn limited inventory into personalized inventory.
 */
export function AdPlacement({
  id,
  pageType,
  locale,
  analytics,
  adapter,
  entityType,
  entityId,
  className,
}: {
  id: string;
  pageType: string;
  locale: string;
  analytics: BrowserAnalytics;
  adapter: AdvertisingAdapter;
  entityType?: string;
  entityId?: string;
  className?: string;
}) {
  const [creative, setCreative] = React.useState<AdCreative | null>(null);
  const [consent, setConsent] = React.useState(analytics.getConsent());

  React.useEffect(() => {
    const changed = (event: Event) =>
      setConsent((event as CustomEvent<ConsentState>).detail);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, changed);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, changed);
  }, []);

  React.useEffect(() => {
    let active = true;
    const request = createAdRequest(consent, {
      placement: id, pageType, locale, entityType, entityId,
    });
    adapter.request(request).then((next) => {
      if (!active) return;
      setCreative(next);
      if (next) analytics.track('ad_impression', {
        provider: next.provider, placement: id, creativeId: next.creativeId,
        campaignId: next.campaignId, mode: request.mode, pageType, entityType, entityId,
      });
    }).catch(() => { /* ad failures never affect page content */ });
    return () => { active = false; adapter.destroy?.(id); };
  }, [adapter, analytics, consent, entityId, entityType, id, locale, pageType]);

  if (!creative) return null;
  const content = creative.imageUrl
    ? <img src={creative.imageUrl} width={creative.width} height={creative.height} alt="" loading="lazy" />
    : null;
  if (!content) return null;
  return (
    <aside className={className} aria-label={locale.startsWith('es') ? 'Publicidad' : 'Advertisement'}
      data-ad-placement={id} data-ad-provider={creative.provider}>
      {creative.clickUrl ? (
        <a href={creative.clickUrl} rel="sponsored noopener"
          onClick={() => analytics.track('ad_click', {
            provider: creative.provider, placement: id, creativeId: creative.creativeId,
            campaignId: creative.campaignId, mode: createAdRequest(consent, { placement: id, pageType, locale }).mode,
          })}>
          {content}
        </a>
      ) : content}
    </aside>
  );
}
