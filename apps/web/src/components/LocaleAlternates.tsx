'use client';

import { useEffect } from 'react';
import type { Locale } from '@/lib/segments';

// Publishes the current page's real per-locale URLs onto <html data-alt-xx="…">
// so the header LocaleSwitcher can jump straight to the correct translated URL —
// even for pages whose slug differs per locale (guides, category themes) and even
// while a locale is noindex (so it can't be read from the hreflang <link> tags).
// Server components can't hand data to the layout-level switcher directly, so this
// tiny client island bridges them via a data attribute. Cleared on unmount.
export function LocaleAlternates({ alternates }: { alternates: Partial<Record<Locale, string>> }) {
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(alternates) as Array<[Locale, string]>;
    for (const [loc, path] of entries) {
      if (path) root.setAttribute(`data-alt-${loc}`, path);
    }
    return () => {
      for (const [loc] of entries) root.removeAttribute(`data-alt-${loc}`);
    };
  }, [alternates]);
  return null;
}
