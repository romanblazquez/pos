import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_BASE, activeMarketCode } from '../lib/api-client.js';

export interface Market {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  languageCode: string;
  timezone: string;
}

export type UiLocale = 'es' | 'en';

// Kept in sync with apps/api/src/markets/default-market.constants.ts — used
// as the initial render value and as the fallback if /api/v1/markets/default
// is unreachable, so market-dependent UI never has to handle a null market.
const FALLBACK_MARKET: Market = {
  countryCode: 'MX',
  countryName: 'México',
  currencyCode: 'MXN',
  currencySymbol: '$',
  languageCode: 'es',
  timezone: 'America/Mexico_City',
};

// Shared cross-app language preference cookie — same pattern as jp-theme in
// App.tsx's readSharedTheme/persistSharedTheme, so apps/web (apex) and
// apps/marketplace agree on the visitor's chosen locale. Drives the
// react-intl catalogs in src/i18n/messages/{es,en}.json — covers the
// discovery/conversion path today (header, home, search, product); the
// rest of the app is still Spanish-only pending further migration.
function readSharedLocale(): UiLocale | null {
  const cookie = document.cookie.match(/(?:^|;\s*)jp-locale=(es|en)(?:;|$)/)?.[1];
  return cookie === 'es' || cookie === 'en' ? cookie : null;
}

function persistSharedLocale(locale: UiLocale) {
  const sharedDomain = location.hostname === 'juegospedia.com' || location.hostname.endsWith('.juegospedia.com');
  const secure = location.protocol === 'https:';
  document.cookie = [
    `jp-locale=${locale}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    sharedDomain ? 'Domain=.juegospedia.com' : '',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

interface MarketCtx extends Market {
  uiLocale: UiLocale;
  setUiLocale: (locale: UiLocale) => void;
}

const Ctx = createContext<MarketCtx>({ ...FALLBACK_MARKET, uiLocale: 'es', setUiLocale: () => {} });

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<Market>(FALLBACK_MARKET);
  const [uiLocale, setUiLocaleState] = useState<UiLocale>(() => readSharedLocale() ?? 'es');

  // Resolve the shopper's market from the SHARED cookie the switcher on
  // juegospedia.com writes, falling back to the platform default only when they
  // have never chosen. Previously this always fetched the default, so a shopper
  // who picked Argentina had their offers queried in AR (activeMarketCode reads
  // the cookie) while this context still reported MXN — the app quoting one
  // market's prices under another market's currency.
  useEffect(() => {
    let cancelled = false;
    const chosen = activeMarketCode();
    const url = `${API_BASE}/api/v1/markets/${encodeURIComponent(chosen)}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Market | null) => {
        if (!cancelled && data) return setMarket(data);
        // Unknown or unreachable market: fall back to the platform default
        // rather than silently keeping a currency the shopper did not choose.
        return fetch(`${API_BASE}/api/v1/markets/default`)
          .then((res) => (res.ok ? res.json() : null))
          .then((fallback: Market | null) => {
            if (!cancelled && fallback) setMarket(fallback);
          });
      })
      .catch(() => {
        // Keep FALLBACK_MARKET — no UI regression if the markets endpoint is down.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncSharedLocale = () => {
      const shared = readSharedLocale();
      if (shared) setUiLocaleState(shared);
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncSharedLocale();
    };
    window.addEventListener('focus', syncSharedLocale);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      window.removeEventListener('focus', syncSharedLocale);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, []);

  // Keep <html lang> accurate — assistive tech and browser translation
  // features read this, not just the visible copy (same reasoning as apex's
  // per-locale <html lang={locale}> in apps/web/src/app/[locale]/layout.tsx).
  useEffect(() => {
    document.documentElement.lang = uiLocale;
  }, [uiLocale]);

  function setUiLocale(locale: UiLocale) {
    persistSharedLocale(locale);
    setUiLocaleState(locale);
  }

  return <Ctx.Provider value={{ ...market, uiLocale, setUiLocale }}>{children}</Ctx.Provider>;
}

export function useMarket(): MarketCtx {
  return useContext(Ctx);
}
