'use client';

import { usePathname, useRouter } from 'next/navigation';
import { MarketSwitcher as SharedMarketSwitcher } from '@retail-os/ui-react';
import {
  MARKETS,
  localePrefix,
  resolveKind,
  segmentFor,
  type Locale,
} from '@/lib/segments';

/**
 * Cross-app market preference. Read by the marketplace SPA's `activeMarketCode`,
 * so switching market on the SEO site carries into app.juegospedia.com rather
 * than the two disagreeing about which country the shopper is in.
 */
function persistMarket(marketCode: string) {
  const sharedDomain =
    location.hostname === 'juegospedia.com' || location.hostname.endsWith('.juegospedia.com');
  document.cookie = [
    `jp-market=${marketCode.toUpperCase()}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    sharedDomain ? 'Domain=.juegospedia.com' : '',
    location.protocol === 'https:' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

/**
 * Slugs are market-independent (a game is the same game), so a detail page can
 * carry across. Everything else lands on the equivalent listing in the target
 * market — never a 404, and never the previous market's commercial terms.
 */
function targetPath(pathname: string, locale: Locale, market: string): string {
  const [, segment, ...rest] = pathname.split('/').filter(Boolean);
  const home = `/${localePrefix(locale, market)}`;
  if (!segment) return home;
  const kind = resolveKind(locale, segment);
  if (!kind) return home;
  // Guides and editor profiles are editorial, not commercial: they exist once
  // per language, so carrying the slug is safe. Games keep their slug too.
  const carriesSlug = kind === 'games' || kind === 'guides' || kind === 'editors';
  return carriesSlug
    ? [home, segmentFor(kind, locale), ...rest].join('/')
    : [home, segmentFor(kind, locale)].join('/');
}

/**
 * The apex market picker.
 *
 * Presentation comes from the shared control the SPA header also uses, so the
 * two hosts cannot drift into looking like different stores. Only the behaviour
 * differs, and it has to: here a market is part of the URL, so switching
 * navigates; in the SPA the market is a cookie, so it reloads in place.
 */
export function MarketSwitcher({
  locale,
  market,
  placement,
}: {
  locale: Locale;
  market: string;
  placement?: 'bottom' | 'top';
}) {
  const pathname = usePathname() ?? `/${localePrefix(locale, market)}`;
  const router = useRouter();

  const options = Object.values(MARKETS)
    .filter((m) => m.languages.includes(locale))
    .map((m) => ({ code: m.code, name: m.name, currency: m.canonicalCurrency }));

  function switchTo(code: string) {
    const target = Object.values(MARKETS).find((m) => m.code === code);
    if (!target || target.urlCode === market) return;
    persistMarket(target.code);
    router.push(targetPath(pathname, locale, target.urlCode));
  }

  return (
    <SharedMarketSwitcher
      markets={options}
      active={MARKETS[market]?.code ?? market.toUpperCase()}
      onSelect={switchTo}
      ariaLabel={locale === 'es' ? 'Cambiar de mercado' : 'Change market'}
      placement={placement}
    />
  );
}
