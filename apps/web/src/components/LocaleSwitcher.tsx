'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LocaleSwitcher as DesignSystemLocaleSwitcher } from '@retail-os/ui-react';
import { LOCALES, resolveKind, segmentFor, type Locale } from '@/lib/segments';

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

/** Rewrites the current path into the target locale, preserving the entity kind/slug when safe. */
function localizedPath(pathname: string, currentLocale: Locale, targetLocale: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const [, segment, ...rest] = parts;
  if (!segment) return `/${targetLocale}`;
  const kind = resolveKind(currentLocale, segment);
  if (!kind) return `/${targetLocale}`;
  // Detail page whose slug is localized and no exact alternate is known: land on
  // the parent listing in the target locale rather than a guaranteed 404.
  if (rest.length > 0 && !SLUG_SHARED_KINDS.has(kind)) {
    return ['', targetLocale, segmentFor(kind, targetLocale)].join('/');
  }
  return ['', targetLocale, segmentFor(kind, targetLocale), ...rest].join('/');
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
  const pathname = usePathname() ?? `/${locale}`;
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
