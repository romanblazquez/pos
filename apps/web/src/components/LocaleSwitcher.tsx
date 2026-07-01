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

/** Rewrites the current path into the target locale, preserving the entity kind/slug when resolvable. */
function localizedPath(pathname: string, currentLocale: Locale, targetLocale: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const [, segment, ...rest] = parts;
  if (!segment) return `/${targetLocale}`;
  const kind = resolveKind(currentLocale, segment);
  if (!kind) return `/${targetLocale}`;
  return ['', targetLocale, segmentFor(kind, targetLocale), ...rest].join('/');
}

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const router = useRouter();

  function switchTo(target: string) {
    if (target === locale) return;
    persistSharedLocale(target as Locale);
    router.push(localizedPath(pathname, locale, target as Locale));
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
