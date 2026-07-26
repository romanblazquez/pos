'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LocaleSwitcher as DesignSystemLocaleSwitcher } from '@retail-os/ui-react';
import {
  DEFAULT_MARKET,
  LOCALES,
  localePrefix,
  parseLocalePrefix,
  resolveKind,
  segmentFor,
  type Locale,
} from '@/lib/segments';

// Shared cross-app language preference cookie — same pattern as jp-theme in
// ThemeToggle.tsx, so apps/marketplace can read the same preference.
function persistSharedLocale(locale: Locale) {
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

// Product slugs are locale-independent (shared BGG slug), so carrying the slug
// across locales is safe. Guide and category-theme slugs are localized, so a naive
// carry-over 404s — for those we fall back to the parent listing in the target
// locale unless the page published an exact alternate (see resolveTarget).
const SLUG_SHARED_KINDS = new Set(['games']);

/**
 * Rewrites the current path into the target language, preserving the entity
 * kind/slug when safe AND staying in the same market.
 *
 * Switching language must never switch market: a Mexican shopper reading in
 * English is still shopping in Mexico, and silently moving them to another
 * market would change their sellers, currency and tax treatment.
 */
function localizedPath(pathname: string, currentLocale: Locale, targetLocale: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const [prefix, segment, ...rest] = parts;
  const market = parseLocalePrefix(prefix ?? '')?.market ?? DEFAULT_MARKET;
  const home = `/${localePrefix(targetLocale, market)}`;
  if (!segment) return home;
  const kind = resolveKind(currentLocale, segment);
  if (!kind) return home;
  // Detail page whose slug is localized and no exact alternate is known: land on
  // the parent listing in the target locale rather than a guaranteed 404.
  if (rest.length > 0 && !SLUG_SHARED_KINDS.has(kind)) {
    return [home, segmentFor(kind, targetLocale)].join('/');
  }
  return [home, segmentFor(kind, targetLocale), ...rest].join('/');
}

/** Prefer the exact per-locale URL the page published (data-alt-xx), else derive one. */
function resolveTarget(pathname: string, currentLocale: Locale, targetLocale: Locale): string {
  if (typeof document !== 'undefined') {
    const published = document.documentElement.getAttribute(`data-alt-${targetLocale}`);
    if (published) return published;
  }
  return localizedPath(pathname, currentLocale, targetLocale);
}

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${localePrefix(locale, DEFAULT_MARKET)}`;
  const router = useRouter();

  function switchTo(target: string) {
    if (target === locale) return;
    persistSharedLocale(target as Locale);
    router.push(resolveTarget(pathname, locale, target as Locale));
  }

  return (
    <DesignSystemLocaleSwitcher
      locales={LOCALES}
      active={locale}
      onSelect={switchTo}
      ariaLabel={locale === 'es' ? 'Idioma' : 'Language'}
    />
  );
}
