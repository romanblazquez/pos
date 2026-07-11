'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function readSharedTheme(): Theme | null {
  const cookie = document.cookie.match(/(?:^|;\s*)jp-theme=(light|dark)(?:;|$)/)?.[1];
  return cookie === 'light' || cookie === 'dark' ? cookie : null;
}

function persistSharedTheme(theme: Theme) {
  const sharedDomain = location.hostname === 'juegospedia.com' || location.hostname.endsWith('.juegospedia.com');
  const secure = location.protocol === 'https:';
  document.cookie = [
    `jp-theme=${theme}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    sharedDomain ? 'Domain=.juegospedia.com' : '',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  localStorage.setItem('jp-theme', theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ locale }: { locale: 'es' | 'en' }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // The cookie is the source of truth. Switching locale re-renders the root
    // layout's <html>, which drops the imperatively-set data-theme (SSR can't
    // emit it) — so read the shared cookie and re-apply, instead of trusting a
    // data-theme that a navigation may have just reset to the light default.
    const stored = readSharedTheme();
    const initial = stored ?? (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    applyTheme(initial);
    setTheme(initial);
    persistSharedTheme(initial);

    const syncSharedTheme = () => {
      const shared = readSharedTheme();
      if (!shared) return;
      applyTheme(shared);
      setTheme(shared);
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncSharedTheme();
    };
    window.addEventListener('focus', syncSharedTheme);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      window.removeEventListener('focus', syncSharedTheme);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    persistSharedTheme(next);
    setTheme(next);
  }

  const label = theme === 'dark'
    ? locale === 'es' ? 'Cambiar a modo claro' : 'Switch to light mode'
    : locale === 'es' ? 'Cambiar a modo oscuro' : 'Switch to dark mode';

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark'
        ? <Sun size={17} aria-hidden="true" />
        : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
