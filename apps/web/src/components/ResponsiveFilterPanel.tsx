'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export function ResponsiveFilterPanel({ children, locale, activeCount }: {
  children: ReactNode;
  locale: 'es' | 'en';
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = locale === 'es'
    ? { open: 'Abrir filtros', title: 'Filtros', close: 'Cerrar filtros', apply: 'Ver resultados' }
    : { open: 'Open filters', title: 'Filters', close: 'Close filters', apply: 'View results' };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="responsive-filter-panel">
      <button
        ref={triggerRef}
        type="button"
        className="mobile-filter-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span>{t.title}</span>
        {activeCount > 0 && <span className="mobile-filter-count">{activeCount}</span>}
      </button>

      <div
        className={`mobile-filter-modal${open ? ' is-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label={t.open}
      >
        <header className="mobile-filter-header">
          <span><SlidersHorizontal size={18} aria-hidden="true" /><b>{t.title}</b></span>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t.close}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="mobile-filter-scroll">{children}</div>
        <footer className="mobile-filter-footer">
          <button type="submit" className="mobile-filter-apply">{t.apply}</button>
        </footer>
      </div>
    </div>
  );
}
