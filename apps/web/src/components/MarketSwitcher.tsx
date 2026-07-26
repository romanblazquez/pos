'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  MARKETS,
  localePrefix,
  parseLocalePrefix,
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

export function MarketSwitcher({ locale, market }: { locale: Locale; market: string }) {
  const pathname = usePathname() ?? `/${localePrefix(locale, market)}`;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const active = MARKETS[market];
  const options = Object.values(MARKETS).filter((m) => m.languages.includes(locale));
  if (options.length < 2) return null;

  function switchTo(targetMarket: string) {
    setOpen(false);
    if (targetMarket === market) return;
    persistMarket(MARKETS[targetMarket].code);
    const parsed = parseLocalePrefix(localePrefix(locale, targetMarket));
    if (!parsed) return;
    router.push(targetPath(pathname, locale, targetMarket));
  }

  return (
    <div className="market-switcher">
      <button
        type="button"
        className="market-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={locale === 'es' ? 'Cambiar de mercado' : 'Change market'}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{active?.name ?? market.toUpperCase()}</span>
        <span className="market-switcher-currency">{active?.canonicalCurrency}</span>
      </button>

      {open && (
        <ul className="market-switcher-menu" role="listbox">
          {options.map((option) => (
            <li key={option.urlCode}>
              <button
                type="button"
                role="option"
                aria-selected={option.urlCode === market}
                className={`market-switcher-option${option.urlCode === market ? ' is-active' : ''}`}
                onClick={() => switchTo(option.urlCode)}
              >
                <span>{option.name}</span>
                <span className="market-switcher-currency">{option.canonicalCurrency}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
