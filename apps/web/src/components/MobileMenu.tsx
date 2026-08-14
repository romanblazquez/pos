'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, ChevronRight, Dices, LayoutGrid, Menu, Puzzle, Search, User, X } from 'lucide-react';
import { MeepleMark } from './MeepleMark';
import { ThemeToggle } from './ThemeToggle';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MarketSwitcher } from './MarketSwitcher';
import { DEFAULT_MARKET, listingPath, type Locale } from '@/lib/segments';
import { APP_URL } from '@/lib/site';

const COPY = {
  es: {
    open: 'Abrir menú', close: 'Cerrar menú', nav: 'Menú principal',
    games: 'Juegos', categories: 'Categorías', guides: 'Guías', search: 'Buscar juegos',
    publishers: 'Editoriales', mechanics: 'Mecánicas',
    gamesHint: 'Explora el catálogo completo',
    categoriesHint: 'Navega por tipo y temática',
    guidesHint: 'Rankings y mejores listas',
    publishersHint: 'Explora por editorial',
    mechanicsHint: 'Explora por mecánica de juego',
    login: 'Iniciar sesión',
    settings: 'Preferencias',
    market: 'Mercado y moneda',
  },
  en: {
    open: 'Open menu', close: 'Close menu', nav: 'Main menu',
    games: 'Games', categories: 'Categories', guides: 'Guides', search: 'Search games',
    publishers: 'Publishers', mechanics: 'Mechanics',
    gamesHint: 'Browse the full catalogue',
    categoriesHint: 'Explore by type and theme',
    guidesHint: 'Rankings and best-of lists',
    publishersHint: 'Browse by publisher',
    mechanicsHint: 'Browse by game mechanic',
    login: 'Log in',
    settings: 'Preferences',
    market: 'Market & currency',
  },
} as const;

/**
 * Mobile navigation drawer. The trigger stays inline in the header; the panel is
 * portalled to <body> so the header's backdrop-filter (which would otherwise
 * become the containing block for a fixed child) can't trap it. Handles focus
 * trapping, Escape/backdrop dismissal, scroll-lock, and route-change close.
 */
export function MobileMenu({
  locale,
  market,
}: {
  locale: Locale;
  /** Keeps mobile navigation inside the shopper's market. */
  market?: string;
}) {
  const t = COPY[locale];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  // Close whenever navigation lands on a new route.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the panel once it's painted.
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      triggerRef.current?.focus();
    };
  }, [open]);

  const links = [
    { href: listingPath('games', locale, market), label: t.games, hint: t.gamesHint, Icon: Dices },
    { href: listingPath('categories', locale, market), label: t.categories, hint: t.categoriesHint, Icon: LayoutGrid },
    { href: listingPath('guides', locale, market), label: t.guides, hint: t.guidesHint, Icon: BookOpen },
    { href: listingPath('publishers', locale, market), label: t.publishers, hint: t.publishersHint, Icon: Building2 },
    { href: listingPath('mechanics', locale, market), label: t.mechanics, hint: t.mechanicsHint, Icon: Puzzle },
  ];

  return (
    <div className="mobile-menu">
      <button
        ref={triggerRef}
        type="button"
        className="menu-trigger"
        aria-label={t.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {mounted && open && createPortal(
        <div className="mobile-nav-root">
          <div className="mobile-nav-scrim" aria-hidden="true" onClick={close} />
          <div
            id="mobile-nav"
            ref={panelRef}
            className="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t.nav}
          >
            <div className="mobile-nav-head">
              <span className="brand">
                <span className="brand-mark"><MeepleMark size={19} /></span>
                <span>Juegos<span className="brand-word-accent">pedia</span></span>
              </span>
              <button
                type="button"
                className="menu-trigger"
                aria-label={t.close}
                data-autofocus
                onClick={close}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <Link href={listingPath('search', locale, market)} className="mobile-nav-search" onClick={close}>
              <Search size={18} aria-hidden="true" />
              <span>{t.search}</span>
            </Link>

            <nav className="mobile-nav-links" aria-label={t.nav}>
              {links.map(({ href, label, hint, Icon }) => (
                <Link key={href} href={href} className="mobile-nav-link" onClick={close}>
                  <span className="mobile-nav-link-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span className="mobile-nav-link-text">
                    <span className="mobile-nav-link-label">{label}</span>
                    <span className="mobile-nav-link-hint">{hint}</span>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" className="mobile-nav-link-chevron" />
                </Link>
              ))}
            </nav>

            <a className="mobile-nav-login" href={`${APP_URL}/account`} onClick={close}>
              <User size={18} aria-hidden="true" />
              <span>{t.login}</span>
            </a>

            {/* Market first: it decides prices and sellers, so it outranks
                language and theme as a setting. Desktop shows it in the header;
                without this it was simply unreachable on a phone. */}
            <div className="mobile-nav-foot">
              <span className="mobile-nav-foot-label">{t.market}</span>
              <div className="mobile-nav-foot-controls">
                <MarketSwitcher locale={locale} market={market ?? DEFAULT_MARKET} placement="top" />
              </div>
            </div>

            <div className="mobile-nav-foot">
              <span className="mobile-nav-foot-label">{t.settings}</span>
              <div className="mobile-nav-foot-controls">
                <LocaleSwitcher locale={locale} />
                <ThemeToggle locale={locale} />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
